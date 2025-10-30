import { Router } from "express"
import {
  openDisputeHandler,
  freezeCardHandler,
} from "../controllers/actionsController.js"
import { idempotency } from "../middleware/idempotency.js"

const router = Router()

// POST /api/action/freeze-card - Freeze a card with optional OTP flow
router.post("/freeze-card", idempotency("freeze-card"), freezeCardHandler)

// POST /api/action/open-dispute - Open a dispute case for a transaction
router.post("/open-dispute", idempotency("open-dispute"), openDisputeHandler)

export default router
