import type { Request, Response } from "express"
import {
  customerIdParamSchema,
  customerTransactionsQuerySchema,
} from "../schemas/customerTransactions.schema.js"
import { listCustomerTransactions } from "../services/transactionService.js"

export const getCustomerTransactionsHandler = async (
  req: Request,
  res: Response
) => {
  const { id } = customerIdParamSchema.parse(req.params)
  const { from, to, cursor, limit } = customerTransactionsQuerySchema.parse(
    req.query
  )

  const { items, nextCursor } = await listCustomerTransactions(id, {
    from,
    to,
    cursor,
    limit,
  })

  res.json({ items, nextCursor })
}
