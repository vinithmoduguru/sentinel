export type AgentInput = {
  runId: string
  customerId: string
  context?: Record<string, any>
}

export type AgentOutput = {
  ok: boolean
  durationMs: number
  data?: any
  error?: string
  fallbackUsed?: boolean
  schemaValidation?: { valid: boolean; error?: string }
}

export type AgentFn = (input: AgentInput) => Promise<AgentOutput>
