// Posiciona eventos que se sobrepõem lado a lado dentro de um dia, como
// Google Calendar/Outlook fazem no grid de horários.
//
// É uma aplicação direta de "interval partitioning" guloso: ordenando por
// horário de início e alocando cada evento na primeira coluna livre, o
// número de colunas usado é sempre o mínimo possível (igual à profundidade
// máxima de sobreposição simultânea) — não é heurística, é ótimo.
//
// Sem React/DOM aqui de propósito: função pura, fácil de testar isoladamente
// (ver layoutDayEvents.test.ts). O componente que consome isso só faz o
// desenho a partir de top/height/left/right já calculados.

export interface TimedEvent {
  id: string
  start: Date
  end: Date
}

export interface LayoutResult<T extends TimedEvent> {
  event: T
  /** % do topo, relativo a [dayStart, dayEnd] */
  top: number
  /** % de altura, relativo a [dayStart, dayEnd] */
  height: number
  /** % da esquerda, dentro da coluna do dia */
  left: number
  /** % de largura, dentro da coluna do dia */
  width: number
}

const MIN_DURATION_MS = 15 * 60 * 1000

interface ClampedEvent<T extends TimedEvent> {
  event: T
  start: number // epoch ms, já clampado a [dayStart,dayEnd] e com duração mínima
  end: number
}

/** Duas janelas [aStart,aEnd) e [bStart,bEnd) colidem — half-open: eventos
 * encostados (fim de um == início do outro) NÃO colidem. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function layoutDayEvents<T extends TimedEvent>(events: T[], dayStart: Date, dayEnd: Date): LayoutResult<T>[] {
  const rangeStart = dayStart.getTime()
  const rangeEnd = dayEnd.getTime()
  const rangeMs = rangeEnd - rangeStart
  if (rangeMs <= 0) return []

  // 1. Clampa cada evento à janela visível e garante duração mínima (eventos
  // de duração zero/negativa — acontece em ICS malformado — não podem
  // desaparecer do grid nem quebrar a checagem de colisão).
  const clamped: ClampedEvent<T>[] = []
  for (const event of events) {
    let start = Math.max(event.start.getTime(), rangeStart)
    let end = Math.min(event.end.getTime(), rangeEnd)
    if (end <= start) end = Math.min(start + MIN_DURATION_MS, rangeEnd)
    if (end <= start) start = Math.max(end - MIN_DURATION_MS, rangeStart)
    if (end <= start) continue // janela do dia menor que a duração mínima — não deveria acontecer
    clamped.push({ event, start, end })
  }

  // 2. Ordena por início asc, fim desc (evento "contêiner" cai na coluna 0),
  // id como desempate estável.
  clamped.sort((a, b) => a.start - b.start || b.end - a.end || a.event.id.localeCompare(b.event.id))

  const results: LayoutResult<T>[] = []

  // 3+4. Agrupa em clusters e aloca colunas gulosamente dentro de cada um.
  let clusterItems: ClampedEvent<T>[] = []
  let clusterColumns: ClampedEvent<T>[][] = []
  let maxEndSoFar: number | null = null

  const flushCluster = () => {
    if (clusterItems.length === 0) return
    const totalColumns = clusterColumns.length

    // 5. Passo de expansão: cada evento ocupa quantas colunas seguintes
    // estiverem livres (sem colidir com nenhum evento delas), eliminando
    // espaço morto à direita.
    for (let colIndex = 0; colIndex < clusterColumns.length; colIndex++) {
      for (const item of clusterColumns[colIndex]) {
        let colSpan = 1
        outer: while (colIndex + colSpan < clusterColumns.length) {
          for (const other of clusterColumns[colIndex + colSpan]) {
            if (overlaps(item.start, item.end, other.start, other.end)) break outer
          }
          colSpan++
        }

        results.push({
          event: item.event,
          top: ((item.start - rangeStart) / rangeMs) * 100,
          height: ((item.end - item.start) / rangeMs) * 100,
          left: (colIndex / totalColumns) * 100,
          width: (colSpan / totalColumns) * 100,
        })
      }
    }

    clusterItems = []
    clusterColumns = []
    maxEndSoFar = null
  }

  for (const item of clamped) {
    if (maxEndSoFar !== null && item.start >= maxEndSoFar) {
      flushCluster()
    }

    let placed = false
    for (const column of clusterColumns) {
      const last = column[column.length - 1]
      // Só precisa checar o último elemento da coluna: como a entrada está
      // ordenada por início, se `item` não colide com o último evento da
      // coluna, também não colide com nenhum anterior a ele nela.
      if (!overlaps(item.start, item.end, last.start, last.end)) {
        column.push(item)
        placed = true
        break
      }
    }
    if (!placed) {
      clusterColumns.push([item])
    }

    clusterItems.push(item)
    maxEndSoFar = maxEndSoFar === null ? item.end : Math.max(maxEndSoFar, item.end)
  }
  flushCluster()

  return results
}
