import { z } from "zod"

export const alertsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).optional(),
  status: z.enum(["OPEN", "ACKNOWLEDGED", "CLOSED"]).optional(),
  risk: z.enum(["low", "medium", "high"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export type AlertsQuery = z.infer<typeof alertsQuerySchema>
