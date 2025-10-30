import pino from "pino"

const baseConfig = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: {
    // Include timestamp in ISO format
  },
  timestamp: () => `,"ts":"${new Date().toISOString()}"`,
  formatters: {
    level: (label: string) => {
      return { level: label }
    },
  },
}

export const logger = pino(
  process.env.NODE_ENV === "production"
    ? baseConfig
    : {
        ...baseConfig,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        },
      }
)

// Helper to create structured log with required fields
export function createLogContext(params: {
  requestId?: string
  runId?: string
  sessionId?: string
  customerId?: string | number
  event: string
  masked?: boolean
  [key: string]: any
}) {
  const context: any = {
    ts: new Date().toISOString(),
    event: params.event,
  }
  
  if (params.requestId) context.requestId = params.requestId
  if (params.runId) context.runId = params.runId
  if (params.sessionId) context.sessionId = params.sessionId
  
  // Mask customer ID for privacy
  if (params.customerId) {
    const cidStr = String(params.customerId)
    context.customerId_masked = cidStr.length > 4 
      ? `***${cidStr.slice(-4)}` 
      : "***"
  }
  
  if (params.masked !== undefined) context.masked = params.masked
  
  // Include any additional fields
  Object.keys(params).forEach((key) => {
    if (!["requestId", "runId", "sessionId", "customerId", "event", "masked", "ts"].includes(key)) {
      context[key] = params[key]
    }
  })
  
  return context
}
