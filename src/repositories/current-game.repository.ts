import type { GameState } from '@/core/sudoku'
import { readStorage, removeStorage, writeStorage } from './storage'

const KEY = 'sudoku:v1:current-game'

function normalize(game: GameState | null): GameState | null {
  if (!game || !Array.isArray(game.cells) || game.cells.length !== 81) return null
  return {
    ...game,
    undoStack: game.undoStack ?? [],
    redoStack: game.redoStack ?? [],
    timeline: game.timeline ?? [],
    completion: game.completion ?? null
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
    removeStorage(KEY)
  }
}
