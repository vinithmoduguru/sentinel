import { Redis } from "ioredis"

export const redis = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379"
)

// Circuit breaker helpers
const CIRCUIT_PREFIX = "cb:"

export async function getCircuitState(agent: string): Promise<boolean> {
  const key = CIRCUIT_PREFIX + agent + ":open"
  return Boolean(await redis.get(key))
}

export async function openCircuit(agent: string, ttlSeconds = 30) {
  const key = CIRCUIT_PREFIX + agent + ":open"
  await redis.set(key, "1", "EX", ttlSeconds)
}

export async function resetCircuit(agent: string) {
  const key = CIRCUIT_PREFIX + agent + ":open"
  await redis.del(key)
}
