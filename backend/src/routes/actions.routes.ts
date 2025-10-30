import { Router } from "express"
import {
  openDisputeHandler,
  freezeCardHandler,
  contactCustomerHandler,
} from "../controllers/actionsController.js"
import { idempotency } from "../middleware/idempotency.js"
import { apiKeyAuth, requireRole } from "../middleware/apiKey.js"

const router = Router()

// Protect actions with API key auth only
router.use(apiKeyAuth)

// POST /api/action/freeze-card - Freeze a card with optional OTP flow
router.post(
  "/freeze-card",
  requireRole("agent"),
  idempotency("freeze-card"),
  freezeCardHandler
)

// POST /api/action/open-dispute - Open a dispute case for a transaction
router.post(
  "/open-dispute",
  requireRole("agent"),
  idempotency("open-dispute"),
  openDisputeHandler
)

// POST /api/action/contact-customer - Contact customer via email/SMS
router.post(
  "/contact-customer",
  requireRole("agent"),
  idempotency("contact-customer"),
  contactCustomerHandler
)

export default router
