import express, { type Request, type Response } from "express"
import dotenv from "dotenv"
import ingestRoutes from "./routes/ingest.js"
import customerRoutes from "./routes/customer.js"
import triageRoutes from "./routes/triage.routes.js"
import kbRoutes from "./routes/kb.routes.js"
import actionRoutes from "./routes/actions.routes.js"
import dashboardRoutes from "./routes/dashboard.routes.js"
import alertsRoutes from "./routes/alerts.routes.js"
import evalsRoutes from "./routes/evals.routes.js"
// import { errorHandler } from "./middleware/errorHandler.js"
import rateLimiter from "./middleware/rateLimiter.js"

// Load environment variables
dotenv.config()

// Initialize Express app
const app = express()

// Trust proxy for correct IPs behind proxies
app.set("trust proxy", 1)

// Rate limiter (global)
app.use(rateLimiter())

// CORS for front-end dev (Vite default: 5173)
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173"
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  )
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, X-API-Key, Idempotency-Key, X-Request-Id"
  )
  res.header("Access-Control-Expose-Headers", "Retry-After")
  res.header("Access-Control-Allow-Credentials", "true")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  next()
})

// Middleware for JSON body parsing
app.use(express.json())

// Health check routes
app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.get("/healthz", (_req: Request, res: Response) => {
  res.sendStatus(200)
})

// Dev-only endpoint to test rate limiter
if (process.env.NODE_ENV !== "production") {
  app.get("/_rate_test", (_req: Request, res: Response) => {
    res.json({ ok: true })
  })
}

// API Routes
app.use("/api/ingest", ingestRoutes)
app.use("/api/triage", triageRoutes)
app.use("/api/kb", kbRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/alerts", alertsRoutes)
app.use("/api/evals", evalsRoutes)
app.use("/api", customerRoutes)
app.use("/api/action", actionRoutes)

// Error handling middleware (must be last)
// app.use(errorHandler)

export default app
