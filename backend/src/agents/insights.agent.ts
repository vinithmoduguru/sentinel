import type { AgentFn } from "../orchestrator/agent.interface.js"
import { logger } from "../utils/logger.js"
import { redactor } from "../utils/redactor.js"
import prisma from "../config/database.js"
import { getCategoryFromMCC } from "../utils/mccMapping.js"

type InsightsOutput = {
  topMerchants: Array<{ merchant: string; count: number }>
  categories: Array<{ name: string; pct: number }>
  monthlyTrend: Array<{ month: string; sum: number }>
  anomalies: Array<{ ts: string; z: number; note: string }>
  summary?: string
}

export const insights: AgentFn = async (input) => {
  const start = Date.now()
  const customerId = parseInt(input.customerId, 10)

  if (isNaN(customerId)) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: "Invalid customerId",
    }
  }

  try {
    // Query transactions from database (default to last 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const txns = await prisma.transaction.findMany({
      where: {
        customer_id: customerId,
        ts: {
          gte: ninetyDaysAgo,
        },
      },
      orderBy: {
        ts: "desc",
      },
    })

    if (txns.length === 0) {
      return {
        ok: true,
        durationMs: Date.now() - start,
        data: {
          topMerchants: [],
          categories: [],
          monthlyTrend: [],
          anomalies: [],
          summary: "No transaction data available for analysis.",
        },
      }
    }

    // 1. Top Merchants: Group by merchant, count, sort desc, take top 10
    const merchantCounts = txns.reduce(
      (acc, txn) => {
        acc[txn.merchant] = (acc[txn.merchant] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const topMerchants = Object.entries(merchantCounts)
      .map(([merchant, count]) => ({ merchant, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 2. Categories: Group by MCC → category, calculate percentage of total spend
    const categorySpend = txns.reduce(
      (acc, txn) => {
        const category = getCategoryFromMCC(txn.mcc)
        acc[category] = (acc[category] || 0) + txn.amount_cents
        return acc
      },
      {} as Record<string, number>
    )

    const totalSpend = txns.reduce((sum, txn) => sum + txn.amount_cents, 0)
    const categories = Object.entries(categorySpend)
      .map(([name, spend]) => ({
        name,
        pct: totalSpend > 0 ? spend / totalSpend : 0,
      }))
      .sort((a, b) => b.pct - a.pct)

    // 3. Monthly Trend: Aggregate by month (YYYY-MM format), sum amount_cents
    const monthlySpend = txns.reduce(
      (acc, txn) => {
        const month = txn.ts.toISOString().slice(0, 7) // YYYY-MM
        acc[month] = (acc[month] || 0) + txn.amount_cents
        return acc
      },
      {} as Record<string, number>
    )

    const monthlyTrend = Object.entries(monthlySpend)
      .map(([month, sum]) => ({ month, sum }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // 4. Anomalies: Calculate Z-score for daily spend amounts, flag spikes where |z| > 2.5
    // Group transactions by day and calculate daily totals
    const dailyTotals = txns.reduce(
      (acc, txn) => {
        const day = txn.ts.toISOString().slice(0, 10) // YYYY-MM-DD
        acc[day] = (acc[day] || 0) + txn.amount_cents
        return acc
      },
      {} as Record<string, number>
    )

    const dailyValues = Object.values(dailyTotals)

    let anomalies: Array<{ ts: string; z: number; note: string }> = []

    if (dailyValues.length > 1) {
      // Calculate mean and standard deviation
      const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
      const variance =
        dailyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        dailyValues.length
      const stdDev = Math.sqrt(variance)

      // Calculate Z-scores and identify anomalies
      anomalies = Object.entries(dailyTotals)
        .map(([ts, amount]) => {
          const z = stdDev > 0 ? (amount - mean) / stdDev : 0
          return { ts, amount, z }
        })
        .filter((item) => Math.abs(item.z) > 2.5)
        .map((item) => ({
          ts: item.ts,
          z: Math.round(item.z * 100) / 100, // Round to 2 decimal places
          note: item.z > 0 ? "spike" : "dip",
        }))
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    }

    const baseOutput: InsightsOutput = {
      topMerchants,
      categories,
      monthlyTrend,
      anomalies,
    }

    // 5. Optional LLM explanation
    let summary: string | undefined
    if (process.env.USE_LLM === "true") {
      try {
        const prompt = `
        You are a financial insights analyst. Provide a concise 1-2 sentence summary 
        explaining the customer's spending patterns based on the following data.
        Respond in JSON: {"summary": "..."}.

        Data:
        ${JSON.stringify(redactor(baseOutput))}
        `
        // TODO: Add actual LLM call when OpenAI client is available
        summary = `Customer shows ${
          topMerchants.length > 0
            ? `primary spending at ${topMerchants[0]?.merchant}`
            : "diverse spending"
        }, with ${categories[0]?.name || "various"} categories representing ${
          categories[0] ? Math.round(categories[0].pct * 100) : 0
        }% of spending. ${
          anomalies.length > 0
            ? `Detected ${anomalies.length} spending anomaly/anomalies.`
            : "Spending patterns appear consistent."
        }`
      } catch (err) {
        logger.warn({
          agent: "insights",
          event: "llm_fallback",
          error: (err as Error).message,
        })
        summary = generateDeterministicSummary(baseOutput)
      }
    } else {
      summary = generateDeterministicSummary(baseOutput)
    }

    return {
      ok: true,
      durationMs: Date.now() - start,
      data: { ...baseOutput, summary },
    }
  } catch (err: any) {
    logger.error({
      runId: input.runId,
      agent: "insights",
      event: "agent_error",
      error: err.message,
    })
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: err.message,
    }
  }
}

function generateDeterministicSummary(output: InsightsOutput): string {
  const parts: string[] = []

  if (output.topMerchants.length > 0) {
    parts.push(
      `Top merchant: ${output.topMerchants[0]?.merchant} (${
        output.topMerchants[0]?.count
      } transactions)`
    )
  }

  if (output.categories.length > 0) {
    const topCategory = output.categories[0]
    if (topCategory) {
      parts.push(
        `Primary category: ${topCategory.name} (${Math.round(topCategory.pct * 100)}%)`
      )
    }
  }

  if (output.monthlyTrend.length > 0) {
    const recentMonth = output.monthlyTrend[output.monthlyTrend.length - 1]
    parts.push(
      `Recent monthly spend: ${recentMonth?.month} - ₹${(recentMonth?.sum || 0) / 100}`
    )
  }

  if (output.anomalies.length > 0) {
    parts.push(`Detected ${output.anomalies.length} spending anomaly/anomalies`)
  } else {
    parts.push("Spending patterns appear consistent")
  }

  return parts.join(". ") + "."
}
