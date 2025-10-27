import express from "express"
import dotenv from "dotenv"

dotenv.config()

const app = express()

app.get("/", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.get("/healthz", (_req, res) => {
  res.sendStatus(200)
})

const port = Number(process.env.PORT ?? 4000)

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`)
})

export default app
