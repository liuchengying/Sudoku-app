import type { PuzzleTier, SudokuLevel, SudokuTechnique } from '@/core/sudoku'
import puzzleBank from './puzzles.json'

interface PuzzleSeed {
  puzzle: string
  solution: string
  clueCount: number
  difficultyScore: number
  techniques: SudokuTechnique[]
  tier?: PuzzleTier
}

const bank = puzzleBank as Record<string, PuzzleSeed[]>

function createDifficultyLevels(difficultyId: string): SudokuLevel[] {
  const seeds = bank[difficultyId] ?? []
  return seeds.map((seed, offset) => ({
    id: `${difficultyId}-${String(offset + 1).padStart(3, '0')}`,
    difficultyId,
    levelNo: offset + 1,
    puzzle: seed.puzzle,
    solution: seed.solution,
    difficultyScore: seed.difficultyScore,
    clueCount: seed.clueCount,
    techniques: seed.techniques,
    tier: seed.tier,
    version: 1
  }))
}

export const LEVELS: SudokuLevel[] = [
  ...createDifficultyLevels('master'),
  ...createDifficultyLevels('king'),
  ...createDifficultyLevels('grandmaster')
]

const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]))
const LEVELS_BY_DIFFICULTY = new Map<string, SudokuLevel[]>()
for (const level of LEVELS) {
  const levels = LEVELS_BY_DIFFICULTY.get(level.difficultyId) ?? []
  levels.push(level)
  LEVELS_BY_DIFFICULTY.set(level.difficultyId, levels)
}

export function getLevelsByDifficulty(difficultyId: string): SudokuLevel[] {
  return LEVELS_BY_DIFFICULTY.get(difficultyId) ?? []
}

export function getLevelById(levelId: string): SudokuLevel | undefined {
  return LEVEL_BY_ID.get(levelId)
}
