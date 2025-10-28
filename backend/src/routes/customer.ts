import { Router } from "express"
import { getCustomerTransactionsHandler } from "../controllers/customerTransactionsController.js"

const router = Router()

// GET /api/customer/:id/transactions - Keyset paginated list of transactions for customer
router.get("/customer/:id/transactions", getCustomerTransactionsHandler)

export default router
