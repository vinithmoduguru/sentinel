import type { Request, Response } from "express"
import { customerIdParamSchema } from "../schemas/customerTransactions.schema.js"
import { insights } from "../agents/insights.agent.js"
import { v4 as uuid } from "uuid"

export const getInsightsSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = customerIdParamSchema.parse(req.params)
    const runId = uuid()

    // Call insights agent directly
    const result = await insights({
      runId,
      customerId: id.toString(),
      context: {},
    })

    if (!result.ok) {
      return res.status(500).json({
        error: result.error || "Failed to generate insights",
      })
    }

    // Return the data from the agent (matches spec format)
    res.json({
      ...result.data,
      runId,
    })
  } catch (err: any) {
    res.status(400).json({
      error: err.message || "Invalid request",
    })
  }
}
