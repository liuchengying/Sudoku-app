import { describe, expect, it } from 'vitest'
import { parseBoard, rateDifficulty, solveLogically } from '@/core/sudoku'

const easy = '005203600006000030900051024000000108800514006201000000570930001040000500009805700'
const hard = '000700000420090073500003000000810030000005600050067000000100006240070019000009000'

describe('Logical solver', () => {
  it('solves a singles-friendly bundled puzzle logically', () => {
    const result = solveLogically(parseBoard(easy))
    expect(result.valid).toBe(true)
    expect(result.solved).toBe(true)
    expect(result.remaining).toBe(0)
    expect(result.steps.length).toBeGreaterThan(0)
  })

  it('rates harder boards without crashing when logic stalls', () => {
    const rating = rateDifficulty(parseBoard(hard))
    expect(rating.score).toBeGreaterThan(0)
    expect(rating.remaining).toBeGreaterThanOrEqual(0)
  })
})
