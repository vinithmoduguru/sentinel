import app from "./app.js"
import dotenv from "dotenv"

dotenv.config()

const port = Number(process.env.PORT ?? 4000)

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Backend listening on http://localhost:${port}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server")
  server.close(() => {
    console.log("HTTP server closed")
  })
})

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server")
  server.close(() => {
    console.log("HTTP server closed")
  })
})

export default server
