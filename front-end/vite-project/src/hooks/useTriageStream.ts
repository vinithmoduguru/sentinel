import { useEffect, useRef, useState } from "react"
import { connectTriageStream } from "@/lib/api"

export type TriageEvent = {
  type:
    | "plan_update"
    | "tool_update"
    | "fallback_triggered"
    | "decision_finalized"
    | string
  step?: string
  ok?: boolean
  detail?: any
  error?: string
}

export function useTriageStream(runId?: string) {
  const [events, setEvents] = useState<TriageEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const cleanupRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    if (!runId) return
    
    setLoading(true)
    setError(null)
    setEvents([])
    
    // Add a timeout to detect if stream never connects
    const timeoutId = setTimeout(() => {
      if (events.length === 0) {
        setError("Triage stream connection timeout. Please try again.")
        setLoading(false)
      }
    }, 10000) // 10 second timeout

    try {
      setConnected(true)
      cleanupRef.current = connectTriageStream(runId, (ev: TriageEvent) => {
        setEvents((prev: TriageEvent[]) => {
          if (prev.length === 0) {
            setLoading(false) // First event received, stop loading
            clearTimeout(timeoutId)
          }
          return [...prev, ev]
        })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to triage stream")
      setLoading(false)
      setConnected(false)
      clearTimeout(timeoutId)
    }

    return () => {
      clearTimeout(timeoutId)
      cleanupRef.current?.()
      cleanupRef.current = undefined
      setConnected(false)
    }
  }, [runId])

  return { events, connected, error, loading }
}
