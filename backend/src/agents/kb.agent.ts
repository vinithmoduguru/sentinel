import type { AgentFn } from "../orchestrator/agent.interface.js"
import { logger } from "../utils/logger.js"
import { redactor } from "../utils/redactor.js"
import prisma from "../config/database.js"

type KbSearchResult = {
  docId: number
  title: string
  anchor: string
  extract: string
}

type KbOutput = {
  results: KbSearchResult[]
  summary?: string
}

export const kb: AgentFn = async (input) => {
  const start = Date.now()
  const query = input.context?.query as string

  if (!query || query.trim().length === 0) {
    return {
      ok: true,
      durationMs: Date.now() - start,
      data: {
        results: [],
        summary: "No search query provided",
      },
    }
  }

  try {
    // Search using PostgreSQL ILIKE for case-insensitive pattern matching
    const searchResults = await prisma.kbDoc.findMany({
      where: {
        OR: [
          {
            title: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            content_text: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      take: 10, // Policy POL_008: Max 10 results per query
    })

    // Generate extracts with context around the search term
    const results: KbSearchResult[] = searchResults.map((doc) => {
      const extract = generateExtract(doc.content_text, query)
      return {
        docId: doc.id,
        title: doc.title,
        anchor: doc.anchor,
        extract,
      }
    })

    const baseOutput: KbOutput = {
      results,
    }

    // Optional LLM explanation
    let summary: string | undefined
    if (process.env.USE_LLM === "true") {
      try {
        const prompt = `
        You are a knowledge base search assistant. Provide a concise 1-2 sentence summary 
        of the search results for the query: "${query}".
        Respond in JSON: {"summary": "..."}.

        Results:
        ${JSON.stringify(redactor(baseOutput))}
        `
        // TODO: Add actual LLM call when OpenAI client is available
        summary = generateDeterministicSummary(query, results)
      } catch (err) {
        logger.warn({
          agent: "kb",
          event: "llm_fallback",
          error: (err as Error).message,
        })
        summary = generateDeterministicSummary(query, results)
      }
    } else {
      summary = generateDeterministicSummary(query, results)
    }

    return {
      ok: true,
      durationMs: Date.now() - start,
      data: { ...baseOutput, summary },
    }
  } catch (err: any) {
    logger.error({
      runId: input.runId,
      agent: "kb",
      event: "agent_error",
      error: err.message,
    })
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: err.message,
    }
  }
}

function generateExtract(content: string, query: string): string {
  const queryLower = query.toLowerCase()
  const contentLower = content.toLowerCase()

  // Find the first occurrence of the query
  const matchIndex = contentLower.indexOf(queryLower)

  if (matchIndex === -1) {
    // No match found, return first 150 characters
    return content.length > 150 ? content.substring(0, 150) + "..." : content
  }

  const extractLength = 150
  const halfLength = Math.floor(extractLength / 2)

  let start = Math.max(0, matchIndex - halfLength)
  let end = Math.min(content.length, matchIndex + halfLength)

  // Adjust to word boundaries if possible
  if (start > 0) {
    const spaceIndex = content.lastIndexOf(" ", start)
    if (spaceIndex > start - 20) {
      // Only adjust if not too far back
      start = spaceIndex + 1
    }
  }

  if (end < content.length) {
    const spaceIndex = content.indexOf(" ", end)
    if (spaceIndex > 0 && spaceIndex < end + 20) {
      // Only adjust if not too far forward
      end = spaceIndex
    }
  }

  let extract = content.substring(start, end)

  // Add ellipsis if we're not at the beginning or end
  if (start > 0) extract = "..." + extract
  if (end < content.length) extract = extract + "..."

  return extract
}

function generateDeterministicSummary(
  query: string,
  results: KbSearchResult[]
): string {
  if (results.length === 0) {
    return `No knowledge base documents found for query: "${query}"`
  }

  if (results.length === 1) {
    return `Found 1 relevant document: "${results[0]?.title || "Unknown"}"`
  }

  const categories = results.map((r) => r.title).slice(0, 3)
  const categoryList =
    categories.length > 1
      ? categories.slice(0, -1).join(", ") +
        " and " +
        categories[categories.length - 1]
      : categories[0] || "Unknown"

  return `Found ${results.length} relevant documents including: ${categoryList}`
}
