import express, { type Request, type Response } from "express"
import dotenv from "dotenv"
import ingestRoutes from "./routes/ingest.js"
import customerRoutes from "./routes/customer.js"
// import { errorHandler } from "./middleware/errorHandler.js"

// Load environment variables
dotenv.config()

// Initialize Express app
const app = express()

// Middleware for JSON body parsing
app.use(express.json())

// Health check routes
app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.get("/healthz", (_req: Request, res: Response) => {
  res.sendStatus(200)
})

// API Routes
app.use("/api/ingest", ingestRoutes)
app.use("/api", customerRoutes)

// Error handling middleware (must be last)
// app.use(errorHandler)

export default app
