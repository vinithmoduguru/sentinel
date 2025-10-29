import { Router } from "express"
import { getKbSearchHandler } from "../controllers/kbController.js"

const router = Router()

// GET /api/kb/search?q=<query>
router.get("/search", getKbSearchHandler)

export default router
