import { useState, type FormEvent } from 'react'

interface PasswordGateProps {
  onAuthenticated: () => void
}

export default function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        onAuthenticated()
      } else {
        setError('Senha incorreta.')
        setPassword('')
      }
    } catch {
      setError('Erro ao contatar o servidor. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        padding: '20px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#1e293b',
          border: '1px solid #475569',
          borderRadius: '12px',
          padding: '32px',
          width: '100%',
          maxWidth: '360px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>📅</div>
        <h1 style={{ color: '#fff', fontSize: '20px', margin: '0 0 4px 0' }}>Unified Calendar</h1>
        <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 24px 0' }}>
          Acesso restrito. Informe a senha para continuar.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #475569',
            background: '#0f172a',
            color: '#fff',
            fontSize: '14px',
            marginBottom: '12px',
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <p style={{ color: '#f87171', fontSize: '13px', margin: '0 0 12px 0' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: submitting ? '#60a5fa' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
