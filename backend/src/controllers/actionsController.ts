import type { NextFunction, Request, Response } from "express"
import { z } from "zod"
import {
  handleFreezeCard,
  handleOpenDispute,
} from "../services/actionService.js"

const freezeCardSchema = z.object({
  cardId: z.number(),
  otp: z.string().optional(),
})

const openDisputeSchema = z.object({
  txnId: z.number(),
  reasonCode: z.string(),
  confirm: z.boolean().default(false),
})

export const freezeCardHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = freezeCardSchema.parse(req.body)
    const result = await handleFreezeCard(body, {
      requestId: String(req.headers["x-request-id"] || ""),
    })
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const openDisputeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = openDisputeSchema.parse(req.body)
    const result = await handleOpenDispute(body, {
      requestId: String(req.headers["x-request-id"] || ""),
    })
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
