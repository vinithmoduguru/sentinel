import { Router } from "express"
import { ingestTransactionsHandler } from "../controllers/ingestController.js"

const router = Router()

// POST /api/ingest/transactions - Upsert transactions with deduplication
router.post("/transactions", ingestTransactionsHandler)

export default router
