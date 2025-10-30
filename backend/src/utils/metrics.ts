import client from "prom-client"

export const register = new client.Registry()

export const toolCallCounter = new client.Counter({
  name: "tool_call_total",
  help: "Number of tool calls by agent",
  labelNames: ["tool", "ok"],
})
export const latencyHistogram = new client.Histogram({
  name: "agent_latency_ms",
  help: "Latency of agent calls",
  labelNames: ["agent"],
  buckets: [50, 100, 250, 500, 1000, 2000],
})

export const apiLatencyHistogram = new client.Histogram({
  name: "api_request_latency_ms",
  help: "API request latency in milliseconds",
  labelNames: ["method", "route", "status"],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
})

export const actionBlockedCounter = new client.Counter({
  name: "action_blocked_total",
  help: "Number of user actions blocked, labeled by policy",
  labelNames: ["policy"],
})

export const agentFallbackCounter = new client.Counter({
  name: "agent_fallback_total",
  help: "Number of times agent fallback was triggered",
  labelNames: ["tool"],
})

export const rateLimitBlockedCounter = new client.Counter({
  name: "rate_limit_block_total",
  help: "Number of requests blocked by the rate limiter",
})

register.registerMetric(toolCallCounter)
register.registerMetric(latencyHistogram)
register.registerMetric(apiLatencyHistogram)
register.registerMetric(actionBlockedCounter)
register.registerMetric(agentFallbackCounter)
register.registerMetric(rateLimitBlockedCounter)

export function incrementMetric(name: string, labels: Record<string, string>) {
  if (name === "tool_call_total") toolCallCounter.inc(labels)
  if (name === "action_blocked_total") actionBlockedCounter.inc(labels)
  if (name === "agent_fallback_total") agentFallbackCounter.inc(labels)
  if (name === "rate_limit_block_total") rateLimitBlockedCounter.inc()
}

export function recordApiLatency(
  method: string,
  route: string,
  status: number,
  durationMs: number
) {
  apiLatencyHistogram.observe({ method, route, status: status.toString() }, durationMs)
}
