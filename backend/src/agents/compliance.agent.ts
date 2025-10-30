import type { AgentFn } from "../orchestrator/agent.interface.js"

export const compliance: AgentFn = async (input) => {
  const start = Date.now()
  const profile = input.context?.profile
  const kyc = profile?.kyc_level || "UNKNOWN"
  const risk = kyc === "FULL" ? "LOW" : kyc === "PARTIAL" ? "MEDIUM" : "HIGH"

  return {
    ok: true,
    durationMs: Date.now() - start,
    data: {
      kycLevel: kyc,
      risk,
    },
  }
}
