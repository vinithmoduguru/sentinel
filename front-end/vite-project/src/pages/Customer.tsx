import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import {
  listCustomerTx,
  getInsights,
  type CustomerInsightsSummary,
  type CustomerTransaction,
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Skeleton from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Pie,
  PieChart,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

export default function CustomerPage() {
  const params = useParams()
  const id = Number(params.id)
  const [timeline, setTimeline] = useState<CustomerTransaction[]>([])
  const [insights, setInsightsState] = useState<CustomerInsightsSummary | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError("Invalid customer id")
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        const [txRes, insightsRes] = await Promise.all([
          listCustomerTx(id, { limit: 200 }),
          getInsights(id),
        ])
        setTimeline(txRes.items ?? [])
        setInsightsState(insightsRes)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Failed to load customer")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const categories = insights?.categories ?? []
  const merchants = insights?.topMerchants ?? []
  const anomalies = insights?.anomalies ?? []

  const pieData = categories.map((cat) => ({
    name: cat.name,
    value: Math.round(cat.pct * 1000) / 10,
  }))
  const trendData = (insights?.monthlyTrend ?? []).map((row) => ({
    month: row.month,
    spend: row.sum / 100,
  }))

  const pieConfig: ChartConfig = Object.fromEntries(
    pieData.map((item, idx) => [
      item.name,
      { label: item.name, color: `hsl(var(--chart-${(idx % 5) + 1}))` },
    ])
  )
  const trendConfig: ChartConfig = {
    spend: {
      label: "Spend",
      color: "hsl(var(--chart-3))",
    },
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Customer #{id}</h1>
        <p className="text-sm text-muted-foreground">
          Recent activity, spend insights, and anomalies.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground font-medium">
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[420px] overflow-auto pr-2">
              {timeline.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No transactions found.
                </div>
              ) : (
                timeline.map((tx) => (
                  <div
                    key={tx.id}
                    className="border rounded p-3 text-sm flex justify-between gap-3">
                    <div>
                      <div className="font-medium">{tx.merchant}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatTimestamp(tx.ts)} • MCC {tx.mcc}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">
                        {formatCurrency(tx.amount_cents, tx.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Card {tx.card_id ?? "—"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Category Spend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No category breakdown available.
                  </div>
                ) : (
                  <ChartContainer config={pieConfig} className="h-64">
                    <PieChart>
                      <ChartTooltip
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        dataKey="value"
                        data={pieData}
                        innerRadius={50}
                        outerRadius={90}
                        strokeWidth={2}
                        label={({ name, value }) => `${name} ${value}%`}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Top Merchants
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {merchants.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No merchant concentration yet.
                  </div>
                ) : (
                  merchants.map((m) => (
                    <div
                      key={m.merchant}
                      className="flex justify-between text-sm">
                      <span>{m.merchant}</span>
                      <span className="text-muted-foreground">
                        {m.count} tx
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground font-medium">
                Monthly Spend Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendData.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Come back later for trend data.
                </div>
              ) : (
                <ChartContainer config={trendConfig} className="h-64">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="spend" fill="var(--color-spend)" radius={8} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground font-medium">
                Anomalies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {anomalies.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No anomalies detected.
                </div>
              ) : (
                anomalies.map((a, idx) => (
                  <div
                    key={`${a.ts}-${idx}`}
                    className="border rounded p-3 text-sm">
                    <div className="font-medium">{formatTimestamp(a.ts)}</div>
                    <div className="text-xs text-muted-foreground">
                      Z-score {a.z}
                    </div>
                    <div className="text-xs">{a.note}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
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

function formatCurrency(cents: number, currency?: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "INR",
    minimumFractionDigits: 2,
  }).format(cents / 100)
}
