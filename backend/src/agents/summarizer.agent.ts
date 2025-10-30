import type { AgentFn } from "../orchestrator/agent.interface.js"

export const summarizer: AgentFn = async (input) => {
  const start = Date.now()
  const risk = input.context?.finalRisk ?? "UNKNOWN"
  const reasons = input.context?.finalReasons ?? []

  const summary = `Risk level ${risk}. ${Array.isArray(reasons) && reasons.length > 0 ? `Reasons: ${reasons.join(", ")}` : "No specific reasons available."}`

  return {
    ok: true,
    durationMs: Date.now() - start,
    data: { summary },
  }
}


