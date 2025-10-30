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
  // Preload context data required by agents
  const profile = await prisma.customer.findUnique({
    where: { id: Number(customerId) },
  })
  const recent = await listCustomerTransactions(Number(customerId), {
    limit: 50,
  })
  context.profile = profile
  context.recentTx = recent.items
  context.recentTransactions = recent.items

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
      customerId,
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
    risk: finalRisk,
    reasons: finalReasons,
    fallbackUsed: anyFallback,
    latencyMs,
    endedAt: new Date(),
  })

  logger.info({ runId: publicRunId, event: "decision_finalized" })
}
