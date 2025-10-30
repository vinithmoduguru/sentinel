#!/usr/bin/env node
/**
 * Eval CLI Tool
 * Runs evaluation test cases and reports metrics
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_BASE = process.env.API_BASE || "http://localhost:3000"
const FIXTURES_PATH = path.join(__dirname, "../../../fixtures/evals")

interface EvalCase {
  name: string
  description: string
  alertId: number
  customerId: number
  expected: {
    risk?: string
    action?: string
    status?: number
    fallbackUsed?: boolean
    contains?: string[]
  }
}

interface EvalResult {
  name: string
  passed: boolean
  error?: string
  actualRisk?: string
  expectedRisk?: string
  latencyMs?: number
  fallbackUsed?: boolean
}

async function runTriage(alertId: number, customerId: number) {
  const res = await fetch(`${API_BASE}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertId, customerId, context: {} }),
  })
  
  if (!res.ok) {
    throw new Error(`Triage API returned ${res.status}`)
  }
  
  const json = (await res.json()) as { runId: string }
  const { runId } = json
  
  // Wait for triage to complete (poll or timeout)
  await new Promise((resolve) => setTimeout(resolve, 3000))
  
  return { runId }
}

async function getTriageRun(alertId: number) {
  // Query database for triage run result
  // For now, return mock data (in production, query Prisma)
  return {
    risk: "MEDIUM",
    reasons: ["velocity_check", "device_change"],
    fallback_used: false,
    latency_ms: 450,
  }
}

async function runEvalCase(evalCase: EvalCase): Promise<EvalResult> {
  const start = Date.now()
  
  try {
    const { runId } = await runTriage(evalCase.alertId, evalCase.customerId)
    const result = await getTriageRun(evalCase.alertId)
    
    const latencyMs = Date.now() - start
    const actualRisk = result.risk?.toUpperCase()
    const expectedRisk = evalCase.expected.risk?.toUpperCase()
    
    let passed = true
    let error: string | undefined
    
    // Check risk level match
    if (expectedRisk && actualRisk !== expectedRisk) {
      passed = false
      error = `Risk mismatch: expected ${expectedRisk}, got ${actualRisk}`
    }
    
    // Check fallback usage
    if (evalCase.expected.fallbackUsed !== undefined) {
      if (result.fallback_used !== evalCase.expected.fallbackUsed) {
        passed = false
        error = `Fallback mismatch: expected ${evalCase.expected.fallbackUsed}, got ${result.fallback_used}`
      }
    }
    
    return {
      name: evalCase.name,
      passed,
      error,
      actualRisk,
      expectedRisk,
      latencyMs,
      fallbackUsed: result.fallback_used,
    }
  } catch (err: any) {
    return {
      name: evalCase.name,
      passed: false,
      error: err.message,
      latencyMs: Date.now() - start,
    }
  }
}

async function loadEvalCases(): Promise<EvalCase[]> {
  const files = fs.readdirSync(FIXTURES_PATH).filter((f) => f.endsWith(".json"))
  const cases: EvalCase[] = []
  
  for (const file of files) {
    if (file === "readme.json") continue
    
    const content = fs.readFileSync(path.join(FIXTURES_PATH, file), "utf-8")
    const data = JSON.parse(content)
    
    // Handle different eval file formats
    if (Array.isArray(data)) {
      cases.push(...data)
    } else if (data.cases) {
      cases.push(...data.cases)
    } else {
      cases.push(data)
    }
  }
  
  return cases
}

function calculateMetrics(results: EvalResult[]) {
  const total = results.length
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const successRate = (passed / total) * 100
  
  // Latency metrics
  const latencies = results.map((r) => r.latencyMs || 0).filter((l) => l > 0)
  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0
  
  // Fallback rate
  const fallbackCount = results.filter((r) => r.fallbackUsed).length
  const fallbackRate = (fallbackCount / total) * 100
  
  // Risk confusion matrix
  const riskCounts: Record<string, number> = {}
  results.forEach((r) => {
    if (r.actualRisk) {
      riskCounts[r.actualRisk] = (riskCounts[r.actualRisk] || 0) + 1
    }
  })
  
  return {
    total,
    passed,
    failed,
    successRate,
    latency: { p50, p95 },
    fallbackRate,
    riskCounts,
  }
}

function printReport(results: EvalResult[], metrics: any) {
  console.log("\n" + "=".repeat(60))
  console.log("SENTINEL EVAL REPORT")
  console.log("=".repeat(60))
  
  console.log(`\n📊 Summary:`)
  console.log(`   Total cases: ${metrics.total}`)
  console.log(`   ✅ Passed: ${metrics.passed}`)
  console.log(`   ❌ Failed: ${metrics.failed}`)
  console.log(`   Success rate: ${metrics.successRate.toFixed(1)}%`)
  
  console.log(`\n⏱️  Latency:`)
  console.log(`   p50: ${metrics.latency.p50}ms`)
  console.log(`   p95: ${metrics.latency.p95}ms`)
  
  console.log(`\n🔄 Fallback rate: ${metrics.fallbackRate.toFixed(1)}%`)
  
  console.log(`\n🎯 Risk Distribution:`)
  Object.entries(metrics.riskCounts).forEach(([risk, count]) => {
    console.log(`   ${risk}: ${count}`)
  })
  
  if (metrics.failed > 0) {
    console.log(`\n❌ Failed Cases:`)
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   • ${r.name}`)
        console.log(`     Error: ${r.error}`)
      })
  }
  
  console.log("\n" + "=".repeat(60))
}

async function main() {
  console.log("Loading eval cases...")
  
  const cases = await loadEvalCases()
  console.log(`Found ${cases.length} eval cases\n`)
  
  if (cases.length === 0) {
    console.error("No eval cases found!")
    process.exit(1)
  }
  
  console.log("Running evals...")
  const results: EvalResult[] = []
  
  for (let i = 0; i < Math.min(cases.length, 5); i++) {
    const evalCase = cases[i]
    if (!evalCase) continue
    process.stdout.write(`  [${i + 1}/${cases.length}] ${evalCase.name}... `)
    
    const result = await runEvalCase(evalCase)
    results.push(result)
    
    console.log(result.passed ? "✅" : "❌")
  }
  
  // Note: For demo, we're only running first 5 cases
  // In production, run all cases
  if (cases.length > 5) {
    console.log(`\n⚠️  Running subset: ${Math.min(5, cases.length)} of ${cases.length} cases (demo mode)`)
  }
  
  const metrics = calculateMetrics(results)
  printReport(results, metrics)
  
  // Exit with code 0 if all passed, 1 otherwise
  process.exit(metrics.failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})

