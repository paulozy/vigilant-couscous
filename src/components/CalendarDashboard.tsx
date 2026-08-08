import { useState, useEffect } from 'react'

interface Account {
  id: number
  name: string
  email: string
  token: string
  color: string
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  account: string
  accountEmail: string
  color: string
  description?: string
}

type ViewMode = 'day' | 'week'

interface AuthState {
  accountName: string
}

export default function CalendarDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [view, setView] = useState<ViewMode>('week')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Configuração da Microsoft (identificadores públicos de app OAuth — seguros
  // para expor no bundle do client, mas mantidos fora do código-fonte)
  const CONFIG = {
    clientId: import.meta.env.VITE_MS_CLIENT_ID,
    tenantId: import.meta.env.VITE_MS_TENANT_ID,
    redirectUri: window.location.origin,
  }

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

  // Função para fazer login com a conta Outlook
  const loginWithOutlook = async (accountName: string) => {
    try {
      setLoading(true)
      setError(null)

      // URL de autenticação do Azure
      const authUrl = `https://login.microsoftonline.com/${CONFIG.tenantId}/oauth2/v2.0/authorize`
      const params = new URLSearchParams({
        client_id: CONFIG.clientId,
        response_type: 'code',
        redirect_uri: CONFIG.redirectUri,
        scope: 'Calendars.Read offline_access',
        response_mode: 'query',
        state: JSON.stringify({ accountName }),
      })

      window.location.href = `${authUrl}?${params.toString()}`
    } catch (err) {
      setError('Erro ao iniciar login: ' + (err as Error).message)
      setLoading(false)
    }
  }

  // Buscar eventos do calendário
  const fetchCalendarEvents = async (account: Account) => {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}&$top=100`,
        {
          headers: {
            Authorization: `Bearer ${account.token}`,
            'Content-Type': 'application/json',
          },
        },
      )

      const data = await response.json()

      if (data.value) {
        const calendarEvents: CalendarEvent[] = data.value.map((event: any) => ({
          id: event.id,
          title: event.subject,
          start: new Date(event.start.dateTime),
          end: new Date(event.end.dateTime),
          account: account.name,
          accountEmail: account.email,
          color: account.color,
          description: event.bodyPreview,
        }))

        setEvents((prev) => [...prev, ...calendarEvents])
      }
    } catch (err) {
      console.error('Erro ao buscar eventos:', err)
      setError('Erro ao buscar eventos do calendário')
    }
  }

  // Processar o callback da autenticação
  useEffect(() => {
    const handleAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')

      if (code && state) {
        try {
          setLoading(true)
          const parsedState: AuthState = JSON.parse(decodeURIComponent(state))

          // Trocar código por token
          const tokenResponse = await fetch(
            'https://login.microsoftonline.com/' + CONFIG.tenantId + '/oauth2/v2.0/token',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: CONFIG.clientId,
                scope: 'Calendars.Read offline_access',
                code: code,
                redirect_uri: CONFIG.redirectUri,
                grant_type: 'authorization_code',
              }),
            },
          )

          const tokenData = await tokenResponse.json()

          if (tokenData.access_token) {
            // Pegar informações do usuário
            const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
              },
            })

            const userData = await userResponse.json()

            // Adicionar conta
            const newAcc: Account = {
              id: Date.now(),
              name: parsedState.accountName,
              email: userData.userPrincipalName || userData.mail,
              token: tokenData.access_token,
              color: colors[accounts.length % colors.length],
            }

            setAccounts([...accounts, newAcc])
            fetchCalendarEvents(newAcc)

            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname)
          } else {
            setError('Erro ao obter token de acesso')
          }
        } catch (err) {
          setError('Erro ao processar autenticação: ' + (err as Error).message)
        } finally {
          setLoading(false)
        }
      }
    }

    handleAuthCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeAccount = (id: number) => {
    const accountToRemove = accounts.find((acc) => acc.id === id)
    setAccounts(accounts.filter((acc) => acc.id !== id))
    setEvents(events.filter((evt) => evt.accountEmail !== accountToRemove?.email))
  }

  const getEventsForDay = (date: Date) => {
    return events
      .filter((event) => {
        const eventDate = new Date(event.start)
        return eventDate.toDateString() === date.toDateString()
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  const getEventsForWeek = (date: Date) => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    return events
      .filter((event) => {
        const eventDate = new Date(event.start)
        return eventDate >= start && eventDate <= end
      })
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
                {accounts.length} conta{accounts.length !== 1 ? 's' : ''} conectada{accounts.length !== 1 ? 's' : ''}
              </span>
            </div>
            {accounts.length < 3 && (
              <button
                onClick={() => {
                  const accountName = prompt(`Nome da empresa (conta ${accounts.length + 1}):`)
                  if (accountName) {
                    loginWithOutlook(accountName)
                  }
                }}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: loading ? '#60a5fa' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
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

        {/* Accounts Status */}
        {accounts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {accounts.map((account) => (
              <div
                key={account.id}
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
                      background: account.color,
                    }}
                  />
                  <div>
                    <p style={{ fontWeight: '600', color: '#fff', fontSize: '14px', margin: 0 }}>{account.name}</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{account.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeAccount(account.id)}
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
        {accounts.length > 0 && (
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
                            🕒 {formatTime(event.start)} - {formatTime(event.end)}
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
        {accounts.length === 0 && (
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>Comece adicionando suas contas</h3>
            <p style={{ color: '#9ca3af', marginBottom: '16px' }}>
              Conecte suas 3 contas Outlook para ver todos os eventos em um único lugar
            </p>
            <button
              onClick={() => loginWithOutlook('Empresa 1')}
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: loading ? '#60a5fa' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
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
