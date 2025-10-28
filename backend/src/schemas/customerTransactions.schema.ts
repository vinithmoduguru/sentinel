import { z } from "zod"

export const customerIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

// Helper to parse duration strings like "90d", "24h", "30m"
const durationRegex = /^(\d+)(d|h|m)$/

const parseDuration = (duration: string): Date | null => {
  const match = duration.match(durationRegex)
  if (!match || !match[1] || !match[2]) return null

  const value = parseInt(match[1], 10)
  const unit = match[2]

  const now = Date.now()
  let timestamp: number

  switch (unit) {
    case "d":
      timestamp = now - value * 24 * 60 * 60 * 1000 // days
      break
    case "h":
      timestamp = now - value * 60 * 60 * 1000 // hours
      break
    case "m":
      timestamp = now - value * 60 * 1000 // minutes
      break
    default:
      return null
  }

  return new Date(timestamp)
}

export const customerTransactionsQuerySchema = z
  .object({
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
    last: z
      .string()
      .regex(durationRegex, "Invalid duration format. Use: 90d, 24h, 30m")
      .optional(),
  })
  .refine(
    (data) => {
      // Can't use both 'from' and 'last'
      if (data.from && data.last) return false
      return true
    },
    { message: "Cannot use both 'from' and 'last' parameters" }
  )
  .transform((data) => {
    // If 'last' is provided, calculate 'from' date
    if (data.last) {
      const calculatedFrom = parseDuration(data.last)
      if (calculatedFrom) {
        return { ...data, from: calculatedFrom, last: undefined }
      }
    }
    return data
  })

export type CustomerIdParam = z.infer<typeof customerIdParamSchema>
export type CustomerTransactionsQuery = z.infer<
  typeof customerTransactionsQuerySchema
>
