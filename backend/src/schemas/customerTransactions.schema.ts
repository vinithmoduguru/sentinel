import { z } from "zod"

export const customerIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const customerTransactionsQuerySchema = z.object({
  from: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export type CustomerIdParam = z.infer<typeof customerIdParamSchema>
export type CustomerTransactionsQuery = z.infer<
  typeof customerTransactionsQuerySchema
>
