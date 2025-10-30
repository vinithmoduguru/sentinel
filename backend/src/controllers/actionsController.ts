import type { NextFunction, Request, Response } from "express"
import { z } from "zod"
import {
  handleFreezeCard,
  handleOpenDispute,
  handleContactCustomer,
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

const contactCustomerSchema = z.object({
  customerId: z.number(),
  caseId: z.number().optional(),
  channel: z.enum(["email", "sms", "push"]).default("email"),
  message: z.string().optional(),
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
      role: req.auth?.role,
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
      role: req.auth?.role,
    })
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const contactCustomerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = contactCustomerSchema.parse(req.body)
    const result = await handleContactCustomer(body, {
      requestId: String(req.headers["x-request-id"] || ""),
      role: req.auth?.role,
    })
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
