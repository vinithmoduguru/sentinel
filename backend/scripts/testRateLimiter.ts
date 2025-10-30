// Simple burst tester for the rate limiter using Node's global fetch

async function run() {
  const url = process.env.URL || "http://localhost:4000/_rate_test"
  const apiKey = process.env.API_KEY || "test-key"
  const concurrent = Number(process.env.COUNT || 15)
  const headers: Record<string, string> = { "x-api-key": apiKey }

  const jobs = Array.from({ length: concurrent }, async () => {
    try {
      const res = await fetch(url, { headers })
      return {
        status: res.status,
        retryAfter: res.headers.get("retry-after"),
      }
    } catch {
      return { status: "ERR", retryAfter: undefined as string | undefined }
    }
  })

  const results = await Promise.all(jobs)
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    const key = String(r.status)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  // eslint-disable-next-line no-console
  console.log("Status counts:", counts)
  const first429 = results.find((r) => r.status === 429)
  if (first429?.retryAfter) {
    // eslint-disable-next-line no-console
    console.log("Retry-After:", first429.retryAfter)
  }
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exitCode = 1
})
