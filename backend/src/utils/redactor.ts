export function redactor<T extends Record<string, any>>(obj: T): T {
  const str = JSON.stringify(obj)
  const masked = str
    .replace(/\b\d{13,19}\b/g, "****REDACTED****") // PANs
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "****REDACTED****") // emails
  return JSON.parse(masked)
}
