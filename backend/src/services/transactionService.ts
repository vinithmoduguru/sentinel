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
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)

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
    orderBy: [{ ts: "desc" }, { id: "desc" }],
    take: limit,
  })

  let nextCursor: string | undefined
  if (items.length === limit) {
    const last = items[items.length - 1] as Transaction
    nextCursor = encodeCursor({ ts: last.ts.toISOString(), id: last.id })
  }

  return { items, nextCursor }
}
