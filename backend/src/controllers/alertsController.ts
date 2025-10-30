import type { Request, Response } from "express"
import prisma from "../config/database.js"
import { alertsQuerySchema } from "../schemas/alerts.schema.js"
import { logger } from "../utils/logger.js"
import { decodeCursorBase64, encodeCursorBase64 } from "../utils/pagination.js"

type CursorPayload = { createdAt: string; id: number }

export async function getAlertsHandler(req: Request, res: Response) {
  const start = Date.now()
  try {
    const parsed = alertsQuerySchema.parse(req.query)
    const limit = Math.min(parsed.limit ?? 50, 200)

    // Build filters
    const where: any = {}
    if (parsed.status) where.status = parsed.status
    if (parsed.risk) where.risk = parsed.risk.toUpperCase()
    if (parsed.from || parsed.to) {
      where.created_at = {}
      if (parsed.from) where.created_at.gte = parsed.from
      if (parsed.to) {
        const toDate = new Date(parsed.to)
        toDate.setHours(23, 59, 59, 999)
        where.created_at.lte = toDate
      }
    }

    // Keyset pagination
    let createdIdLtClause: any = undefined
    if (parsed.cursor) {
      const decoded = decodeCursorBase64<CursorPayload>(parsed.cursor)
      if (!decoded) {
        return res.status(400).json({ error: "Invalid cursor" })
      }
      const lastCreatedAt = new Date(decoded.createdAt)
      const lastId = decoded.id
      createdIdLtClause = {
        OR: [
          { created_at: { lt: lastCreatedAt } },
          { AND: [{ created_at: lastCreatedAt }, { id: { lt: lastId } }] },
        ],
      }
    }

    const effectiveWhere = createdIdLtClause
      ? { AND: [where, createdIdLtClause] }
      : where

    const rows = await prisma.alert.findMany({
      where: effectiveWhere,
      include: {
        customer: { select: { id: true, name: true } },
        suspect_txn: {
          select: {
            id: true,
            merchant: true,
            mcc: true,
            amount_cents: true,
            currency: true,
            ts: true,
          },
        },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    })

    let nextCursor: string | null = null
    let items = rows
    if (rows.length > limit) {
      const sliced = rows.slice(0, limit)
      items = sliced
      if (sliced.length > 0) {
        const lastIndex = sliced.length - 1
        const lastItem = sliced[lastIndex]!
        nextCursor = encodeCursorBase64({
          createdAt: lastItem.created_at.toISOString(),
          id: lastItem.id,
        })
      }
    }

    const payload = {
      items: items.map((a) => ({
        id: a.id,
        createdAt: a.created_at.toISOString(),
        risk: String(a.risk).toUpperCase(),
        status: a.status,
        customer: a.customer,
        transaction: a.suspect_txn
          ? {
              id: a.suspect_txn.id,
              merchant: a.suspect_txn.merchant,
              mcc: a.suspect_txn.mcc,
              amountCents: a.suspect_txn.amount_cents,
              currency: a.suspect_txn.currency,
              ts: a.suspect_txn.ts.toISOString(),
            }
          : null,
        canOpenTriage: ["OPEN", "ACKNOWLEDGED"].includes(a.status),
      })),
      nextCursor,
    }

    res.status(200).json(payload)
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch alerts")
    return res.status(400).json({ error: err?.message || "Bad request" })
  } finally {
    const ms = Date.now() - start
    logger.info({ path: "/api/alerts", latencyMs: ms }, "api_request_complete")
  }
}
