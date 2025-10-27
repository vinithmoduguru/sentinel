import type { Prisma } from "@prisma/client"
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
