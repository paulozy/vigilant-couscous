import { describe, expect, it } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('menos de uma hora', () => {
    expect(formatDuration(45)).toBe('45min')
  })

  it('hora e minutos', () => {
    expect(formatDuration(90)).toBe('1h30')
  })

  it('hora cheia, sem os minutos zerados', () => {
    expect(formatDuration(120)).toBe('2h')
  })
})
