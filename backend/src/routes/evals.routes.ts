import { Router } from "express"
import { listEvalsHandler, runEvalsHandler } from "../controllers/evalsController.js"

const router = Router()

router.get("/", listEvalsHandler)
router.post("/run", runEvalsHandler)

export default router


