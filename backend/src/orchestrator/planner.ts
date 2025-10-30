import { runAgent } from "./executor.js"
import { riskSignals } from "../agents/riskSignals.agent.js"
import { insights } from "../agents/insights.agent.js"
import { kb } from "../agents/kb.agent.js"
import { logger } from "../utils/logger.js"
import { completeTriageRun } from "../services/triageService.js"

export async function runPlan(
  publicRunId: string,
  customerId: string,
  context: any,
  triageRunId: number
) {
  const plan = [
    { name: "insights", fn: insights },
    { name: "riskSignals", fn: riskSignals },
    { name: "kbLookup", fn: kb },
    // { name: "summarizer", fn: summarizer },
    // { name: "compliance", fn: compliance },
  ]

  const startedAt = Date.now()
  let anyFallback = false
  let finalRisk: string | null = null
  let finalReasons: any | null = null

  logger.info({
    runId: publicRunId,
    event: "plan_built",
    steps: plan.map((p) => p.name),
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

    if (name === "riskSignals" && res.ok && res.data) {
      finalRisk = res.data.risk ?? null
      finalReasons = res.data.reasons ?? null
    }
  }

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
