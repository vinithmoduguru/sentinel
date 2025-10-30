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
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

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

    const triageRuns24Promise = prisma.triageRun.count({
      where: { started_at: { gte: last24h } },
    })

    const fallbackRuns24Promise = prisma.triageRun.count({
      where: { started_at: { gte: last24h }, fallback_used: true },
    })

    const actions24Promise = prisma.caseEvent.count({
      where: { ts: { gte: last24h } },
    })

    const alerts7dPromise = prisma.$queryRaw<
      Array<{ day: Date; count: number }>
    >`
      SELECT DATE("created_at") AS day, COUNT(*)::int AS count
      FROM "Alert"
      WHERE "created_at" >= ${last7d}
      GROUP BY day
      ORDER BY day
    `

    const triage7dPromise = prisma.$queryRaw<
      Array<{ day: Date; count: number }>
    >`
      SELECT DATE("started_at") AS day, COUNT(*)::int AS count
      FROM "TriageRun"
      WHERE "started_at" >= ${last7d}
      GROUP BY day
      ORDER BY day
    `

    const [
      alertsInQueue,
      disputesOpen,
      percentileRows,
      triageRuns24h,
      fallbackRuns24h,
      actions24h,
      alerts7dRows,
      triage7dRows,
    ] = await Promise.all([
      alertsCountPromise,
      disputesOpenPromise,
      percentilesPromise,
      triageRuns24Promise,
      fallbackRuns24Promise,
      actions24Promise,
      alerts7dPromise,
      triage7dPromise,
    ])

    const pRow = percentileRows?.[0] ?? { p50: 0, p95: 0 }
    const p50 = Number(pRow?.p50 ?? 0)
    const p95 = Number(pRow?.p95 ?? 0)

    const fallbackRate24h = triageRuns24h > 0 ? fallbackRuns24h / triageRuns24h : 0

    const formatSeries = (rows: Array<{ day: Date; count: number }>) => {
      const map = new Map<string, number>()
      for (const row of rows) {
        const key = new Date(row.day).toISOString().slice(0, 10)
        map.set(key, Number(row.count ?? 0))
      }
      const series: Array<{ day: string; count: number }> = []
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const key = day.toISOString().slice(0, 10)
        series.push({ day: key, count: map.get(key) ?? 0 })
      }
      return series
    }

    const alerts7d = formatSeries(alerts7dRows)
    const triage7d = formatSeries(triage7dRows)

    res.status(200).json({
      alertsInQueue,
      disputesOpen,
      triageLatencyMs: { p50, p95 },
      triageRuns24h,
      fallbackRate24h,
      actions24h,
      alerts7d,
      triage7d,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to compute dashboard KPIs:", err)
    res.status(500).json({ error: "Failed to compute dashboard KPIs" })
  }
}


