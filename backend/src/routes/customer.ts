import { Router } from "express"
import { getCustomerTransactionsHandler } from "../controllers/customerTransactionsController.js"
import { getInsightsSummaryHandler } from "../controllers/insightsController.js"

const router = Router()

// GET /api/customer/:id/transactions - Keyset paginated list of transactions for customer
router.get("/customer/:id/transactions", getCustomerTransactionsHandler)

// GET /api/insights/:id/summary - Customer insights summary (categories, merchants, trends, anomalies)
router.get("/insights/:id/summary", getInsightsSummaryHandler)

export default router
