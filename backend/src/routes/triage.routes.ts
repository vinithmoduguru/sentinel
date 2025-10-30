import { Router, type Response } from "express"
import { v4 as uuid } from "uuid"
import { runPlan } from "../orchestrator/planner.js"
import { startTriageRun } from "../services/triageService.js"
import { logger } from "../utils/logger.js"
import { sanitizeContext } from "../utils/sanitizer.js"

const router = Router()
const clients = new Map<string, Response>()

router.post("/", async (req, res) => {
  const runId = uuid()
  const { alertId, customerId, context } = req.body || {}

  if (!alertId || typeof alertId !== "number") {
    res.status(400).json({ error: "alertId (number) is required" })
    return
  }

  // Sanitize user context to prevent prompt injection
  const sanitizedContext = context ? sanitizeContext(context) : {}

  res.json({ runId })

  try {
    const { id: triageRunId } = await startTriageRun(alertId)
    // start orchestration async with both IDs
    runPlan(runId, customerId, sanitizedContext, triageRunId)
  } catch (err: any) {
    // best-effort logging; response already sent
    logger.error({
      runId,
      event: "triage_run_start_failed",
      error: err?.message,
    })
  }
})

// SSE stream
router.get("/:runId/stream", async (req, res) => {
  const { runId } = req.params
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.flushHeaders()
  clients.set(runId, res)
  req.on("close", () => clients.delete(runId))
})

// helper to publish events to frontend
export function publishEvent(runId: string, event: any) {
  const res = clients.get(runId)
  if (res) res.write(`data: ${JSON.stringify(event)}\n\n`)
}

export default router
