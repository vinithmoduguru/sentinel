import type { Request, Response } from "express"
import { z } from "zod"
import { kb } from "../agents/kb.agent.js"
import { v4 as uuid } from "uuid"

const kbSearchSchema = z.object({
  q: z.string().min(1, "Query parameter 'q' is required"),
})

export const getKbSearchHandler = async (req: Request, res: Response) => {
  try {
    const { q } = kbSearchSchema.parse(req.query)
    const runId = uuid()

    // Call kb agent directly
    const result = await kb({
      runId,
      customerId: "system", // KB search is not customer-specific
      context: { query: q },
    })

    if (!result.ok) {
      return res.status(500).json({
        error: result.error || "Failed to search knowledge base",
      })
    }

    // Return the data from the agent (matches spec format)
    res.json({
      results: result.data?.results || [],
      runId,
    })
  } catch (err: any) {
    res.status(400).json({
      error: err.message || "Invalid request",
    })
  }
}
