import prisma from "../config/database.js"
import { Prisma } from "@prisma/client"
import { redactor } from "../utils/redactor.js"

export async function startTriageRun(
  alertId: number
): Promise<{ id: number; startedAt: Date }> {
  const startedAt = new Date()
  const run = await prisma.triageRun.create({
    data: {
      alert_id: alertId,
      started_at: startedAt,
      ended_at: null,
      risk: null,
      reasons: Prisma.DbNull,
      fallback_used: false,
      latency_ms: 0,
    },
  })
  return { id: run.id, startedAt }
}

export async function completeTriageRun(
  id: number,
  data: {
    risk?: string | null
    reasons?: any | null
    fallbackUsed: boolean
    latencyMs: number
    endedAt: Date
  }
): Promise<void> {
  await prisma.triageRun.update({
    where: { id },
    data: {
      ended_at: data.endedAt,
      risk: data.risk ?? null,
      reasons: data.reasons ?? Prisma.DbNull,
      fallback_used: data.fallbackUsed,
      latency_ms: data.latencyMs,
    },
  })
}

export async function appendAgentTrace(
  runId: number,
  step: string,
  result: {
    ok: boolean
    durationMs: number
    data?: any
    error?: string
    fallbackUsed?: boolean
  }
): Promise<number> {
  // Serial execution today allows simple count-based seq
  const currentCount = await prisma.agentTrace.count({
    where: { run_id: runId },
  })
  const seq = currentCount + 1
  await prisma.agentTrace.create({
    data: {
      run_id: runId,
      seq,
      step,
      ok: !!result.ok,
      duration_ms: result.durationMs || 0,
      detail_json: redactor(result),
    },
  })
  return seq
}
