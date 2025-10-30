const API_BASE =
  (import.meta.env?.VITE_API_BASE as string | undefined) ||
  "http://localhost:4000"
const API_KEY = (import.meta.env?.VITE_API_KEY as string | undefined) || ""

function generateIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export async function apiFetch<T>(
  path: string,
  options: {
    method?: HttpMethod
    body?: unknown
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  }
  const mergedHeaders = options.headers
    ? { ...baseHeaders, ...options.headers }
    : baseHeaders
  const fetchInit: RequestInit = {
    method: options.method || "GET",
    headers: mergedHeaders,
  }
  if (options.body !== undefined) {
    fetchInit.body = JSON.stringify(options.body)
  }
  const res = await fetch(url, {
    ...fetchInit,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export type StartTriageBody = {
  alertId: number
  customerId: number
  context?: Record<string, unknown>
}

export async function startTriage(
  body: StartTriageBody
): Promise<{ runId: string }> {
  return apiFetch<{ runId: string }>(`/api/triage`, { method: "POST", body })
}

export function connectTriageStream<T = unknown>(
  runId: string,
  onEvent: (ev: T) => void
): () => void {
  const url = `${API_BASE}/api/triage/${encodeURIComponent(runId)}/stream`
  const es = new EventSource(url)
  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as T
      onEvent(data)
    } catch {
      // ignore
    }
  }
  es.onerror = () => {
    es.close()
  }
  return () => es.close()
}

export async function freezeCard(
  payload: { cardId: number; otp?: string },
  headers?: Record<string, string>
) {
  const extra: Record<string, string> = {
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
    "Idempotency-Key": generateIdempotencyKey(),
    ...(headers || {}),
  }
  return apiFetch(`/api/action/freeze-card`, {
    method: "POST",
    body: payload,
    headers: extra,
  })
}

export async function openDispute(
  payload: { txnId: number; reasonCode: string; confirm: boolean },
  headers?: Record<string, string>
) {
  const extra: Record<string, string> = {
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
    "Idempotency-Key": generateIdempotencyKey(),
    ...(headers || {}),
  }
  return apiFetch(`/api/action/open-dispute`, {
    method: "POST",
    body: payload,
    headers: extra,
  })
}

export async function getDashboardKpis() {
  return apiFetch<DashboardKpisResponse>(`/api/dashboard/kpis`)
}

export async function listAlerts(params?: Record<string, string | number>) {
  const qs = params
    ? `?${new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString()}`
    : ""
  return apiFetch(`/api/alerts${qs}`)
}

export async function listCustomerTx(
  customerId: number,
  params?: Record<string, string | number>
): Promise<CustomerTransactionsResponse> {
  const qs = params
    ? `?${new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString()}`
    : ""
  return apiFetch(`/api/customer/${customerId}/transactions${qs}`)
}

export async function getInsights(customerId: number) {
  return apiFetch<CustomerInsightsSummary>(
    `/api/insights/${customerId}/summary`
  )
}

export type DashboardKpisResponse = {
  alertsInQueue: number
  disputesOpen: number
  triageLatencyMs: { p50: number; p95: number }
  triageRuns24h: number
  fallbackRate24h: number
  actions24h: number
  alerts7d: Array<{ day: string; count: number }>
  triage7d: Array<{ day: string; count: number }>
}

export type CustomerTransaction = {
  id: number
  merchant: string
  mcc: string
  amount_cents: number
  currency: string
  ts: string
  card_id?: number | null
}

export type CustomerTransactionsResponse = {
  items: CustomerTransaction[]
  nextCursor?: string
}

export type CustomerInsightsSummary = {
  topMerchants: Array<{ merchant: string; count: number }>
  categories: Array<{ name: string; pct: number }>
  monthlyTrend: Array<{ month: string; sum: number }>
  anomalies: Array<{ ts: string; z: number; note: string }>
  summary?: string
}

export type EvalSummary = {
  name: string
  total: number
  passed: number
  passRate: number
  file: string
}

export async function listEvals(): Promise<{ items: EvalSummary[] }> {
  return apiFetch(`/api/evals`)
}

export type EvalRunResult = {
  results: Array<{
    file: string
    id: string
    category: string
    passed?: boolean
    skipped?: boolean
    error?: string
  }>
  totals: { total: number; passed: number; failed: number; skipped: number }
}

export async function runEvals(): Promise<EvalRunResult> {
  return apiFetch(`/api/evals/run`, { method: "POST" })
}
