import type { NextFunction, Request, Response } from "express"
import { getIdempotentResponse, setIdempotentResponse } from "../utils/redis.js"

export function idempotency(scope: string, ttlSeconds = 600) {
  return async function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const rawKey = String(req.header("Idempotency-Key") || "").trim()
      if (!rawKey) return next()

      const cached = await getIdempotentResponse(scope, rawKey)
      if (cached) {
        return res.status(200).json(cached)
      }

      const originalJson = res.json.bind(res)
      const originalSend = res.send.bind(res)

      // Capture JSON body and cache on success
      res.json = (body: unknown) => {
        // Cache only for 2xx
        if (res.statusCode >= 200 && res.statusCode < 300) {
          void setIdempotentResponse(scope, rawKey, body, ttlSeconds)
        }
        return originalJson(body)
      }

      // If a handler uses send with a JSON-serializable object
      res.send = (body: any) => {
        try {
          // Attempt to cache only when it looks like JSON
          if (
            res
              .getHeader("content-type")
              ?.toString()
              .includes("application/json") &&
            res.statusCode >= 200 &&
            res.statusCode < 300
          ) {
            const parsed = typeof body === "string" ? JSON.parse(body) : body
            void setIdempotentResponse(scope, rawKey, parsed, ttlSeconds)
          }
        } catch {
          // ignore parse/cache errors
        }
        return originalSend(body)
      }

      return next()
    } catch (err) {
      return next(err)
    }
  }
}
