export function redactor<T>(obj: T): T {
  const maskString = (s: string) =>
    s
      .replace(/\b\d{13,19}\b/g, "****REDACTED****") // PAN-like sequences
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "****REDACTED****") // emails

  const visit = (val: any): any => {
    if (val == null) return val
    if (typeof val === "string") return maskString(val)
    if (Array.isArray(val)) return val.map(visit)
    if (typeof val === "object") {
      const out: Record<string, any> = {}
      for (const [k, v] of Object.entries(val)) out[k] = visit(v)
      return out
    }
    return val
  }

  return visit(obj)
}
