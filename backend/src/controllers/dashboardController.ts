import { type Request, type Response } from "express"
import prisma from "../config/database.js"

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

export async function getDashboardKpisHandler(req: Request, res: Response) {
  try {
    const rawSinceDays = Number((req.query.sinceDays as string) ?? 30)
    const sinceDays = clampNumber(rawSinceDays, 1, 365)
    const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)

    const alertsCountPromise = prisma.alert.count({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    })

    const disputesOpenPromise = prisma.case.count({
      where: { type: "DISPUTE", status: { in: ["OPEN", "IN_PROGRESS"] } },
    })

    const percentilesPromise = prisma.$queryRaw<
      Array<{ p50: number | null; p95: number | null }>
    >`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY "latency_ms") AS p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "latency_ms") AS p95
      FROM "TriageRun"
      WHERE "started_at" >= ${sinceDate}
    `

    const [alertsInQueue, disputesOpen, percentileRows] = await Promise.all([
      alertsCountPromise,
      disputesOpenPromise,
      percentilesPromise,
    ])

    const pRow = percentileRows?.[0] ?? { p50: 0, p95: 0 }
    const p50 = Number(pRow?.p50 ?? 0)
    const p95 = Number(pRow?.p95 ?? 0)

    res.status(200).json({
      alertsInQueue,
      disputesOpen,
      triageLatencyMs: { p50, p95 },
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to compute dashboard KPIs:", err)
    res.status(500).json({ error: "Failed to compute dashboard KPIs" })
  }
}


