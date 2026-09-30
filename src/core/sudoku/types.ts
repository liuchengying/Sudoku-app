export type CellOrigin = 'GIVEN' | 'USER' | 'HINT' | null

export interface SudokuCell {
  index: number
  value: number
  solution: number
  origin: CellOrigin
  notesMask: number
  error: boolean
}

export interface CellSnapshot {
  value: number
  origin: CellOrigin
  notesMask: number
  error: boolean
}

export interface CellChange {
  index: number
  before: CellSnapshot
  after: CellSnapshot
}

export type GameActionType =
  | 'SET_VALUE'
  | 'CLEAR_VALUE'
  | 'SET_NOTES'
  | 'SET_ALL_NOTES'
  | 'TOGGLE_NOTE'
  | 'HINT'

export interface GameAction {
  id: string
  type: GameActionType
  changes: CellChange[]
  timestamp: number
}

export type ReplayEventKind = 'APPLY' | 'REVERT'

export interface ReplayEvent {
  id: string
  kind: ReplayEventKind
  actionType: GameActionType
  changes: CellChange[]
  timestamp: number
}

export type GameStatus = 'READY' | 'PLAYING' | 'PAUSED' | 'COMPLETED'
export type InputMode = 'NORMAL' | 'NOTE'

export interface GameCompletion {
  completedAt: number
  medal: 'GOLD' | 'SILVER' | 'BRONZE'
  baseScore: number
  scoreAwarded: number
  firstCompletion: boolean
}

export interface GameState {
  id: string
  levelId: string
  difficultyId: string
  puzzle: string
  solution: string
  cells: SudokuCell[]
  selectedIndex: number | null
  inputMode: InputMode
  status: GameStatus
  mistakeCount: number
  hintCount: number
  startedAt: number
  accumulatedTime: number
  activeStartedAt: number | null
  undoStack: GameAction[]
  redoStack: GameAction[]
  timeline: ReplayEvent[]
  completion: GameCompletion | null
  createdAt: number
  updatedAt: number
}

export type SudokuTechnique =
  | 'NAKED_SINGLE'
  | 'HIDDEN_SINGLE'
  | 'LOCKED_CANDIDATE'
  | 'NAKED_PAIR'
  | 'HIDDEN_PAIR'
  | 'NAKED_TRIPLE'
  | 'X_WING'
  | 'BACKTRACKING'

export interface SudokuLevel {
  id: string
  difficultyId: string
  levelNo: number
  puzzle: string
  solution: string
  difficultyScore: number
  clueCount: number
  techniques: SudokuTechnique[]
  version: number
}

export interface DifficultyResult {
  score: number
  techniques: SudokuTechnique[]
  solvedLogically: boolean
  remaining: number
}

export interface CandidateElimination {
  index: number
  mask: number
}

export interface LogicalStep {
  technique: SudokuTechnique
  kind: 'PLACE' | 'ELIMINATE'
  index?: number
  digit?: number
  eliminations?: CandidateElimination[]
  message: string
}

export interface LogicalSolveResult {
  board: number[]
  candidates: number[]
  steps: LogicalStep[]
  techniques: SudokuTechnique[]
  score: number
  solved: boolean
  valid: boolean
  remaining: number
}

export interface HintResult {
  index: number
  digit: number
  technique: SudokuTechnique
  message: string
}
