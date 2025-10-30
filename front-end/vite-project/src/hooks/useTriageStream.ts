import { useEffect, useRef, useState } from "react"
import { connectTriageStream } from "@/lib/api"

export type TriageEvent = {
  type: "plan_update" | "tool_update" | "fallback_triggered" | "decision_finalized" | string
  step?: string
  ok?: boolean
  detail?: any
  error?: string
}

export function useTriageStream(runId?: string) {
  const [events, setEvents] = useState<TriageEvent[]>([])
  const [connected, setConnected] = useState(false)
  const cleanupRef = useRef<() => void>()

  useEffect(() => {
    if (!runId) return
    // establish SSE
    setConnected(true)
    cleanupRef.current = connectTriageStream(runId, (ev) => {
      setEvents((prev) => [...prev, ev])
    })
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = undefined
      setConnected(false)
    }
  }, [runId])

  return { events, connected }
}


