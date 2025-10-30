import { appendAgentTrace } from "../services/triageService.js"

export async function writeTrace(runId: number, agent: string, result: any) {
  await appendAgentTrace(runId, agent, result)
}
