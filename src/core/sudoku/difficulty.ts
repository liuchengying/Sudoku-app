import { solveLogically, techniqueWeight } from './logical'
import type { DifficultyResult } from './types'

export function rateDifficulty(input: number[]): DifficultyResult {
  const logical = solveLogically(input)
  let score = logical.score
  const techniques = [...logical.techniques]

  if (!logical.solved) {
    if (!techniques.includes('BACKTRACKING')) techniques.push('BACKTRACKING')
    score += techniqueWeight('BACKTRACKING') + logical.remaining * 6
  }

  const blanks = input.filter((value) => value === 0).length
  score += Math.max(0, blanks - 42) * 2

  return {
    score,
    techniques,
    solvedLogically: logical.solved,
    remaining: logical.remaining
  }
}
