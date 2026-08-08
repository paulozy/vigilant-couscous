import { describe, expect, it } from 'vitest'
import { layoutDayEvents, type TimedEvent } from './layoutDayEvents'

const DAY_START = new Date('2026-08-10T00:00:00Z')
const DAY_END = new Date('2026-08-11T00:00:00Z')

function ev(id: string, start: string, end: string): TimedEvent {
  return { id, start: new Date(start), end: new Date(end) }
}

function layout(events: TimedEvent[]) {
  return layoutDayEvents(events, DAY_START, DAY_END)
}

function byId(results: ReturnType<typeof layout>, id: string) {
  const found = results.find((r) => r.event.id === id)
  if (!found) throw new Error(`event ${id} not found in layout result`)
  return found
}

describe('layoutDayEvents', () => {
  it('partial overlap → two columns, 50/50 width', () => {
    const result = layout([
      ev('a', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z'),
      ev('b', '2026-08-10T10:30:00Z', '2026-08-10T11:30:00Z'),
    ])
    expect(result).toHaveLength(2)
    const a = byId(result, 'a')
    const b = byId(result, 'b')
    expect(a.width).toBeCloseTo(50)
    expect(b.width).toBeCloseTo(50)
    expect(a.left).toBeCloseTo(0)
    expect(b.left).toBeCloseTo(50)
  })

  it('chain overlap (A-B, B-C, not A-C) → two columns, A and C share a column', () => {
    const result = layout([
      ev('a', '2026-08-10T09:00:00Z', '2026-08-10T10:00:00Z'),
      ev('b', '2026-08-10T09:30:00Z', '2026-08-10T11:00:00Z'),
      ev('c', '2026-08-10T10:30:00Z', '2026-08-10T12:00:00Z'),
    ])
    const a = byId(result, 'a')
    const b = byId(result, 'b')
    const c = byId(result, 'c')
    // duas colunas no total (profundidade máxima de sobreposição é 2)
    expect(a.width).toBeCloseTo(50)
    expect(b.width).toBeCloseTo(50)
    expect(c.width).toBeCloseTo(50)
    // A e C não se sobrepõem entre si — dividem a mesma coluna
    expect(a.left).toBeCloseTo(c.left)
    expect(a.left).not.toBeCloseTo(b.left)
  })

  it('full containment → outer and inner split the width evenly', () => {
    const result = layout([
      ev('outer', '2026-08-10T09:00:00Z', '2026-08-10T12:00:00Z'),
      ev('inner', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z'),
    ])
    const outer = byId(result, 'outer')
    const inner = byId(result, 'inner')
    expect(outer.width).toBeCloseTo(50)
    expect(inner.width).toBeCloseTo(50)
    expect(outer.left).not.toBeCloseTo(inner.left)
  })

  it('back-to-back events (no gap) → both get full width', () => {
    const result = layout([
      ev('a', '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z'),
      ev('b', '2026-08-10T11:00:00Z', '2026-08-10T12:00:00Z'),
    ])
    const a = byId(result, 'a')
    const b = byId(result, 'b')
    expect(a.width).toBeCloseTo(100)
    expect(b.width).toBeCloseTo(100)
    expect(a.left).toBeCloseTo(0)
    expect(b.left).toBeCloseTo(0)
  })

  it('event crossing midnight is clamped to the visible day', () => {
    const result = layout([ev('a', '2026-08-09T23:00:00Z', '2026-08-10T01:00:00Z')])
    const a = byId(result, 'a')
    expect(a.top).toBeCloseTo(0)
    // 1h de 24h = ~4.1667%
    expect(a.height).toBeCloseTo((1 / 24) * 100, 3)
  })

  it('zero-duration event gets a minimum visible height instead of disappearing', () => {
    const result = layout([ev('a', '2026-08-10T10:00:00Z', '2026-08-10T10:00:00Z')])
    expect(result).toHaveLength(1)
    const a = byId(result, 'a')
    expect(a.height).toBeGreaterThan(0)
    // 15min de 24h = 1.041666...%
    expect(a.height).toBeCloseTo((15 / (24 * 60)) * 100, 3)
  })

  it('non-overlapping events each get full width', () => {
    const result = layout([
      ev('a', '2026-08-10T09:00:00Z', '2026-08-10T10:00:00Z'),
      ev('b', '2026-08-10T14:00:00Z', '2026-08-10T15:00:00Z'),
    ])
    expect(byId(result, 'a').width).toBeCloseTo(100)
    expect(byId(result, 'b').width).toBeCloseTo(100)
  })

  it('returns an empty array for an empty input', () => {
    expect(layout([])).toEqual([])
  })
})
