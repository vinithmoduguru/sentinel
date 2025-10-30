import type { Prisma, Transaction } from "@prisma/client"
import prisma from "../config/database.js"
import {
  decodeCursorBase64Url,
  encodeCursorBase64Url,
} from "../utils/pagination.js"
import type { TransactionInput } from "../schemas/transactions.schema.js"

export const ingestTransactions = async (transactions: TransactionInput[]) => {
  const results = await prisma.$transaction(async (tx) => {
    const promises = transactions.map(async (t) => {
      // Use composite key (customer_id, txn_id) for deduplication when txn_id is present
      if (t.txn_id) {
        return tx.transaction.upsert({
          where: {
            customer_id_txn_id: {
              customer_id: t.customer_id,
              txn_id: t.txn_id,
            },
          },
          update: {
            ...t, // overwrite existing record if found
          },
          create: t,
        })
      } else {
        // Fallback to id-based upsert if txn_id not provided
        return tx.transaction.upsert({
          where: {
            id: t.id ?? 0,
          },
          update: {
            ...t,
          },
          create: t,
        })
      }
    })

    const upserts = await Promise.all(promises)
    return upserts
  })

  return { count: results.length }
}

// Cursor encoding/decoding helpers for keyset pagination
type CursorPayload = { ts: string; id: number }

const encodeCursor = (payload: CursorPayload) => encodeCursorBase64Url(payload)

const decodeCursor = (cursor: string): CursorPayload | null => {
  const obj = decodeCursorBase64Url<CursorPayload>(cursor)
  if (!obj || !obj.ts || typeof obj.id !== "number") return null
  return obj
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
