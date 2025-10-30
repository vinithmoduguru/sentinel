import type { Request, Response, NextFunction } from "express"
import { redis } from "../utils/redis.js"
import { incrementMetric } from "../utils/metrics.js"

type RateLimiterOptions = {
  capacity?: number
  refillPerSecond?: number
  headerName?: string
  keyGenerator?: (req: Request, headerName: string) => string
}

// Lua script implementing token bucket in Redis atomically
// KEYS[1] = bucket key
// ARGV[1] = capacity
// ARGV[2] = refill_per_second
// ARGV[3] = now_ms
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_sec = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])

local state = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(state[1])
local ts = tonumber(state[2])

if tokens == nil then
  tokens = capacity
  ts = now_ms
else
  local delta = math.max(0, now_ms - ts)
  local refill = (delta / 1000.0) * refill_per_sec
  tokens = math.min(capacity, tokens + refill)
end

local allowed = 0
local retry_after = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  local need = 1 - tokens
  retry_after = math.ceil(need / refill_per_sec)
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now_ms)
-- Set TTL to a few seconds to avoid stale keys (capacity/refill tied TTL)
local ttl = math.ceil(math.max(1, capacity / math.max(1, refill_per_sec)) * 10)
redis.call('EXPIRE', key, ttl)

return {allowed, tokens, retry_after}
`

function getClientId(req: Request, headerName: string): string {
  const apiKey = req.header(headerName)
  if (apiKey) return `api:${apiKey}`
  // rely on trust proxy being set in app
  const ip = (req.ip || req.connection.remoteAddress || "unknown") as string
  return `ip:${ip}`
}

export function rateLimiter(options: RateLimiterOptions = {}) {
  const capacity = Number(
    process.env.RATE_LIMIT_CAPACITY ?? options.capacity ?? 5
  )
  const refillPerSecond = Number(
    process.env.RATE_LIMIT_RATE ?? options.refillPerSecond ?? 5
  )
  const headerName = options.headerName ?? "x-api-key"
  const keyGenerator =
    options.keyGenerator ??
    ((req: Request, header: string) => {
      const routeKey = `${req.method}:${req.baseUrl || req.path}`
      const client = getClientId(req, header)
      return `${client}:${routeKey}`
    })

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const clientKey = keyGenerator(req, headerName)
      const key = `rate_limit:${clientKey}`
      const nowMs = Date.now()
      const result = (await redis.eval(
        TOKEN_BUCKET_LUA,
        1,
        key,
        capacity,
        refillPerSecond,
        nowMs
      )) as [number, number, number]

      const allowed = Number(result?.[0] ?? 0)
      const retryAfter = Number(result?.[2] ?? 0)

      if (allowed >= 1) {
        return next()
      }

      if (retryAfter > 0) {
        res.setHeader("Retry-After", String(retryAfter))
      }
      incrementMetric("rate_limit_block_total", {})
      return res.status(429).json({ error: "Too Many Requests" })
    } catch (err) {
      // Fail-open on Redis errors
      return next()
    }
  }
}

export default rateLimiter
