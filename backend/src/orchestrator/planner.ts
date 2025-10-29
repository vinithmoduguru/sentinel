import { runAgent } from "./executor.js"
import { riskSignals } from "../agents/riskSignals.agent.js"
import { insights } from "../agents/insights.agent.js"
import { logger } from "../utils/logger.js"

export async function runPlan(runId: string, customerId: string, context: any) {
  const plan = [
    { name: "insights", fn: insights },
    { name: "riskSignals", fn: riskSignals },
    // { name: "kbLookup", fn: kbLookup },
    // { name: "summarizer", fn: summarizer },
    // { name: "compliance", fn: compliance },
  ]

  logger.info({ runId, event: "plan_built", steps: plan.map((p) => p.name) })

  for (const { name, fn } of plan) {
    const res = await runAgent(runId, name, fn, { runId, customerId, context })
    if (!res.ok) {
      logger.warn({ runId, name, event: "agent_failed" })
    }
  }

  logger.info({ runId, event: "decision_finalized" })
}
