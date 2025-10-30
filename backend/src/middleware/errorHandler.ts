import type { Request, Response } from "express"
import { logger } from "../utils/logger.js"

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: any
) {
  const requestId = (req as any).requestId || "unknown"
  const status = err.status || err.statusCode || 500
  
  // Log error with context
  logger.error({
    requestId,
    event: "error",
    error: err.message || "Unknown error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    method: req.method,
    path: req.path,
    status,
  })

  // Structured error response
  const errorResponse: any = {
    error: true,
    message: status >= 500 ? "Internal server error" : err.message || "Bad request",
    requestId,
  }

  // Include details in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.details = err.message
    if (err.validationErrors) {
      errorResponse.validationErrors = err.validationErrors
    }
  }

  res.status(status).json(errorResponse)
}

