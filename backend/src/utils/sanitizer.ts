/**
 * Input sanitization utilities to prevent prompt injection and XSS
 */

// Remove potentially dangerous patterns from user input
export function sanitizeUserInput(input: string): string {
  if (typeof input !== "string") return String(input)
  
  // Remove control characters and zero-width characters
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, "")
  
  // Limit length to prevent abuse
  if (sanitized.length > 5000) {
    sanitized = sanitized.slice(0, 5000)
  }
  
  return sanitized.trim()
}

// Sanitize context object for agent input
export function sanitizeContext(context: any): any {
  if (!context || typeof context !== "object") return {}
  
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeUserInput(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "string" ? sanitizeUserInput(item) : item
      )
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeContext(value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

// Check for prompt injection patterns
export function detectPromptInjection(input: string): boolean {
  const dangerousPatterns = [
    /ignore\s+(previous|above|prior)\s+instructions/i,
    /system\s*:\s*/i,
    /assistant\s*:\s*/i,
    /<\|im_start\|>/i,
    /<\|im_end\|>/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
  ]
  
  return dangerousPatterns.some((pattern) => pattern.test(input))
}

// Validate and sanitize user input with policy check
export function validateUserInput(
  input: string,
  options?: { maxLength?: number; allowInjection?: boolean }
): { valid: boolean; sanitized: string; reason?: string } {
  const maxLength = options?.maxLength || 5000
  
  if (!input || typeof input !== "string") {
    return { valid: false, sanitized: "", reason: "Input must be a string" }
  }
  
  if (input.length > maxLength) {
    return { valid: false, sanitized: "", reason: `Input exceeds max length of ${maxLength}` }
  }
  
  const sanitized = sanitizeUserInput(input)
  
  if (!options?.allowInjection && detectPromptInjection(sanitized)) {
    return {
      valid: false,
      sanitized,
      reason: "Input contains potential prompt injection patterns",
    }
  }
  
  return { valid: true, sanitized }
}

