import type { LevelProgress } from '@/types/progress'
import { readStorage, writeStorage } from './storage'

const KEY = 'sudoku:v1:progress'

export const progressRepository = {
  load(): Record<string, LevelProgress> {
    return readStorage<Record<string, LevelProgress>>(KEY, {})
  },
  save(progress: Record<string, LevelProgress>): void {
    writeStorage(KEY, progress)
  },
  clear(): void {
    writeStorage(KEY, {})
  }
}
