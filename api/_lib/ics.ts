import ical from 'node-ical'
import type { CalendarResponse, ParameterValue, VEvent } from 'node-ical'

export interface FeedSource {
  id: string
  label: string
  url: string
}

export interface NormalizedEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  isFullDay: boolean
}

export type SourceResult =
  | { id: string; label: string; ok: true; events: NormalizedEvent[] }
  | { id: string; label: string; ok: false; error: string }

const FETCH_TIMEOUT_MS = 10_000
// Outlook has been reported to reject requests without a browser-like UA on
// published-calendar URLs (returns "Outlook is not supported on this
// browser"). Sending one is free insurance.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function textValue(value: ParameterValue | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : value.val
}

/**
 * Fetches the raw text of an ICS feed. Throws a short, stable error code
 * (never the raw exception) so callers can map it to a friendly message.
 */
export async function fetchIcsText(url: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('invalid_url')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('invalid_url')
  }

  let response: Response
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/calendar, text/plain, */*' },
    })
  } catch {
    throw new Error('fetch_failed')
  }

  if (!response.ok) {
    throw new Error(`http_${response.status}`)
  }

  const text = await response.text()
  // Outlook sometimes answers with a 200 OK HTML error page instead of a
  // real calendar — never trust status/content-type alone.
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) {
    throw new Error('not_ics')
  }
  return text
}

/**
 * Parses ICS text and returns every VEVENT occurrence (including expanded
 * recurring instances) whose start falls within [from, to].
 */
export function parseIcsEvents(text: string, from: Date, to: Date): NormalizedEvent[] {
  let data: CalendarResponse
  try {
    data = ical.sync.parseICS(text)
  } catch {
    throw new Error('parse_failed')
  }

  const events: NormalizedEvent[] = []

  for (const component of Object.values(data)) {
    if (!component || typeof component !== 'object' || component.type !== 'VEVENT') continue
    const event = component as VEvent

    if (event.rrule) {
      const instances = ical.expandRecurringEvent(event, { from, to })
      for (const instance of instances) {
        events.push({
          id: `${event.uid}:${instance.start.toISOString()}`,
          title: textValue(instance.summary) ?? '(sem título)',
          start: instance.start.toISOString(),
          end: instance.end.toISOString(),
          description: textValue(instance.event.description),
          isFullDay: instance.isFullDay,
        })
      }
      continue
    }

    const start = event.start
    const end = event.end ?? event.start
    if (!start || start < from || start > to) continue

    events.push({
      id: event.uid,
      title: textValue(event.summary) ?? '(sem título)',
      start: start.toISOString(),
      end: end.toISOString(),
      description: textValue(event.description),
      isFullDay: Boolean(start.dateOnly),
    })
  }

  return events
}

export async function fetchAndParseSource(source: FeedSource, from: Date, to: Date): Promise<SourceResult> {
  try {
    const text = await fetchIcsText(source.url)
    const events = parseIcsEvents(text, from, to)
    return { id: source.id, label: source.label, ok: true, events }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown_error'
    return { id: source.id, label: source.label, ok: false, error }
  }
}
