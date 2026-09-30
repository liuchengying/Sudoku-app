import type { GameRecord } from '@/types/progress'
import { readStorage, writeStorage } from './storage'

const KEY = 'sudoku:v1:history'
const MAX_RECORDS = 1000
const MAX_REPLAY_RECORDS = 50

function normalize(record: GameRecord): GameRecord {
  const legacy = record as GameRecord & { score?: number; timeline?: GameRecord['timeline']; levelNo?: number }
  return {
    ...record,
    serialNo: record.serialNo ?? 0,
    levelNo: legacy.levelNo ?? (Number(record.levelId.split('-').pop()) || 0),
    baseScore: record.baseScore ?? legacy.score ?? 0,
    scoreAwarded: record.scoreAwarded ?? legacy.score ?? 0,
    actions: record.actions ?? [],
    timeline: legacy.timeline ?? (record.actions ?? []).map((action) => ({
      id: `legacy-${action.id}`,
      kind: 'APPLY' as const,
      actionType: action.type,
      changes: action.changes,
      timestamp: action.timestamp
    }))
  }
}

export const historyRepository = {
  list(): GameRecord[] {
    const raw = readStorage<GameRecord[]>(KEY, [])
    const normalized = raw.map(normalize)
    const maxKnown = normalized.reduce((max, item) => Math.max(max, item.serialNo || 0), 0)
    const baseline = Math.max(maxKnown, normalized.length)
    return normalized.map((item, index) => item.serialNo > 0 ? item : { ...item, serialNo: baseline - index })
  },
  add(record: Omit<GameRecord, 'serialNo'> & { serialNo?: number }): GameRecord {
    const records = this.list()
    const maxSerial = records.reduce((max, item) => Math.max(max, item.serialNo || 0), 0)
    const next: GameRecord = { ...record, serialNo: record.serialNo || maxSerial + 1 }
    records.unshift(next)

    // Detailed replay data is intentionally kept only for the newest records.
    // Older history still retains the final board and score, which keeps local
    // storage practical while allowing hundreds of history cards like the original app.
    const compacted = records.slice(0, MAX_RECORDS).map((item, index) => index < MAX_REPLAY_RECORDS
      ? item
      : { ...item, actions: [], timeline: [] })
    writeStorage(KEY, compacted)
    return next
  },
  findById(id: string): GameRecord | null {
    return this.list().find((record) => record.id === id) ?? null
  },
  remove(id: string): void {
    writeStorage(KEY, this.list().filter((record) => record.id !== id))
  },
  clear(): void {
    writeStorage(KEY, [])
  }
}
