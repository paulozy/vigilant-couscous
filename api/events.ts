import { SESSION_COOKIE, parseCookie, verifySession, jsonResponse, withErrorHandling } from './_lib/auth.js'
import { fetchAndParseSource, type FeedSource } from './_lib/ics.js'

const MAX_SOURCES = 3
const DEFAULT_RANGE_DAYS = 30

interface RequestBody {
  sources?: unknown
  from?: unknown
  to?: unknown
}

function isFeedSource(value: unknown): value is FeedSource {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.label === 'string' && typeof v.url === 'string'
}

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return fallback
}

export const POST = withErrorHandling(async (request: Request): Promise<Response> => {
  const token = parseCookie(request.headers.get('cookie'), SESSION_COOKIE)
  if (!(await verifySession(token))) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const sources = Array.isArray(body.sources) ? body.sources.filter(isFeedSource).slice(0, MAX_SOURCES) : []

  const now = new Date()
  const defaultFrom = new Date(now)
  defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_RANGE_DAYS)
  const defaultTo = new Date(now)
  defaultTo.setDate(defaultTo.getDate() + DEFAULT_RANGE_DAYS)

  const from = parseDate(body.from, defaultFrom)
  const to = parseDate(body.to, defaultTo)

  const results = await Promise.all(sources.map((source) => fetchAndParseSource(source, from, to)))

  return jsonResponse({ sources: results }, 200, { 'Cache-Control': 'private, no-store' })
})
