export function encodeCursorBase64(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64")
}

export function decodeCursorBase64<T = unknown>(cursor: string): T | null {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf8")
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

export function encodeCursorBase64Url(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

export function decodeCursorBase64Url<T = unknown>(cursor: string): T | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8")
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
