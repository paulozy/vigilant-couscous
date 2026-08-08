import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'

interface AddCalendarModalProps {
  open: boolean
  accountNumber: number
  onClose: () => void
  onAdd: (label: string, url: string) => void
}

export default function AddCalendarModal({ open, accountNumber, onClose, onAdd }: AddCalendarModalProps) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)

  // Reseta o formulário sempre que o modal abre, e foca o primeiro campo.
  useEffect(() => {
    if (open) {
      setLabel('')
      setUrl('')
      setError(null)
      labelInputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmedLabel = label.trim()
    const trimmedUrl = url.trim()

    if (!trimmedLabel) {
      setError('Informe um nome pra essa conta.')
      return
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError('A URL precisa começar com http:// ou https://.')
      return
    }

    onAdd(trimmedLabel, trimmedUrl)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 50,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: '#1e293b',
          border: '1px solid #475569',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '420px',
        }}
      >
        <h2 style={{ color: '#fff', fontSize: '18px', margin: '0 0 4px 0' }}>Adicionar conta</h2>
        <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 20px 0' }}>Conta {accountNumber} de 3</p>

        <label style={{ display: 'block', marginBottom: '16px' }}>
          <span style={{ display: 'block', color: '#e5e7eb', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Nome</span>
          <input
            ref={labelInputRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Empresa 1"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '8px' }}>
          <span style={{ display: 'block', color: '#e5e7eb', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            URL do calendário ICS
          </span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://outlook.office365.com/owa/calendar/.../calendar.ics"
            style={{ ...inputStyle, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px' }}
          />
        </label>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 16px 0' }}>
          Outlook → Configurações → Calendário → Compartilhamento → Publicar um calendário → "Pode ver todos os
          detalhes".
        </p>

        {error && <p style={{ color: '#f87171', fontSize: '13px', margin: '0 0 16px 0' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={cancelButtonStyle}>
            Cancelar
          </button>
          <button type="submit" style={submitButtonStyle}>
            Adicionar
          </button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box',
}

const cancelButtonStyle: CSSProperties = {
  padding: '10px 16px',
  background: 'transparent',
  color: '#9ca3af',
  border: '1px solid #475569',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '14px',
}

const submitButtonStyle: CSSProperties = {
  padding: '10px 16px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '14px',
}
