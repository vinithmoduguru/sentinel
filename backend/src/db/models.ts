export async function writeTrace(runId: string, agent: string, result: any) {
  // TODO: persist to PostgreSQL agent_traces table
  // For now, just log
  console.log(`[TRACE] runId=${runId}, agent=${agent}`, result)
}
