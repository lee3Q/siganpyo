import type { TimeBlock } from '@/types'

export interface BlockColumnLayout {
  column: number
  totalColumns: number
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function overlaps(a: TimeBlock, b: TimeBlock): boolean {
  const aStart = timeToMinutes(a.startTime)
  const aEnd = timeToMinutes(a.endTime)
  const bStart = timeToMinutes(b.startTime)
  const bEnd = timeToMinutes(b.endTime)
  return aStart < bEnd && bStart < aEnd
}

export function computeBlockColumns(blocks: TimeBlock[]): Map<string, BlockColumnLayout> {
  const result = new Map<string, BlockColumnLayout>()

  if (blocks.length === 0) return result

  const sorted = [...blocks].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )

  const columns: { block: TimeBlock; endMinutes: number }[][] = []

  for (const block of sorted) {
    const blockEnd = timeToMinutes(block.endTime)
    let placed = false

    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1]
      if (timeToMinutes(lastInCol.block.endTime) <= timeToMinutes(block.startTime)) {
        columns[col].push({ block, endMinutes: blockEnd })
        result.set(block.id, { column: col, totalColumns: 0 })
        placed = true
        break
      }
    }

    if (!placed) {
      columns.push([{ block, endMinutes: blockEnd }])
      result.set(block.id, { column: columns.length - 1, totalColumns: 0 })
    }
  }

  for (const [id] of result) {
    const block = sorted.find((b) => b.id === id)!
    let maxCols = 1
    for (const other of sorted) {
      if (other.id !== id && overlaps(block, other)) {
        const otherCol = result.get(other.id)!
        maxCols = Math.max(maxCols, otherCol.column + 1)
      }
    }
    const entry = result.get(id)!
    entry.totalColumns = Math.max(entry.totalColumns, maxCols)
  }

  for (const [id] of result) {
    const entry = result.get(id)!
    let groupMax = entry.totalColumns
    const block = sorted.find((b) => b.id === id)!
    for (const other of sorted) {
      if (other.id !== id && overlaps(block, other)) {
        const otherEntry = result.get(other.id)!
        groupMax = Math.max(groupMax, otherEntry.column + 1, otherEntry.totalColumns)
      }
    }
    entry.totalColumns = Math.max(groupMax, entry.column + 1)
  }

  return result
}
