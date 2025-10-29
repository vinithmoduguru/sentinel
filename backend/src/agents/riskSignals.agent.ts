import type { Transaction } from "@prisma/client"
import type { AgentFn } from "../orchestrator/agent.interface.js"
import { logger } from "../utils/logger.js"
import { redactor } from "../utils/redactor.js"
// import { openai } from "../utils/openai"; // optional wrapper, create later

type RiskSignalsOutput = {
  risk: "low" | "medium" | "high"
  score: number
  reasons: string[]
  recommendedAction: "freeze" | "dispute" | "monitor"
  summary?: string
}

export const riskSignals: AgentFn = async (input) => {
  const start = Date.now()
  const txns: Transaction[] = input.context?.recentTransactions || []
  const devices = input.context?.devices || []
  const chargebacks = input.context?.chargebacks || []
  const profile = input.context?.profile

  if (!txns.length) {
    return {
      ok: true,
      durationMs: Date.now() - start,
      data: {
        risk: "low",
        score: 0,
        reasons: ["no recent activity"],
        recommendedAction: "monitor",
      },
    }
  }

  const reasons: string[] = []
  let score = 0

  // --- 1️⃣ Velocity check (multiple txns in <5 min)
  const sorted = txns.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  )
  const first = sorted[0]!
  const burst = sorted.slice(0, 5)
  if (burst.length >= 3) {
    const t0 = burst[0]
    const t1 = burst[1]
    if (
      t0 &&
      t1 &&
      new Date(t0.ts).getTime() - new Date(t1.ts).getTime() < 5 * 60 * 1000
    ) {
      reasons.push("Unusual high-velocity spending")
      score += 30
    }
  }

  // --- 2️⃣ Amount spike
  const avg =
    txns.slice(5, 30).reduce((a, t) => a + t.amount_cents, 0) /
    Math.max(1, txns.length - 5)
  if (first.amount_cents > avg * 3) {
    reasons.push("Transaction amount spike vs average")
    score += 20
  }

  // --- 3️⃣ Device anomaly
  if (first.device_id && !devices.some((d: any) => d.id === first.device_id)) {
    reasons.push("Transaction from new device")
    score += 15
  }

  // --- 4️⃣ Country mismatch
  if (
    profile &&
    first.country &&
    profile.country &&
    first.country !== profile.country
  ) {
    reasons.push("Transaction from foreign country")
    score += 20
  }

  // --- 5️⃣ Rare MCC
  const mccCounts = txns.reduce(
    (acc, t) => {
      acc[t.mcc] = (acc[t.mcc] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  const rare = Object.entries(mccCounts).find(
    ([_, count]) => count / txns.length < 0.005
  )
  if (rare) {
    reasons.push(`Rare merchant category: ${rare[0]}`)
    score += 10
  }

  // --- 6️⃣ Prior chargeback
  if (chargebacks.length) {
    reasons.push("Customer has prior chargeback history")
    score += 25
  }

  // --- Normalize & classify
  const riskLevel = score >= 60 ? "high" : score >= 30 ? "medium" : "low"
  const recommendedAction =
    riskLevel === "high"
      ? "freeze"
      : riskLevel === "medium"
        ? "monitor"
        : "dispute"

  const baseOutput: RiskSignalsOutput = {
    risk: riskLevel,
    score,
    reasons,
    recommendedAction,
  }

  // --- 7️⃣ (Optional) LLM explanation
  let summary: string | undefined
  if (process.env.USE_LLM === "true") {
    try {
      const prompt = `
      You are a financial risk analyst. Explain the reasoning for the following structured decision.
      Respond in 1-2 sentences in JSON: {"summary": "..."}.

      Data:
      ${JSON.stringify(redactor(baseOutput))}
      `
      summary = ""
    } catch (err) {
      logger.warn({
        agent: "riskSignals",
        event: "llm_fallback",
        error: (err as Error).message,
      })
      summary = `Risk ${riskLevel} due to: ${reasons.join(", ")}.`
    }
  } else {
    summary = `Risk ${riskLevel} due to: ${reasons.join(", ")}.`
  }

  return {
    ok: true,
    durationMs: Date.now() - start,
    data: { ...baseOutput, summary },
  }
}
