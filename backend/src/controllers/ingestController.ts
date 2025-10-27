import type { NextFunction, Request, Response } from "express"
import { ingestTransactionsSchema } from "../schemas/transactions.schema.js"
import { ingestTransactions } from "../services/transactionService.js"

export const ingestTransactionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactions } = ingestTransactionsSchema.parse(req.body)
    const { count } = await ingestTransactions(transactions)

    return res.status(200).json({
      accepted: true,
      count,
      requestId: req.headers["x-request-id"] ?? null,
    })
  } catch (error) {
    next(error)
  }
}
