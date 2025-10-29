import type { AgentInput, AgentOutput } from "./agent.interface.js"
import { publishEvent } from "../routes/triage.routes.js"
import { logger } from "../utils/logger.js"

export async function fallback(
  agentName: string,
  input: AgentInput,
  reason: string
): Promise<AgentOutput> {
  const output = {
    ok: true,
    durationMs: 10,
    data: { message: `Fallback for ${agentName}`, reason },
    fallbackUsed: true,
  }

  logger.warn({
    runId: input.runId,
    agentName,
    reason,
    event: "fallback_triggered",
  })
  publishEvent(input.runId, {
    type: "fallback_triggered",
    step: agentName,
    reason,
  })
  return output
}
