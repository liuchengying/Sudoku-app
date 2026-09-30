import { createCells } from './board'
import type { CellOrigin, CellSnapshot, ReplayEvent } from './types'

export function replayCells(record: { puzzle: string; solution: string; timeline: ReplayEvent[]; timelineBase?: CellSnapshot[]; finalValues: number[]; origins: CellOrigin[] }, position: number) {
  const cells = createCells(record.puzzle, record.solution)
  const cursor = Math.max(0, Math.min(record.timeline.length, Math.floor(position)))
  if (record.timelineBase?.length === 81) record.timelineBase.forEach((s, i) => Object.assign(cells[i], s))
  for (const e of record.timeline.slice(0, cursor)) for (const c of e.changes) Object.assign(cells[c.index], e.kind === 'APPLY' ? c.after : c.before)
  if (cursor === record.timeline.length) record.finalValues.forEach((value, i) => Object.assign(cells[i], { value, origin: record.origins[i], notesMask: 0, error: false }))
  return cells
}
