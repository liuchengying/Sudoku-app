import type { CellOrigin, GameAction, ReplayEvent } from '@/core/sudoku'

export type MedalType = 'GOLD' | 'SILVER' | 'BRONZE'

export interface LevelProgress {
  levelId: string
  difficultyId: string
  levelNo: number
  completed: boolean
  baseScore: number
  bestMedal: MedalType | null
  bestTime: number | null
  minMistakes: number | null
  minHints: number | null
  completionCount: number
  firstCompletedAt: number | null
  lastCompletedAt: number | null
}

export interface GameRecord {
  id: string
  serialNo: number
  levelId: string
  difficultyId: string
  levelNo: number
  puzzle: string
  solution: string
  finalValues: number[]
  origins: CellOrigin[]
  elapsedTime: number
  mistakeCount: number
  hintCount: number
  baseScore: number
  scoreAwarded: number
  medal: MedalType
  startedAt: number
  completedAt: number
  actions: GameAction[]
  timeline: ReplayEvent[]
}

export interface StatisticsData {
  totalScore: number
  completedLevels: number
  gold: number
  silver: number
  bronze: number
  totalPlayTime: number
  mistakes: number
  hints: number
  totalCompletions: number
}
