import { Router, type Request, type Response } from "express"
import { register } from "../utils/metrics.js"

const router = Router()

router.get("/", async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", register.contentType)
  const metrics = await register.metrics()
  res.send(metrics)
})

export default router

