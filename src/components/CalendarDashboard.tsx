import { useEffect, useMemo, useState } from 'react'

interface FeedSource {
  id: string
  label: string
  url: string
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  account: string
  sourceId: string
  color: string
  description?: string
  isFullDay: boolean
}

interface SourceResultDto {
  id: string
  label: string
  ok: boolean
  events?: { id: string; title: string; start: string; end: string; description?: string; isFullDay: boolean }[]
  error?: string
}

interface SourceStatus {
  id: string
  label: string
  color: string
  status: 'loading' | 'ok' | 'error'
  eventCount?: number
  errorMessage?: string
}

type ViewMode = 'day' | 'week'

const FEEDS_STORAGE_KEY = 'uc_ics_feeds'
const CACHE_STORAGE_KEY = 'uc_events_cache'
const CACHE_TTL_MS = 5 * 60 * 1000
const RANGE_DAYS = 30
const MAX_FEEDS = 3

const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

const ERROR_MESSAGES: Record<string, string> = {
  invalid_url: 'URL inválida',
  fetch_failed: 'Não foi possível acessar o feed',
  not_ics: 'Isso não parece ser um calendário ICS válido',
  parse_failed: 'Erro ao processar o calendário',
}

function friendlyError(code: string | undefined): string {
  if (!code) return 'Erro desconhecido'
  if (code.startsWith('http_')) return `Feed indisponível (HTTP ${code.slice(5)})`
  return ERROR_MESSAGES[code] ?? 'Erro desconhecido'
}

function loadFeeds(): FeedSource[] {
  try {
    const raw = localStorage.getItem(FEEDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (f): f is FeedSource =>
        f && typeof f.id === 'string' && typeof f.label === 'string' && typeof f.url === 'string',
    )
  } catch {
    return []
  }
}

function saveFeeds(feeds: FeedSource[]) {
  localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(feeds))
}

export default function CalendarDashboard() {
  const [feeds, setFeeds] = useState<FeedSource[]>(loadFeeds)
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [view, setView] = useState<ViewMode>('week')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Range fixo (hoje ±30 dias), calculado uma vez — mesma janela que o
  // protótipo original buscava do Microsoft Graph.
  const range = useMemo(() => {
    const from = new Date()
    from.setDate(from.getDate() - RANGE_DAYS)
    const to = new Date()
    to.setDate(to.getDate() + RANGE_DAYS)
    return { from, to }
  }, [])

  useEffect(() => {
    if (feeds.length === 0) {
      setSourceStatuses([])
      setEvents([])
      return
    }

    const cacheKey = JSON.stringify({ feeds, from: range.from.toISOString(), to: range.to.toISOString() })
    let cancelled = false

    const applyResults = (results: SourceResultDto[]) => {
      if (cancelled) return
      setSourceStatuses(
        results.map((r, i) => ({
          id: r.id,
          label: r.label,
          color: colors[i % colors.length],
          status: r.ok ? 'ok' : 'error',
          eventCount: r.ok ? r.events?.length : undefined,
          errorMessage: r.ok ? undefined : friendlyError(r.error),
        })),
      )
      setEvents(
        results.flatMap((r, i) =>
          r.ok && r.events
            ? r.events.map((e) => ({
                id: e.id,
                title: e.title,
                start: new Date(e.start),
                end: new Date(e.end),
                account: r.label,
                sourceId: r.id,
                color: colors[i % colors.length],
                description: e.description,
                isFullDay: e.isFullDay,
              }))
            : [],
        ),
      )
    }

    try {
      const cachedRaw = sessionStorage.getItem(CACHE_STORAGE_KEY)
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { key: string; timestamp: number; sources: SourceResultDto[] }
        if (cached.key === cacheKey && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          applyResults(cached.sources)
          return
        }
      }
    } catch {
      // cache corrompido, ignora e busca de novo
    }

    setLoading(true)
    setError(null)
    setSourceStatuses(feeds.map((f, i) => ({ id: f.id, label: f.label, color: colors[i % colors.length], status: 'loading' })))

    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: feeds, from: range.from.toISOString(), to: range.to.toISOString() }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`http_${res.status}`)
        const data = (await res.json()) as { sources: SourceResultDto[] }
        if (cancelled) return
        try {
          sessionStorage.setItem(
            CACHE_STORAGE_KEY,
            JSON.stringify({ key: cacheKey, timestamp: Date.now(), sources: data.sources }),
          )
        } catch {
          // sessionStorage cheio/indisponível — segue sem cache
        }
        applyResults(data.sources)
      })
      .catch(() => {
        if (!cancelled) setError('Erro ao buscar eventos dos calendários')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [feeds, range])

  const addFeed = () => {
    if (feeds.length >= MAX_FEEDS) return
    const label = prompt(`Nome da empresa (conta ${feeds.length + 1}):`)
    if (!label) return
    const url = prompt('Cole a URL do calendário ICS publicado (Outlook → Configurações → Calendário → Publicar calendário):')
    if (!url) return
    const next = [...feeds, { id: crypto.randomUUID(), label, url }]
    setFeeds(next)
    saveFeeds(next)
  }

  const removeFeed = (id: string) => {
    const next = feeds.filter((f) => f.id !== id)
    setFeeds(next)
    saveFeeds(next)
    setSourceStatuses((prev) => prev.filter((s) => s.id !== id))
    setEvents((prev) => prev.filter((e) => e.sourceId !== id))
  }

  const getEventsForDay = (date: Date) => {
    return events
      .filter((event) => new Date(event.start).toDateString() === date.toDateString())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  const getEventsForWeek = (date: Date) => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    return events
      .filter((event) => event.start >= start && event.start <= end)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateShort = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const getWeekDays = (date: Date) => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay())
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(start)
      day.setDate(day.getDate() + i)
      days.push(day)
    }
    return days
  }

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate)
  }

  const displayEvents = view === 'day' ? getEventsForDay(selectedDate) : getEventsForWeek(selectedDate)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', padding: '20px' }}>
      {/* Header */}
      <div style={{ background: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(71, 85, 105, 0.5)', paddingBottom: '20px', marginBottom: '20px', borderRadius: '8px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '24px' }}>📅</div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: 0 }}>Unified Calendar</h1>
              <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '10px' }}>
                {feeds.length} conta{feeds.length !== 1 ? 's' : ''} conectada{feeds.length !== 1 ? 's' : ''}
              </span>
            </div>
            {feeds.length < MAX_FEEDS && (
              <button
                onClick={addFeed}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                + Adicionar Conta
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setView('day')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: view === 'day' ? '#2563eb' : '#475569',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
            >
              Dia
            </button>
            <button
              onClick={() => setView('week')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: view === 'week' ? '#2563eb' : '#475569',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Error Message */}
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px' }}>
            <div style={{ fontSize: '20px' }}>⚠️</div>
            <div>
              <p style={{ color: '#f87171', fontWeight: 'bold', margin: '0 0 4px 0' }}>Erro</p>
              <p style={{ color: '#fca5a5', fontSize: '14px', margin: 0 }}>{error}</p>
            </div>
          </div>
        )}

        {/* Sources Status */}
        {sourceStatuses.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {sourceStatuses.map((source) => (
              <div
                key={source.id}
                style={{
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: source.status === 'error' ? '#ef4444' : source.color,
                    }}
                  />
                  <div>
                    <p style={{ fontWeight: '600', color: '#fff', fontSize: '14px', margin: 0 }}>{source.label}</p>
                    <p style={{ fontSize: '12px', color: source.status === 'error' ? '#f87171' : '#9ca3af', margin: 0 }}>
                      {source.status === 'loading' && 'Carregando...'}
                      {source.status === 'ok' && `${source.eventCount ?? 0} evento${source.eventCount === 1 ? '' : 's'}`}
                      {source.status === 'error' && source.errorMessage}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFeed(source.id)}
                  style={{
                    padding: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '20px',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        {feeds.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button
                onClick={() => changeDate(-1)}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(71, 85, 105, 0.3)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: '24px',
                }}
              >
                ←
              </button>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#fff', margin: 0 }}>
                {view === 'day'
                  ? formatDate(selectedDate)
                  : `${formatDateShort(getWeekDays(selectedDate)[0])} - ${formatDateShort(getWeekDays(selectedDate)[6])}`}
              </h2>
              <button
                onClick={() => changeDate(1)}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(71, 85, 105, 0.3)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: '24px',
                }}
              >
                →
              </button>
            </div>

            {/* Events Display */}
            {loading ? (
              <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', padding: '48px', textAlign: 'center' }}>
                <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '3px solid #60a5fa', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
                <p style={{ color: '#9ca3af' }}>Carregando eventos...</p>
              </div>
            ) : displayEvents.length === 0 ? (
              <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px', padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
                <p style={{ color: '#9ca3af' }}>Nenhum evento para esse período</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      background: '#1e293b',
                      borderLeft: `4px solid ${event.color}`,
                      borderRadius: '8px',
                      padding: '16px',
                      transition: 'all 0.3s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontWeight: '600', color: '#fff', fontSize: '18px', margin: '0 0 8px 0' }}>{event.title}</h3>
                        {event.description && (
                          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '8px 0' }}>{event.description}</p>
                        )}
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🕒 {event.isFullDay ? 'Dia inteiro' : `${formatTime(event.start)} - ${formatTime(event.end)}`}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🏢 {event.account}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: event.color,
                          marginTop: '4px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Initial State */}
        {feeds.length === 0 && (
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>Comece adicionando suas contas</h3>
            <p style={{ color: '#9ca3af', marginBottom: '16px' }}>
              Cole a URL do calendário ICS publicado de até {MAX_FEEDS} contas Outlook pra ver todos os eventos em um único lugar
            </p>
            <button
              onClick={addFeed}
              style={{
                padding: '12px 24px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Conectar Primeira Conta
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
