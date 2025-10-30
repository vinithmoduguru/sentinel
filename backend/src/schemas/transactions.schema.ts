import { custom, z } from "zod"

export const transactionSchema = z.object({
  id: z.number().int().positive().optional(),
  customer_id: z.number().int().positive(),
  card_id: z.number().int().positive().optional(),
  txn_id: z.string().max(255).optional(),
  mcc: z.string().length(4),
  merchant: z.string().max(255),
  amount_cents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  device_id: z.string().max(255).optional(),
  country: z.string().length(2).optional(),
  city: z.string().max(255).optional(),
  ts: z.coerce.date().optional(),
})

export const ingestTransactionsSchema = z.object({
  transactions: z.array(transactionSchema).min(1),
})

export type TransactionInput = z.infer<typeof transactionSchema>
export type IngestTransactionsInput = z.infer<typeof ingestTransactionsSchema>
