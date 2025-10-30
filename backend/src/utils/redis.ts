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

export async function closeCircuit(agent: string) {
  return resetCircuit(agent)
}

// Idempotency helpers
const IDEM_PREFIX = "idem:"

export async function getIdempotentResponse(scope: string, key: string) {
  const raw = await redis.get(IDEM_PREFIX + scope + ":" + key)
  return raw ? JSON.parse(raw) : null
}

export async function setIdempotentResponse(
  scope: string,
  key: string,
  value: unknown,
  ttlSeconds = 600
) {
  await redis.set(
    IDEM_PREFIX + scope + ":" + key,
    JSON.stringify(value),
    "EX",
    ttlSeconds
  )
}
