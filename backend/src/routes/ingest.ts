import { Router } from "express"
import { ingestTransactionsHandler } from "../controllers/ingestController.js"
import { idempotency } from "../middleware/idempotency.js"

const router = Router()

// POST /api/ingest/transactions - Upsert transactions with deduplication
router.post(
  "/transactions",
  idempotency("ingest-transactions"),
  ingestTransactionsHandler
)

export default router
