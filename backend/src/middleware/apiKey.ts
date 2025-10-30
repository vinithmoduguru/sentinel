import type { NextFunction, Request, Response } from "express"
import { logger } from "../utils/logger.js"

type Role = "agent" | "lead"

const AGENT_KEY = process.env.AGENT_API_KEY
const LEAD_KEY = process.env.LEAD_API_KEY

declare module "express-serve-static-core" {
  interface Request {
    auth?: { role: Role }
  }
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.header("X-API-Key") || req.header("x-api-key")
  if (!key) return res.status(401).json({ error: "Missing API key" })

  let role: Role | null = null
  console.log({ key, AGENT_KEY, LEAD_KEY })
  if (AGENT_KEY && key === AGENT_KEY) role = "agent"
  if (LEAD_KEY && key === LEAD_KEY) role = "lead"

  if (!role) return res.status(401).json({ error: "Invalid API key" })

  req.auth = { role }
  return next()
}

export function requireRole(required: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.auth?.role
    if (!role) return res.status(401).json({ error: "Unauthenticated" })
    if (required === "lead" && role !== "lead") {
      return res.status(403).json({ error: "Forbidden: lead role required" })
    }
    next()
  }
}
