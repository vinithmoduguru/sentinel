import type { Prisma, Transaction } from "@prisma/client"
import prisma from "../config/database.js"
import type { TransactionInput } from "../schemas/transactions.schema.js"

export const ingestTransactions = async (transactions: TransactionInput[]) => {
  const results = await prisma.$transaction(async (tx) => {
    const promises = transactions.map(async (t) => {
      return tx.transaction.upsert({
        where: {
          id: t.id ?? 0,
        },
        update: {
          ...t, // overwrite existing record if found
        },
        create: t,
      })
    })

    const upserts = await Promise.all(promises)
    return upserts
  })

  return { count: results.length }
}

// Cursor encoding/decoding helpers for keyset pagination
type CursorPayload = { ts: string; id: number }

const encodeCursor = (payload: CursorPayload) =>
  Buffer.from(JSON.stringify(payload)).toString("base64url")

const decodeCursor = (cursor: string): CursorPayload | null => {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8")
    const obj = JSON.parse(json) as CursorPayload
    if (!obj.ts || typeof obj.id !== "number") return null
    return obj
  } catch {
    return null
  }
}

export type ListTransactionsOptions = {
  from?: Date
  to?: Date
  limit?: number
  cursor?: string
}

export const listCustomerTransactions = async (
  customerId: number,
  opts: ListTransactionsOptions
) => {
  // If limit is explicitly provided, use it (capped at 200)
  // If not provided, default to 50 for regular queries
  // But allow undefined to mean "no limit" when needed
  const limit =
    opts.limit !== undefined
      ? Math.min(Math.max(opts.limit, 1), 200)
      : undefined

  // Base where clause
  const where: Prisma.TransactionWhereInput = {
    customer_id: customerId,
  }

  if (opts.from || opts.to) {
    where.ts = {}
    if (opts.from) where.ts.gte = opts.from
    if (opts.to) where.ts.lte = opts.to
  }

  // Apply keyset cursor predicate for order: ts desc, id desc
  if (opts.cursor) {
    const cur = decodeCursor(opts.cursor)
    if (cur) {
      const ts = new Date(cur.ts)
      where.AND = [
        {
          OR: [{ ts: { lt: ts } }, { AND: [{ ts }, { id: { lt: cur.id } }] }],
        },
      ]
    }
  }

  const items = await prisma.transaction.findMany({
    where,
    orderBy: [{ ts: "desc" }],
    ...(limit !== undefined && { take: limit }),
  })

  let nextCursor: string | undefined
  if (limit !== undefined && items.length === limit) {
    const last = items[items.length - 1] as Transaction
    nextCursor = encodeCursor({ ts: last.ts.toISOString(), id: last.id })
  }

  return { items, nextCursor }
}
