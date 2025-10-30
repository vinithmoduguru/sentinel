import { useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { listAlerts, startTriage } from "@/lib/api"
import TriageDrawer from "@/components/TriageDrawer"
import Badge from "@/components/ui/badge"
import Skeleton from "@/components/ui/skeleton"

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [runId, setRunId] = useState<string | undefined>()
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    number | undefined
  >()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    risk: "",
    status: "OPEN", // Default to showing open alerts
    from: "",
    to: "",
  })

  const fetchAlerts = async (reset = false) => {
    if (reset) {
      setLoading(true)
      setNextCursor(null)
    }

    const params: Record<string, string> = {}
    if (filters.risk) params.risk = filters.risk.toLowerCase()
    if (filters.status) params.status = filters.status
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    if (!reset && nextCursor) params.cursor = nextCursor

    try {
      if (!reset) setLoadingMore(true)
      const res: any = await listAlerts(params)
      setAlerts((prev) =>
        reset ? res.items || [] : [...prev, ...(res.items || [])]
      )
      setNextCursor(res.nextCursor || null)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchAlerts(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.risk, filters.status, filters.from, filters.to])

  const openTriage = async (alert: any) => {
    try {
      const cid = alert.customer?.id ?? alert.customer_id
      const body = { alertId: alert.id, customerId: cid, context: {} }
      const { runId } = await startTriage(body)
      setRunId(runId)
      setSelectedCustomerId(cid)
      setDrawerOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start triage"
      alert(`Error starting triage: ${message}`)
      console.error("Triage start error:", error)
    }
  }

  const parentRef = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: alerts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 6,
  })

  const hasFilters =
    filters.risk || filters.status || filters.from || filters.to

  const filterControls = useMemo(
    () => (
      <div className="bg-muted/30 border rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="status-filter">
              Status
            </label>
            <select
              id="status-filter"
              className="border rounded-md px-3 py-2 text-sm bg-background min-w-[140px]"
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value }))
              }>
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="risk-filter">
              Risk Level
            </label>
            <select
              id="risk-filter"
              className="border rounded-md px-3 py-2 text-sm bg-background min-w-[140px]"
              value={filters.risk}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, risk: e.target.value }))
              }>
              <option value="">All Levels</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="from-filter">
              From Date
            </label>
            <input
              id="from-filter"
              type="date"
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={filters.from}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, from: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="to-filter">
              To Date
            </label>
            <input
              id="to-filter"
              type="date"
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={filters.to}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, to: e.target.value }))
              }
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setFilters({ risk: "", status: "OPEN", from: "", to: "" })
            }
            disabled={!hasFilters}
            className="h-9">
            Reset Filters
          </Button>
        </div>
      </div>
    ),
    [filters, hasFilters]
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Alerts</h1>
      {filterControls}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="border rounded p-6 text-sm text-muted-foreground">
          No alerts match the selected filters.
        </div>
      ) : (
        <div className="border rounded overflow-hidden">
          <div className="grid grid-cols-[80px_140px_100px_180px_minmax(200px,1fr)_110px_140px] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground items-center">
            <span>ID</span>
            <span>Created</span>
            <span>Risk</span>
            <span>Customer</span>
            <span>Transaction</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          <div ref={parentRef} className="relative max-h-[480px] overflow-auto">
            <div
              style={{ height: rowVirtualizer.getTotalSize() }}
              className="relative">
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const alert = alerts[virtualRow.index]
                return (
                  <div
                    key={alert.id}
                    className="grid grid-cols-[80px_140px_100px_180px_minmax(200px,1fr)_110px_140px] gap-3 border-b px-4 py-3 text-sm items-center"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}>
                    <span className="font-mono text-xs text-muted-foreground">
                      #{alert.id}
                    </span>
                    <span
                      className="truncate"
                      title={formatTimestamp(
                        alert.createdAt || alert.created_at
                      )}>
                      {formatTimestamp(alert.createdAt || alert.created_at)}
                    </span>
                    <div className="flex items-center">
                      <Badge variant={riskToVariant(alert.risk)}>
                        {String(alert.risk).toUpperCase()}
                      </Badge>
                    </div>
                    <span
                      className="truncate"
                      title={alert.customer?.name || alert.customer_id || "—"}>
                      {typeof alert.customer?.id === "number" ? (
                        <Link
                          to={`/customer/${alert.customer.id}`}
                          className="hover:underline text-primary flex items-center gap-1.5">
                          {alert.customer?.name ||
                            `Customer ${alert.customer.id}`}
                          <svg
                            className="h-3.5 w-3.5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </Link>
                      ) : (
                        alert.customer?.name || alert.customer_id || "—"
                      )}
                    </span>
                    <span
                      className="text-muted-foreground truncate"
                      title={
                        alert.transaction
                          ? `${alert.transaction.merchant} • ${formatCurrency(
                              alert.transaction.amountCents,
                              alert.transaction.currency
                            )}`
                          : ""
                      }>
                      {alert.transaction
                        ? `${alert.transaction.merchant} • ${formatCurrency(
                            alert.transaction.amountCents,
                            alert.transaction.currency
                          )}`
                        : "—"}
                    </span>
                    <span className="truncate">{alert.status}</span>
                    <div className="flex items-center">
                      <Button
                        size="sm"
                        onClick={() => openTriage(alert)}
                        disabled={alert.canOpenTriage === false}
                        title={alert.canOpenTriage === false ? "Triage not available for this alert" : "Start triage analysis"}>
                        Open Triage
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex justify-between items-center px-3 py-2 text-xs text-muted-foreground">
            <span>{alerts.length} alerts loaded</span>
            {nextCursor ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchAlerts(false)}
                disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            ) : (
              <span>No more alerts</span>
            )}
          </div>
        </div>
      )}
      {drawerOpen && (
        <TriageDrawer
          runId={runId}
          customerId={selectedCustomerId}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}

function riskToVariant(
  risk: any
): "success" | "warning" | "destructive" | "default" {
  const r = String(risk || "").toUpperCase()
  if (r === "LOW") return "success"
  if (r === "MEDIUM") return "warning"
  if (r === "HIGH") return "destructive"
  return "default"
}

function formatTimestamp(value: string | Date | undefined) {
  if (!value) return "—"
  const dt = typeof value === "string" ? new Date(value) : value
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCurrency(
  cents: number | undefined,
  currency: string | undefined
) {
  if (cents === undefined) return "—"
  const amount = cents / 100
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "INR",
    minimumFractionDigits: 2,
  }).format(amount)
}
