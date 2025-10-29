import { Router, type Response } from "express"
import { v4 as uuid } from "uuid"
import { runPlan } from "../orchestrator/planner.js"

const router = Router()
const clients = new Map<string, Response>()

router.post("/", async (req, res) => {
  const runId = uuid()
  res.json({ runId })
  // start orchestration async
  runPlan(runId, req.body.customerId, req.body.context)
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
