import { z } from "zod"

// Agent input/output schemas
export const agentInputSchema = z.object({
  runId: z.string(),
  customerId: z.string().or(z.number()).optional(),
  context: z.any(),
})

export const riskSignalsOutputSchema = z.object({
  risk: z.enum(["low", "medium", "high", "LOW", "MEDIUM", "HIGH"]).optional(),
  score: z.number().min(0).max(100).optional(),
  reasons: z.array(z.string()).optional(),
  action: z.string().optional(),
})

export const insightsOutputSchema = z.object({
  topMerchants: z.array(z.object({
    merchant: z.string(),
    count: z.number(),
  })).optional(),
  categories: z.array(z.object({
    name: z.string(),
    pct: z.number(),
  })).optional(),
  monthlyTrend: z.array(z.object({
    month: z.string(),
    sum: z.number(),
  })).optional(),
  anomalies: z.array(z.any()).optional(),
})

export const kbOutputSchema = z.object({
  results: z.array(z.object({
    docId: z.number(),
    title: z.string(),
    anchor: z.string(),
    extract: z.string(),
  })).optional(),
})

export const complianceOutputSchema = z.object({
  allowed: z.boolean().optional(),
  blocked: z.boolean().optional(),
  reason: z.string().optional(),
  policy: z.string().optional(),
})

export const summarizerOutputSchema = z.object({
  customerMessage: z.string().optional(),
  internalNote: z.string().optional(),
  action: z.string().optional(),
})

// Validate agent input
export function validateAgentInput(input: any): { valid: boolean; error?: string } {
  const result = agentInputSchema.safeParse(input)
  if (!result.success) {
    return { valid: false, error: result.error.message }
  }
  return { valid: true }
}

// Validate agent output based on agent name
export function validateAgentOutput(
  agentName: string,
  output: any
): { valid: boolean; error?: string; data?: any } {
  let schema: z.ZodSchema | null = null
  
  switch (agentName) {
    case "riskSignals":
      schema = riskSignalsOutputSchema
      break
    case "insights":
      schema = insightsOutputSchema
      break
    case "kbLookup":
    case "kb":
      schema = kbOutputSchema
      break
    case "compliance":
      schema = complianceOutputSchema
      break
    case "proposeAction":
    case "summarizer":
      schema = summarizerOutputSchema
      break
    default:
      // No validation for unknown agents
      return { valid: true, data: output }
  }
  
  if (!schema) {
    return { valid: true, data: output }
  }
  
  const result = schema.safeParse(output)
  if (!result.success) {
    return { valid: false, error: `Schema validation failed: ${result.error.message}` }
  }
  
  return { valid: true, data: result.data }
}

