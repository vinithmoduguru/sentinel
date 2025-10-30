import { runAgent } from "./executor.js"
import { riskSignals } from "../agents/riskSignals.agent.js"
import { insights } from "../agents/insights.agent.js"
import { kb } from "../agents/kb.agent.js"
import { compliance } from "../agents/compliance.agent.js"
import { summarizer } from "../agents/summarizer.agent.js"
import { logger } from "../utils/logger.js"
import { completeTriageRun } from "../services/triageService.js"
import prisma from "../config/database.js"
import { listCustomerTransactions } from "../services/transactionService.js"

export async function runPlan(
  publicRunId: string,
  customerId: string,
  context: any,
  triageRunId: number
) {
  // Load the triage run to get the alert and suspect transaction
  const triageRun = await prisma.triageRun.findUnique({
    where: { id: triageRunId },
    include: {
      alert: {
        include: {
          suspect_txn: true,
        },
      },
    },
  })

  // Preload context data required by agents (guard invalid IDs)
  const numericCustomerId = Number(customerId)
  let profile: any = null
  let recent: { items: any[] } = { items: [] }
  if (Number.isFinite(numericCustomerId) && numericCustomerId > 0) {
    profile = await prisma.customer.findUnique({
      where: { id: numericCustomerId },
    })
    try {
      recent = await listCustomerTransactions(numericCustomerId, { limit: 50 })
    } catch {
      recent = { items: [] }
    }
  } else {
    logger.warn({ runId: publicRunId, event: "invalid_customer_id", customerId })
  }
  // Merge profile from context (if provided) with database profile
  context.profile = context.profile ? { ...profile, ...context.profile } : profile
  context.recentTx = recent.items
  context.recentTransactions = recent.items
  // Add suspect transaction from alert as the primary transaction to analyze
  if (triageRun?.alert?.suspect_txn) {
    context.suspectTransaction = triageRun.alert.suspect_txn
    // Insert suspect transaction at the beginning of recentTransactions if not already there
    const hasSuspect = context.recentTransactions.some(
      (t: any) => t.id === triageRun.alert.suspect_txn.id
    )
    if (!hasSuspect) {
      context.recentTransactions = [
        triageRun.alert.suspect_txn,
        ...context.recentTransactions,
      ]
    }
  }

  const plan = [
    { name: "riskSignals", fn: riskSignals },
    { name: "kbLookup", fn: kb },
    { name: "compliance", fn: compliance },
    { name: "insights", fn: insights },
  ]

  const startedAt = Date.now()
  let anyFallback = false
  let finalRisk: string | null = null
  let finalReasons: any | null = null

  logger.info({
    runId: publicRunId,
    event: "plan_built",
    steps: [
      "getProfile",
      "recentTx",
      "riskSignals",
      "kbLookup",
      "decide",
      "proposeAction",
    ],
  })

  for (const { name, fn } of plan) {
    const res = await runAgent(publicRunId, triageRunId, name, fn, {
      runId: publicRunId,
      customerId: String(numericCustomerId || ""),
      context,
    })
    if (!res.ok) {
      logger.warn({ runId: publicRunId, name, event: "agent_failed" })
    }
    if (res.fallbackUsed) anyFallback = true
    if (res.ok && res.data) {
      context[name] = res.data
    }

    if (name === "riskSignals" && res.ok && res.data) {
      finalRisk = res.data.risk ?? null
      finalReasons = res.data.reasons ?? null
    }
  }

  // Decide step: combine signals (simple merge of existing finalRisk with compliance/fraud heuristics)
  const decideResult = (() => {
    let riskLevel = (finalRisk || "low").toLowerCase()
    const reasons: string[] = Array.isArray(finalReasons)
      ? [...finalReasons]
      : []
    if (context?.profile?.kyc_level === "UNKNOWN") {
      reasons.push("unknown KYC level")
      if (riskLevel === "low") riskLevel = "medium"
    }
    context.finalRisk = riskLevel.toUpperCase()
    context.finalReasons = reasons
    return { risk: context.finalRisk, reasons }
  })()

  // Propose action step: summarize outcome
  await runAgent(publicRunId, triageRunId, "proposeAction", summarizer, {
    runId: publicRunId,
    customerId,
    context,
  })

  const latencyMs = Date.now() - startedAt
  await completeTriageRun(triageRunId, {
    risk: decideResult.risk,  // Use the computed risk, not the raw finalRisk
    reasons: decideResult.reasons,  // Use the computed reasons
    fallbackUsed: anyFallback,
    latencyMs,
    endedAt: new Date(),
  })

  logger.info({ runId: publicRunId, event: "decision_finalized" })
}
