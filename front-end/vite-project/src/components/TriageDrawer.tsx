import { useMemo } from "react"
import { useTriageStream, type TriageEvent } from "@/hooks/useTriageStream"
import { Button } from "@/components/ui/button"
import ActionsPanel from "./ActionsPanel"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import LiveRegion from "@/components/LiveRegion"

type Props = { runId?: string; customerId?: number; onClose: () => void }

export function TriageDrawer({ runId, customerId, onClose }: Props) {
  const { events } = useTriageStream(runId)
  const final = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]
      if (ev && ev.type === "decision_finalized") return ev
    }
    return undefined
  }, [events])
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

  return (
    <Dialog open={!!runId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Triage Run</h2>
            {lastRisk?.risk && (
              <span className="text-xs uppercase tracking-wide rounded-full bg-muted px-2 py-0.5">
                {String(lastRisk.risk).toUpperCase()}
              </span>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogHeader>
        <div className="space-y-3">
          <LiveRegion text={liveText} />
          {lastRisk && (
            <div className="mb-3 text-sm">
              <div className="font-medium">
                Risk: {String(lastRisk.risk).toUpperCase()}
              </div>
              {Array.isArray(lastRisk.reasons) &&
                lastRisk.reasons.length > 0 && (
                  <ul className="list-disc ml-5">
                    {lastRisk.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              {lastRisk.action && (
                <div className="mt-1 text-muted-foreground">
                  Recommended: {lastRisk.action}
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            {events.map((e: TriageEvent, idx: number) => (
              <div key={idx} className="rounded border p-2 text-sm">
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span>{formatEventTitle(e)}</span>
                  {typeof e.detail?.durationMs === "number" && (
                    <span className="text-xs text-muted-foreground">
                      {e.detail.durationMs} ms
                    </span>
                  )}
                </div>
                {e.error && <div className="text-red-600">{e.error}</div>}
                {renderEventBody(e)}
              </div>
            ))}
          </div>
          {final && (
            <div className="mt-4 text-sm text-muted-foreground">
              Decision finalized
            </div>
          )}
          <div className="mt-4">
            <ActionsPanel customerId={customerId ?? 0} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatEventTitle(e: TriageEvent): string {
  if (e.type === "tool_update") {
    const status = e.ok ? "ok" : "error"
    return `${e.step ?? "tool"} · ${status}`
  }
  return e.type
}

function renderEventBody(e: TriageEvent) {
  const d = e.detail?.data || e.detail
  if (e.type === "tool_update") {
    switch (e.step) {
      case "riskSignals": {
        const risk = d?.risk
        const score = d?.score
        const reasons: string[] = d?.reasons || []
        const rec = d?.recommendedAction
        return (
          <div className="text-xs text-muted-foreground mt-1">
            Risk {String(risk).toUpperCase()} (score {score}).{" "}
            {reasons.length ? `Reasons: ${reasons.join(", ")}. ` : ""}
            {rec ? `Recommended: ${rec}.` : ""}
          </div>
        )
      }
      case "insights": {
        const summary = d?.summary
        return summary ? (
          <div className="text-xs text-muted-foreground mt-1">{summary}</div>
        ) : null
      }
      case "kbLookup": {
        const results = d?.results || []
        const summary = d?.summary
        return (
          <div className="text-xs text-muted-foreground mt-1">
            {summary || `${results.length} KB results`}
          </div>
        )
      }
      case "compliance": {
        const kyc = d?.kycLevel
        const risk = d?.risk
        return (
          <div className="text-xs text-muted-foreground mt-1">
            Compliance: KYC {kyc} (risk {risk}).
          </div>
        )
      }
      default:
        break
    }
  }
  // fallback: compact JSON
  return d ? (
    <div className="text-xs text-muted-foreground mt-1">
      {typeof d === "string" ? d : JSON.stringify(d)}
    </div>
  ) : null
}

export default TriageDrawer
