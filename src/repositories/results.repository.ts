import type { GameCompletion } from '@/core/sudoku'
import type { GameRecord, LevelProgress, LifetimeTotals, MedalType } from '@/types/progress'
import { readStorage, writeStorage } from './storage'
import { boards, event, nonnegative, object, origin, snapshots } from './validation'

export const RESULTS_KEY = 'sudoku:v3:results'
interface Results {
  progress: Record<string, LevelProgress>
  history: GameRecord[]
  totals: LifetimeTotals
  dailyDates: string[]
  serial: number
  lastSettlement: { gameId: string; completion: GameCompletion } | null
  discardedGameId?: string
}
export function emptyTotals(): LifetimeTotals {
  return { totalPlayTime: 0, mistakes: 0, hints: 0, totalCompletions: 0, byDifficulty: {}, byMode: { CAMPAIGN: 0, PRACTICE: 0, DAILY: 0, CUSTOM: 0 }, medals: { GOLD: 0, SILVER: 0, BRONZE: 0 } }
}
export function normalizeRecords(raw: unknown): GameRecord[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(r => object(r) && typeof r.id === 'string' && typeof r.levelId === 'string' && typeof r.difficultyId === 'string' && boards(r.puzzle, r.solution) && Array.isArray(r.finalValues) && r.finalValues.length === 81 && r.finalValues.every((v: unknown, i: number) => v === Number(String(r.solution)[i])) && Array.isArray(r.origins) && r.origins.length === 81 && r.origins.every(origin) && ['GOLD', 'SILVER', 'BRONZE'].includes(String(r.medal)) && [r.elapsedTime, r.mistakeCount, r.hintCount, r.startedAt, r.completedAt].every(nonnegative)).map((r, i) => ({
    ...r, serialNo: Number.isInteger(r.serialNo) && r.serialNo > 0 ? r.serialNo : raw.length - i,
    levelNo: nonnegative(r.levelNo) ? r.levelNo : Number(r.levelId.split('-').pop()) || 0,
    baseScore: nonnegative(r.baseScore) ? r.baseScore : nonnegative(r.score) ? r.score : 0,
    scoreAwarded: nonnegative(r.scoreAwarded) ? r.scoreAwarded : nonnegative(r.score) ? r.score : 0,
    actions: [], timeline: Array.isArray(r.timeline) ? r.timeline.filter(event) : Array.isArray(r.actions) ? r.actions.map((a: any) => ({ ...a, kind: 'APPLY', actionType: a.type })).filter(event) : [],
    timelineBase: snapshots(r.timelineBase) ? r.timelineBase : undefined,
    mode: ['CAMPAIGN', 'PRACTICE', 'DAILY', 'CUSTOM'].includes(r.mode) ? r.mode : 'CAMPAIGN'
  })) as GameRecord[]
}
function normalizeProgress(raw: unknown): Record<string, LevelProgress> {
  if (!object(raw)) return {}
  return Object.fromEntries(Object.entries(raw).filter(([id, p]) => object(p) && p.levelId === id && typeof p.difficultyId === 'string' && typeof p.completed === 'boolean' && nonnegative(p.baseScore) && nonnegative(p.completionCount) && (p.bestMedal === null || ['GOLD', 'SILVER', 'BRONZE'].includes(String(p.bestMedal))) && [p.levelNo, p.bestTime, p.minMistakes, p.minHints, p.firstCompletedAt, p.lastCompletedAt].every(v => v === null || nonnegative(v)))) as Record<string, LevelProgress>
}
function addTotals(t: LifetimeTotals, r: GameRecord) {
  t.totalCompletions++; t.totalPlayTime += r.elapsedTime; t.mistakes += r.mistakeCount; t.hints += r.hintCount
  t.byDifficulty[r.difficultyId] = (t.byDifficulty[r.difficultyId] ?? 0) + 1
  t.byMode[r.mode ?? 'CAMPAIGN']++
  t.medals[r.medal]++
}
function validTotals(t: unknown): t is LifetimeTotals {
  return object(t) && [t.totalPlayTime, t.mistakes, t.hints, t.totalCompletions].every(nonnegative) && object(t.byDifficulty) && Object.values(t.byDifficulty).every(nonnegative) && object(t.byMode) && ['CAMPAIGN', 'PRACTICE', 'DAILY', 'CUSTOM'].every(k => nonnegative((t.byMode as Record<string, unknown>)[k]))
}
function load(): Results {
  const saved = readStorage<unknown>(RESULTS_KEY, null)
  const canonical = object(saved)
  const history = normalizeRecords(canonical ? saved.history : readStorage<unknown>('sudoku:v1:history', []))
  const totals = emptyTotals(); history.forEach(r => addTotals(totals, r))
  const last = canonical && object(saved.lastSettlement) ? saved.lastSettlement : null
  const storedTotals = canonical && validTotals(saved.totals) ? saved.totals : null
  const storedMedals = storedTotals?.medals
  const medals = object(storedMedals) && (['GOLD', 'SILVER', 'BRONZE'] as const).every(k => nonnegative(storedMedals[k])) ? storedMedals as LifetimeTotals['medals'] : totals.medals
  return {
    progress: normalizeProgress(canonical ? saved.progress : readStorage<unknown>('sudoku:v1:progress', {})), history,
    totals: storedTotals ? { ...storedTotals, medals } : totals,
    dailyDates: canonical && Array.isArray(saved.dailyDates) ? [...new Set(saved.dailyDates.filter((d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort() : [],
    serial: Math.max(canonical && nonnegative(saved.serial) ? saved.serial : 0, ...history.map(r => r.serialNo), 0),
    lastSettlement: last && typeof last.gameId === 'string' && object(last.completion) && ['GOLD', 'SILVER', 'BRONZE'].includes(String(last.completion.medal)) && [last.completion.completedAt, last.completion.baseScore, last.completion.scoreAwarded].every(nonnegative) && typeof last.completion.firstCompletion === 'boolean' ? last as Results['lastSettlement'] : null,
    discardedGameId: canonical && typeof saved.discardedGameId === 'string' ? saved.discardedGameId : undefined
  }
}
function save(state: Results) {
  state.history = state.history.slice(0, 1000).map((r, i) => i < 50 ? r : { ...r, timeline: [], actions: [], timelineBase: undefined })
  let size = JSON.stringify(state).length
  for (let i = state.history.length - 1; i > 0 && size > 1_500_000; i--) {
    const r = state.history[i]; if (!r.timeline.length) continue
    state.history[i] = { ...r, timeline: [], timelineBase: undefined }; size = JSON.stringify(state).length
  }
  writeStorage(RESULTS_KEY, state)
}
function rank(m: MedalType | null): number { return m === 'GOLD' ? 3 : m === 'SILVER' ? 2 : m === 'BRONZE' ? 1 : 0 }
function append(state: Results, input: Omit<GameRecord, 'serialNo'> & { serialNo?: number }): GameRecord {
  const existing = state.history.find(r => r.id === input.id); if (existing) return existing
  const record: GameRecord = { ...input, serialNo: ++state.serial, mode: input.mode ?? 'CAMPAIGN' }
  state.history.unshift(record); addTotals(state.totals, record)
  if (record.mode === 'DAILY' && record.dailyDate && !state.dailyDates.includes(record.dailyDate)) state.dailyDates = [...state.dailyDates, record.dailyDate].sort()
  return record
}
export const resultsRepository = {
  load,
  completionFor(gameId: string): GameCompletion | null {
    const state = load()
    if (state.lastSettlement?.gameId === gameId) return state.lastSettlement.completion
    const record = state.history.find(r => r.id === `record-${gameId}`)
    return record ? { completedAt: record.completedAt, medal: record.medal, baseScore: record.baseScore, scoreAwarded: record.scoreAwarded, firstCompletion: record.scoreAwarded > 0 } : null
  },
  settle(gameId: string, input: Omit<GameRecord, 'serialNo' | 'scoreAwarded'>): GameCompletion {
    const state = load()
    if (state.discardedGameId === gameId) throw new Error('This game was discarded by a progress reset')
    if (state.lastSettlement?.gameId === gameId) return state.lastSettlement.completion
    const prior = state.history.find(r => r.id === input.id)
    if (prior) return { completedAt: prior.completedAt, medal: prior.medal, baseScore: prior.baseScore, scoreAwarded: prior.scoreAwarded, firstCompletion: prior.scoreAwarded > 0 }
    const campaign = (input.mode ?? 'CAMPAIGN') === 'CAMPAIGN'
    const existing = state.progress[input.levelId]
    const firstCompletion = campaign && !existing?.completed
    const completion: GameCompletion = { completedAt: input.completedAt, medal: input.medal, baseScore: campaign ? input.baseScore : 0, scoreAwarded: firstCompletion ? input.baseScore : 0, firstCompletion }
    if (campaign) state.progress[input.levelId] = {
      levelId: input.levelId, difficultyId: input.difficultyId, levelNo: input.levelNo, completed: true, baseScore: existing?.baseScore ?? input.baseScore,
      bestMedal: rank(input.medal) > rank(existing?.bestMedal ?? null) ? input.medal : existing?.bestMedal ?? input.medal,
      bestTime: Math.min(existing?.bestTime ?? Infinity, input.elapsedTime), minMistakes: Math.min(existing?.minMistakes ?? Infinity, input.mistakeCount), minHints: Math.min(existing?.minHints ?? Infinity, input.hintCount),
      completionCount: (existing?.completionCount ?? 0) + 1, firstCompletedAt: existing?.firstCompletedAt ?? input.completedAt, lastCompletedAt: input.completedAt
    }
    append(state, { ...input, baseScore: completion.baseScore, scoreAwarded: completion.scoreAwarded })
    state.lastSettlement = { gameId, completion }
    save(state) // One write commits progress, history and counters together.
    return completion
  },
  addRecord(input: Omit<GameRecord, 'serialNo'> & { serialNo?: number }): GameRecord { const s = load(); const r = append(s, input); save(s); return r },
  saveProgress(progress: Record<string, LevelProgress>) { const s = load(); s.progress = progress; save(s) },
  removeRecord(id: string) { const s = load(); s.history = s.history.filter(r => r.id !== id); save(s) },
  clearHistory() { const s = load(); s.history = []; save(s) },
  clearProgress() { const s = load(); s.progress = {}; save(s) },
  reset() {
    const current = readStorage<unknown>('sudoku:v1:current-game', null)
    save({ progress: {}, history: [], totals: emptyTotals(), dailyDates: [], serial: 0, lastSettlement: null, discardedGameId: object(current) && typeof current.id === 'string' ? current.id : undefined })
  }
}
