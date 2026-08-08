import { useMemo } from 'react'
import { layoutDayEvents } from '../lib/layoutDayEvents'

export interface GridEvent {
  id: string
  title: string
  start: Date
  end: Date
  color: string
  account: string
  description?: string
  isFullDay: boolean
}

interface CalendarGridProps {
  days: Date[]
  events: GridEvent[]
}

const ROW_HEIGHT_PX = 56
const GUTTER_WIDTH_PX = 56
const FALLBACK_START_HOUR = 7
const FALLBACK_END_HOUR = 21
const MIN_SPAN_HOURS = 6

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() + 1)
  return d
}

function isToday(date: Date): boolean {
  return date.toDateString() === new Date().toDateString()
}

function formatHourLabel(hour: number): string {
  return `${String(hour % 24).padStart(2, '0')}:00`
}

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

interface DayBucket {
  day: Date
  dayStart: Date
  dayEnd: Date
  timed: GridEvent[]
  allDay: GridEvent[]
}

export default function CalendarGrid({ days, events }: CalendarGridProps) {
  const { buckets, startHour, endHour } = useMemo(() => {
    const buckets: DayBucket[] = days.map((day) => {
      const dayStart = startOfDay(day)
      const dayEnd = endOfDay(day)
      const inRange = events.filter((e) => e.start < dayEnd && e.end > dayStart)
      return {
        day,
        dayStart,
        dayEnd,
        timed: inRange.filter((e) => !e.isFullDay),
        allDay: inRange.filter((e) => e.isFullDay),
      }
    })

    let min = Infinity
    let max = -Infinity
    for (const bucket of buckets) {
      for (const e of bucket.timed) {
        const s = Math.max(e.start.getTime(), bucket.dayStart.getTime())
        const en = Math.min(e.end.getTime(), bucket.dayEnd.getTime())
        min = Math.min(min, (s - bucket.dayStart.getTime()) / 3_600_000)
        max = Math.max(max, (en - bucket.dayStart.getTime()) / 3_600_000)
      }
    }

    let startHour: number
    let endHour: number
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      startHour = FALLBACK_START_HOUR
      endHour = FALLBACK_END_HOUR
    } else {
      startHour = Math.max(0, Math.floor(min) - 1)
      endHour = Math.min(24, Math.ceil(max) + 1)
      if (endHour - startHour < MIN_SPAN_HOURS) {
        const mid = (startHour + endHour) / 2
        startHour = Math.max(0, Math.floor(mid - MIN_SPAN_HOURS / 2))
        endHour = Math.min(24, startHour + MIN_SPAN_HOURS)
      }
    }

    return { buckets, startHour, endHour }
  }, [days, events])

  const hourCount = endHour - startHour
  const gridHeight = hourCount * ROW_HEIGHT_PX
  const hasAllDay = buckets.some((b) => b.allDay.length > 0)
  const now = new Date()

  return (
    <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Cabeçalho: dia da semana + data */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
        <div style={{ width: GUTTER_WIDTH_PX, flexShrink: 0 }} />
        {buckets.map(({ day }) => (
          <div
            key={day.toISOString()}
            style={{
              flex: 1,
              padding: '10px 8px',
              textAlign: 'center',
              borderLeft: '1px solid #334155',
              color: isToday(day) ? '#60a5fa' : '#e5e7eb',
              fontWeight: isToday(day) ? 700 : 600,
              fontSize: '13px',
            }}
          >
            {day.toLocaleDateString('pt-BR', { weekday: 'short' })}{' '}
            <span style={{ color: '#9ca3af', fontWeight: 400 }}>{day.getDate()}</span>
          </div>
        ))}
      </div>

      {/* Faixa de eventos de dia inteiro */}
      {hasAllDay && (
        <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
          <div style={{ width: GUTTER_WIDTH_PX, flexShrink: 0 }} />
          {buckets.map(({ day, allDay }) => (
            <div
              key={day.toISOString()}
              style={{ flex: 1, padding: '6px', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              {allDay.map((e) => (
                <div
                  key={e.id}
                  title={`${e.title} · ${e.account}`}
                  style={{
                    background: `${e.color}33`,
                    borderLeft: `3px solid ${e.color}`,
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {e.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Grid de horários */}
      <div style={{ display: 'flex' }}>
        {/* Gutter de horas */}
        <div style={{ width: GUTTER_WIDTH_PX, flexShrink: 0, position: 'relative', height: gridHeight }}>
          {Array.from({ length: hourCount + 1 }, (_, i) => startHour + i).map((hour) => (
            <div
              key={hour}
              style={{
                position: 'absolute',
                top: (hour - startHour) * ROW_HEIGHT_PX - 6,
                right: 8,
                fontSize: '11px',
                color: '#6b7280',
              }}
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {buckets.map((bucket) => {
          const windowStart = new Date(bucket.dayStart)
          windowStart.setHours(startHour, 0, 0, 0)
          const windowEnd = new Date(bucket.dayStart)
          windowEnd.setHours(endHour, 0, 0, 0)

          const layout = layoutDayEvents(bucket.timed, windowStart, windowEnd)
          const showNowLine = isToday(bucket.day) && now >= windowStart && now <= windowEnd
          const nowTop = showNowLine ? ((now.getTime() - windowStart.getTime()) / (windowEnd.getTime() - windowStart.getTime())) * 100 : 0

          return (
            <div
              key={bucket.day.toISOString()}
              style={{ flex: 1, position: 'relative', height: gridHeight, borderLeft: '1px solid #334155' }}
            >
              {/* Linhas de hora */}
              {Array.from({ length: hourCount }, (_, i) => (
                <div
                  key={i}
                  style={{ position: 'absolute', top: i * ROW_HEIGHT_PX, left: 0, right: 0, borderTop: '1px solid #263449' }}
                />
              ))}

              {/* Indicador de "agora" */}
              {showNowLine && (
                <div
                  style={{
                    position: 'absolute',
                    top: `${nowTop}%`,
                    left: 0,
                    right: 0,
                    borderTop: '2px solid #ef4444',
                    zIndex: 2,
                  }}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginTop: '-5px', marginLeft: '-4px' }} />
                </div>
              )}

              {/* Eventos */}
              {layout.map(({ event, top, height, left, width }) => (
                <div
                  key={event.id}
                  title={`${event.title} · ${formatEventTime(event.start)} - ${formatEventTime(event.end)} · ${event.account}${event.description ? '\n' + event.description : ''}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    height: `${height}%`,
                    left: `calc(${left}% + 2px)`,
                    width: `calc(${width}% - 4px)`,
                    minHeight: '20px',
                    background: `${event.color}30`,
                    borderLeft: `3px solid ${event.color}`,
                    borderRadius: '4px',
                    padding: '2px 6px',
                    overflow: 'hidden',
                    cursor: 'default',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {event.title}
                  </div>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {formatEventTime(event.start)} · {event.account}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
