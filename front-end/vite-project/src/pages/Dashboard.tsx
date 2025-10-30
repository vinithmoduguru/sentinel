import { useEffect, useMemo, useState } from "react"
import { getDashboardKpis, type DashboardKpisResponse } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Skeleton from "@/components/ui/skeleton"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKpisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardKpis()
      .then(setKpis)
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false))
  }, [])

  const alertsSpark = useMemo(
    () =>
      (kpis?.alerts7d ?? []).map((entry) => ({
        day: formatDay(entry.day),
        alerts: entry.count,
      })),
    [kpis?.alerts7d]
  )
  const triageSpark = useMemo(
    () =>
      (kpis?.triage7d ?? []).map((entry) => ({
        day: formatDay(entry.day),
        triage: entry.count,
      })),
    [kpis?.triage7d]
  )

  const alertsChartConfig: ChartConfig = {
    alerts: {
      label: "Alerts",
      color: "hsl(var(--chart-1))",
    },
  }

  const triageChartConfig: ChartConfig = {
    triage: {
      label: "Triage runs",
      color: "hsl(var(--chart-2))",
    },
  }

  const cards = useMemo(
    () => [
      {
        title: "Alerts in queue",
        value: formatNumber(kpis?.alertsInQueue),
        description: "Open or acknowledged alerts awaiting triage",
      },
      {
        title: "Disputes opened",
        value: formatNumber(kpis?.disputesOpen),
        description: "Active dispute cases",
      },
      {
        title: "Avg triage latency (p50/p95)",
        value: kpis
          ? `${formatNumber(kpis.triageLatencyMs.p50)} / ${formatNumber(
              kpis.triageLatencyMs.p95
            )} ms`
          : "-",
        description: "Median / 95th percentile latency",
      },
      {
        title: "Triage runs (24h)",
        value: formatNumber(kpis?.triageRuns24h),
        description: "Completed triage runs in the last 24 hours",
      },
      {
        title: "Fallback rate (24h)",
        value: formatPercent(kpis?.fallbackRate24h),
        description: "Share of runs that used fallbacks",
      },
      {
        title: "Actions executed (24h)",
        value: formatNumber(kpis?.actions24h),
        description: "Freeze/dispute/contact actions logged",
      },
    ],
    [kpis]
  )

  if (error) return <div className="text-red-600 text-sm">{error}</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-32" />
            ))
          : cards.map((card) => (
              <Card key={card.title}>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight">
                    {card.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Alerts per day (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40" />
            ) : (
              <ChartContainer config={alertsChartConfig} className="h-40">
                <AreaChart data={alertsSpark} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <ChartTooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => value as string}
                        nameKey="alerts"
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="alerts"
                    stroke="var(--color-alerts)"
                    fill="var(--color-alerts)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Triage throughput (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40" />
            ) : (
              <ChartContainer config={triageChartConfig} className="h-40">
                <AreaChart data={triageSpark} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <ChartTooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => value as string}
                        nameKey="triage"
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="triage"
                    stroke="var(--color-triage)"
                    fill="var(--color-triage)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatNumber(value: number | undefined | null) {
  if (value === undefined || value === null) return "-"
  return new Intl.NumberFormat().format(Math.round(value))
}

function formatPercent(value: number | undefined | null) {
  if (value === undefined || value === null) return "-"
  return `${(value * 100).toFixed(1)}%`
}

function formatDay(day: string) {
  const date = new Date(day)
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
