import { Router } from "express"
import { getDashboardKpisHandler } from "../controllers/dashboardController.js"

const router = Router()

// GET /api/dashboard/kpis - Dashboard KPIs (alerts in queue, disputes open, triage latency percentiles)
router.get("/kpis", getDashboardKpisHandler)

export default router


