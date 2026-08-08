import { useEffect, useState } from 'react'
import PasswordGate from './components/PasswordGate'
import CalendarDashboard from './components/CalendarDashboard'

type SessionStatus = 'checking' | 'authed' | 'unauthed'

export default function App() {
  const [status, setStatus] = useState<SessionStatus>('checking')

  useEffect(() => {
    fetch('/api/session')
      .then((res) => setStatus(res.ok ? 'authed' : 'unauthed'))
      .catch(() => setStatus('unauthed'))
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } finally {
      setStatus('unauthed')
    }
  }

  if (status === 'checking') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        }}
      >
        <p style={{ color: '#9ca3af' }}>Carregando...</p>
      </div>
    )
  }

  if (status === 'unauthed') {
    return <PasswordGate onAuthenticated={() => setStatus('authed')} />
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleLogout}
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 10,
          padding: '6px 12px',
          background: 'rgba(71, 85, 105, 0.6)',
          color: '#e5e7eb',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Sair
      </button>
      <CalendarDashboard />
    </div>
  )
}
