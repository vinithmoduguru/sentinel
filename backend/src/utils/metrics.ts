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

register.registerMetric(toolCallCounter)
register.registerMetric(latencyHistogram)

export function incrementMetric(name: string, labels: Record<string, string>) {
  if (name === "tool_call_total") toolCallCounter.inc(labels)
}
