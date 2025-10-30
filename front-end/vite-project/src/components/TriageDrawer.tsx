import { useEffect, useMemo, useRef } from "react"
import { useTriageStream, type TriageEvent } from "@/hooks/useTriageStream"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import LiveRegion from "@/components/LiveRegion"
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react"
import ActionsPanel from "./ActionsPanel"

type Props = { runId?: string; customerId?: number; onClose: () => void; onFinalized?: () => void }

export function TriageDrawer({ runId, customerId, onClose, onFinalized }: Props) {
  const { events, loading, error } = useTriageStream(runId)
  const final = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]
      if (ev && ev.type === "decision_finalized") return ev
    }
    return undefined
  }, [events])
  const finalizedNotifiedRef = useRef(false)
  useEffect(() => {
    if (final && !finalizedNotifiedRef.current) {
      finalizedNotifiedRef.current = true
      onFinalized?.()
    }
  }, [final, onFinalized])
  // best-effort extraction of current risk/reasons
  const lastRisk = useMemo(() => {
    const rev = [...events].reverse()
    const tool = rev.find(
      (e) =>
        e.type === "tool_update" && e.step === "riskSignals" && e.detail?.ok
    )
    const data = tool?.detail?.data
    return data
      ? {
          risk: data.risk,
          reasons: data.reasons,
          action: data.recommendedAction,
        }
      : null
  }, [events])

  const liveText = lastRisk ? `Risk ${String(lastRisk.risk).toUpperCase()}` : ""

  const getRiskIcon = (risk: string) => {
    const r = String(risk).toUpperCase()
    if (r === "HIGH") return <AlertTriangle className="h-5 w-5 text-red-600" />
    if (r === "MEDIUM")
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />
    return <CheckCircle2 className="h-5 w-5 text-green-600" />
  }

  const getRiskColor = (risk: string) => {
    const r = String(risk).toUpperCase()
    if (r === "HIGH") return "bg-red-50 border-red-200"
    if (r === "MEDIUM") return "bg-yellow-50 border-yellow-200"
    return "bg-green-50 border-green-200"
  }

  return (
    <Dialog open={!!runId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              Triage Analysis
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <LiveRegion text={liveText} />

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">
                  Starting triage analysis...
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">
                    Triage Failed
                  </h3>
                  <p className="text-sm text-red-700">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="mt-3">
                    Close and Retry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && events.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No triage data available yet. Please wait...
              </p>
            </div>
          )}

          {/* Risk Summary Card */}
          {!loading && !error && lastRisk && (
            <div
              className={`rounded-lg border-2 p-4 ${getRiskColor(
                lastRisk.risk
              )}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getRiskIcon(lastRisk.risk)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">
                      Risk Level: {String(lastRisk.risk).toUpperCase()}
                    </h3>
                  </div>
                  {Array.isArray(lastRisk.reasons) &&
                    lastRisk.reasons.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          Detected Issues:
                        </p>
                        <ul className="space-y-1">
                          {lastRisk.reasons.map((r: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  {lastRisk.action && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-medium">
                        💡 Recommended Action:{" "}
                        <span className="text-foreground">
                          {lastRisk.action}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Agent Timeline */}
          {!loading && !error && events.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Analysis Timeline
              </h3>
              {events.map((e: TriageEvent, idx: number) => (
              <div key={idx} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {getEventIcon(e)}
                    <span className="font-medium">{formatEventTitle(e)}</span>
                  </div>
                  {typeof e.detail?.durationMs === "number" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {e.detail.durationMs}ms
                    </span>
                  )}
                </div>
                {e.error && (
                  <div className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {e.error}
                  </div>
                )}
                {renderEventBody(e)}
              </div>
              ))}
            </div>
          )}

          {!loading && !error && final && (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3 text-sm text-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 inline mr-2" />
              <span className="font-medium text-green-900">
                Analysis Complete
              </span>
            </div>
          )}

          {/* Actions Panel */}
          {!loading && !error && events.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <ActionsPanel customerId={customerId ?? 0} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getEventIcon(ev: TriageEvent) {
  if (ev.ok === false) return <XCircle className="h-4 w-4 text-red-500" />
  if (ev.type === "decision_finalized")
    return <CheckCircle2 className="h-4 w-4 text-green-500" />
  return <Clock className="h-4 w-4 text-blue-500" />
}

function formatEventTitle(ev: TriageEvent): string {
  if (ev.type === "plan_update") return "Plan Updated"
  if (ev.type === "tool_update" && ev.step) {
    const stepName = ev.step
    if (stepName === "riskSignals") return "Risk Assessment"
    if (stepName === "kbLookup") return "Knowledge Base Lookup"
    if (stepName === "compliance") return "Compliance Check"
    if (stepName === "insights") return "Customer Insights"
    if (stepName === "proposeAction") return "Action Recommendation"
    return stepName
  }
  if (ev.type === "fallback_triggered") return "Fallback Triggered"
  if (ev.type === "decision_finalized") return "Decision Finalized"
  return ev.type
}

function renderEventBody(ev: TriageEvent) {
  if (!ev.detail || !ev.detail.data) return null
  const data = ev.detail.data

  // Show detailed information for each agent step
  if (ev.step === "riskSignals") {
    return (
      <div className="mt-2 text-xs space-y-1.5 bg-muted/30 p-2 rounded">
        {data.risk && (
          <div>
            <span className="font-medium">Risk Level:</span>{" "}
            {String(data.risk).toUpperCase()}
            {data.score && ` (Score: ${data.score})`}
          </div>
        )}
        {data.reasons &&
          Array.isArray(data.reasons) &&
          data.reasons.length > 0 && (
            <div>
              <span className="font-medium">Reasons:</span>
              <ul className="ml-3 mt-1 space-y-0.5">
                {data.reasons.map((r: string, i: number) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}
        {data.recommendedAction && (
          <div>
            <span className="font-medium">Recommendation:</span>{" "}
            {data.recommendedAction}
          </div>
        )}
      </div>
    )
  }

  if (ev.step === "insights" && data.topMerchants) {
    return (
      <div className="mt-2 text-xs space-y-1.5 bg-muted/30 p-2 rounded">
        <div>
          <span className="font-medium">Top Merchants:</span>{" "}
          {data.topMerchants
            .slice(0, 3)
            .map(
              (m: { merchant: string; count: number }) =>
                `${m.merchant} (${m.count})`
            )
            .join(", ")}
        </div>
        {data.categories && Array.isArray(data.categories) && (
          <div>
            <span className="font-medium">Categories:</span>{" "}
            {data.categories
              .slice(0, 3)
              .map((c: { name: string; pct: number }) => `${c.name} ${c.pct}%`)
              .join(", ")}
          </div>
        )}
        {data.anomalies &&
          Array.isArray(data.anomalies) &&
          data.anomalies.length > 0 && (
            <div className="text-red-600">
              <span className="font-medium">⚠️ Anomalies Detected:</span>{" "}
              {data.anomalies.length} unusual transaction(s)
            </div>
          )}
      </div>
    )
  }

  if (ev.step === "kbLookup") {
    return (
      <div className="mt-2 text-xs space-y-1.5 bg-muted/30 p-2 rounded">
        {data.summary ? (
          <div>{data.summary}</div>
        ) : data.results ? (
          <div>
            Found {Array.isArray(data.results) ? data.results.length : 0}{" "}
            knowledge base article(s)
          </div>
        ) : (
          <div>No relevant KB articles found</div>
        )}
      </div>
    )
  }

  if (ev.step === "compliance") {
    return (
      <div className="mt-2 text-xs space-y-1.5 bg-muted/30 p-2 rounded">
        {data.kycLevel && (
          <div>
            <span className="font-medium">KYC Level:</span> {data.kycLevel}
          </div>
        )}
        {data.risk && (
          <div>
            <span className="font-medium">Compliance Risk:</span>{" "}
            {String(data.risk).toUpperCase()}
          </div>
        )}
        {data.blocked && (
          <div className="text-red-600">
            ⚠️ <span className="font-medium">Action Blocked:</span>{" "}
            {data.reason || "Policy violation"}
          </div>
        )}
      </div>
    )
  }

  if (ev.step === "proposeAction") {
    return (
      <div className="mt-2 text-xs space-y-1.5 bg-muted/30 p-2 rounded">
        {data.summary && <div>{data.summary}</div>}
      </div>
    )
  }

  // Don't show empty data
  return null
}

export default TriageDrawer
