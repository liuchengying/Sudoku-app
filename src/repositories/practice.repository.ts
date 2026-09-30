import type { PuzzleTier, SudokuLevel } from '@/core/sudoku'
import { readStorage, writeStorage } from './storage'
import { boards, object } from './validation'
const KEY = 'sudoku:v1:practice'
interface PracticeState { recent: string[]; cache: Partial<Record<PuzzleTier, SudokuLevel>> }
export const practiceRepository = {
  load(): PracticeState {
    const raw = readStorage<unknown>(KEY, null)
    if (!object(raw)) return { recent: [], cache: {} }
    const cache: PracticeState['cache'] = {}
    if (object(raw.cache)) for (const tier of ['beginner', 'easy', 'advanced', 'expert'] as PuzzleTier[]) {
      const level = raw.cache[tier]
      if (object(level) && level.tier === tier && level.difficultyId === tier && typeof level.id === 'string' && boards(level.puzzle, level.solution) && Array.isArray(level.techniques)) cache[tier] = level as unknown as SudokuLevel
    }
    return { recent: Array.isArray(raw.recent) ? raw.recent.filter((p): p is string => typeof p === 'string' && /^[0-9]{81}$/.test(p)).slice(-100) : [], cache }
  },
  save(state: PracticeState) { writeStorage(KEY, state) },
  clear() { writeStorage(KEY, { recent: [], cache: {} }) }
}
