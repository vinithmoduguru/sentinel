import type { Request, Response } from "express"
import { recordApiLatency } from "../utils/metrics.js"
import { logger } from "../utils/logger.js"
import { v4 as uuid } from "uuid"

export function requestLogger() {
  return (req: Request, res: Response, next: any) => {
    const start = Date.now()
    const requestId = (req.headers["x-request-id"] as string) || uuid()
    
    // Attach requestId to request for downstream use
    ;(req as any).requestId = requestId

    // Log request start
    logger.info({
      requestId,
      event: "request_start",
      method: req.method,
      path: req.path,
      ip: req.ip,
    })

    // Capture response
    const originalSend = res.send
    res.send = function (data) {
      res.send = originalSend
      const durationMs = Date.now() - start
      
      // Record metrics
      const route = sanitizeRoute(req.path)
      recordApiLatency(req.method, route, res.statusCode, durationMs)
      
      // Log request completion
      logger.info({
        requestId,
        event: "request_complete",
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: durationMs,
      })
      
      return originalSend.call(this, data)
    }

    next()
  }
}

// Sanitize route to avoid cardinality explosion in metrics
function sanitizeRoute(path: string): string {
  // Replace numeric IDs with :id placeholder
  return path.replace(/\/\d+/g, "/:id")
}

