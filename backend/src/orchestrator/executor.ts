import type { AgentFn, AgentInput, AgentOutput } from "./agent.interface.js"
import { writeTrace } from "../db/models.js"
import { publishEvent } from "../routes/triage.routes.js"
import { logger } from "../utils/logger.js"
import { redactor } from "../utils/redactor.js"
import { incrementMetric } from "../utils/metrics.js"
import { getCircuitState, openCircuit } from "../utils/redis.js"
import { fallback } from "./fallback.js"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function runAgent(
  runId: string,
  name: string,
  fn: AgentFn,
  input: AgentInput,
  options = { timeoutMs: 1000, retries: 2 }
): Promise<AgentOutput> {
  const start = Date.now()
  let attempt = 0

  if (await getCircuitState(name)) {
    logger.warn({ runId, name, event: "circuit_open" })
    return fallback(name, input, "circuit_open")
  }

  while (attempt <= options.retries) {
    attempt++
    try {
      const result = await Promise.race([
        fn(input),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("timeout")), options.timeoutMs)
        ),
      ])

      result.durationMs = Date.now() - start
      await writeTrace(runId, name, result)
      logger.info({ runId, name, ok: result.ok, event: "agent_complete" })
      incrementMetric("tool_call_total", { tool: name, ok: "true" })
      publishEvent(runId, {
        type: "tool_update",
        step: name,
        ok: true,
        detail: redactor(result),
      })
      return result
    } catch (err: any) {
      logger.error({ runId, name, event: "agent_error", error: err.message })
      incrementMetric("tool_call_total", { tool: name, ok: "false" })
      publishEvent(runId, {
        type: "tool_update",
        step: name,
        ok: false,
        error: err.message,
      })

      if (attempt <= options.retries) {
        await sleep(150 + Math.random() * 200)
        continue
      }

      await openCircuit(name)
      return fallback(name, input, "retries_exhausted")
    }
  }
  return fallback(name, input, "unhandled")
}
