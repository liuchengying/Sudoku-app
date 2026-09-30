import { colOf, rowOf } from './board'
import { nextLogicalPlacement } from './logical'
import type { HintResult, SudokuTechnique } from './types'

const TECHNIQUE_NAMES: Record<SudokuTechnique, string> = {
  NAKED_SINGLE: '唯一候选',
  HIDDEN_SINGLE: '隐藏唯一',
  LOCKED_CANDIDATE: '区块排除',
  NAKED_PAIR: '裸对',
  HIDDEN_PAIR: '隐藏对',
  NAKED_TRIPLE: '裸三数组',
  X_WING: 'X-Wing',
  BACKTRACKING: '答案提示'
}

export function techniqueName(technique: SudokuTechnique): string {
  return TECHNIQUE_NAMES[technique]
}

export function findHint(board: number[]): HintResult | null {
  const result = nextLogicalPlacement(board)
  if (!result || result.step.index == null || result.step.digit == null) return null
  const { step, preceding } = result
  const index = step.index
  const digit = step.digit
  if (index == null || digit == null) return null
  const prefix = preceding.length
    ? `先用${[...new Set(preceding)].map(techniqueName).join('、')}排除候选后，`
    : ''
  return {
    index,
    digit,
    technique: step.technique,
    message: `${prefix}${step.message}。位置：第 ${rowOf(index) + 1} 行第 ${colOf(index) + 1} 列。`
  }
}
