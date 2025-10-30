import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { runEvals, type EvalRunResult } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, PlayCircle } from "lucide-react"

export default function EvalsPage() {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<EvalRunResult | null>(null)

  const handleRunTests = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await runEvals()
      setResults(res)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evaluation Tests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run acceptance tests to verify system behavior
          </p>
        </div>
        <Button
          onClick={handleRunTests}
          disabled={running}
          size="lg"
          className="min-w-[140px]">
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Run Tests
            </>
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {results && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{results.totals.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Passed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {results.totals.passed}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {results.totals.failed}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pass Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results.totals.total > 0
                    ? Math.round(
                        (results.totals.passed / results.totals.total) * 100
                      )
                    : 0}
                  %
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Test ID
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Error Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((result, idx) => (
                      <tr
                        key={idx}
                        className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle font-mono text-sm">
                          {result.id}
                        </td>
                        <td className="p-4 align-middle text-sm">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                            {result.category}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          {result.skipped ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              Skipped
                            </span>
                          ) : result.passed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                              <XCircle className="h-3 w-3" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="p-4 align-middle text-sm text-muted-foreground">
                          {result.error ? (
                            <span className="line-clamp-2" title={result.error}>
                              {result.error}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!results && !running && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PlayCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No tests run yet</p>
            <p className="text-sm text-muted-foreground">
              Click the "Run Tests" button to execute all evaluation tests
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
