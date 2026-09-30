import { action, boards, event, nonnegative, object, snapshot, snapshots } from './validation'
import type { GameState } from '@/core/sudoku'
import { readStorage, removeStorage, writeStorage } from './storage'
import { getLevelById } from '@/assets/puzzles'
import { validGeneratedCampaignLevel } from './campaign.repository'

const KEY = 'sudoku:v1:current-game'

function normalize(raw: unknown): GameState | null {
  if (!object(raw) || typeof raw.id !== 'string' || typeof raw.levelId !== 'string' || typeof raw.difficultyId !== 'string' || !boards(raw.puzzle, raw.solution) || !Array.isArray(raw.cells) || raw.cells.length !== 81 || !raw.cells.every((c, i) => snapshot(c) && object(c) && c.index === i && c.solution === Number(String(raw.solution)[i]) && (String(raw.puzzle)[i] === '0' ? c.origin !== 'GIVEN' : c.origin === 'GIVEN' && c.value === Number(String(raw.puzzle)[i]))) || !['READY', 'PLAYING', 'PAUSED', 'COMPLETED'].includes(String(raw.status)) || !['NORMAL', 'NOTE'].includes(String(raw.inputMode)) || ![raw.mistakeCount, raw.hintCount, raw.startedAt, raw.accumulatedTime, raw.createdAt, raw.updatedAt].every(nonnegative) || (raw.activeStartedAt !== null && !nonnegative(raw.activeStartedAt))) return null
  const game = raw as unknown as GameState
  const mode = ['CAMPAIGN', 'PRACTICE', 'DAILY', 'CUSTOM'].includes(String(game.mode)) ? game.mode : 'CAMPAIGN'
  const level = mode === 'CAMPAIGN' ? getLevelById(game.levelId) ?? (validGeneratedCampaignLevel(game.level) ? game.level : undefined) : game.level
  if (!level || level.id !== game.levelId || level.difficultyId !== game.difficultyId || level.puzzle !== game.puzzle || level.solution !== game.solution) return null
  const safeAction = (v: unknown) => action(v) && v.changes.every(c => game.puzzle[c.index] === '0' && c.before.origin !== 'GIVEN' && c.after.origin !== 'GIVEN')
  const safeEvent = (v: unknown) => event(v) && v.changes.every(c => game.puzzle[c.index] === '0' && c.before.origin !== 'GIVEN' && c.after.origin !== 'GIVEN')
  const safeSnapshots = (v: unknown) => snapshots(v) && v.every((c, i) => game.puzzle[i] === '0' ? c.origin !== 'GIVEN' : c.origin === 'GIVEN' && c.value === Number(game.puzzle[i]))
  return {
    ...game,
    selectedIndex: Number.isInteger(game.selectedIndex) && Number(game.selectedIndex) >= 0 && Number(game.selectedIndex) < 81 ? game.selectedIndex : null,
    mode,
    level,
    undoStack: Array.isArray(game.undoStack) ? game.undoStack.filter(safeAction) : [],
    redoStack: Array.isArray(game.redoStack) ? game.redoStack.filter(safeAction) : [],
    timeline: Array.isArray(game.timeline) ? game.timeline.filter(safeEvent) : [],
    timelineBase: safeSnapshots(game.timelineBase) ? game.timelineBase : undefined,
    bookmark: safeSnapshots(game.bookmark) ? game.bookmark : undefined,
    completion: null
  }
}

export const currentGameRepository = {
  load(): GameState | null {
    return normalize(readStorage<GameState | null>(KEY, null))
  },
  save(game: GameState): void {
    writeStorage(KEY, game)
  },
  clear(): void {
    writeStorage(KEY, null)
    removeStorage(KEY)
  }
}
