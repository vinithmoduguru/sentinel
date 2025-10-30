import { Router } from "express"
import { getAlertsHandler } from "../controllers/alertsController.js"

const router = Router()

// GET /api/alerts
router.get("/", getAlertsHandler)

export default router
