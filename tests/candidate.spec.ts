import { describe, expect, it } from 'vitest'
import { getCandidateMask, hasDigit, parseBoard } from '@/core/sudoku'

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'

describe('Candidate calculation', () => {
  it('calculates candidates from row, column and box constraints', () => {
    const board = parseBoard(puzzle)
    const mask = getCandidateMask(board, 2)
    expect(hasDigit(mask, 1)).toBe(true)
    expect(hasDigit(mask, 2)).toBe(true)
    expect(hasDigit(mask, 4)).toBe(true)
    expect(hasDigit(mask, 5)).toBe(false)
    expect(hasDigit(mask, 3)).toBe(false)
  })
})
