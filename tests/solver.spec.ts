import { describe, expect, it } from 'vitest'
import { countSolutions, parseBoard, serializeBoard, solve, validateBoard } from '@/core/sudoku'

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
const solution = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'

describe('Sudoku solver', () => {
  it('solves a valid puzzle', () => {
    const solved = solve(parseBoard(puzzle))
    expect(solved).not.toBeNull()
    expect(serializeBoard(solved!)).toBe(solution)
  })

  it('detects a unique solution', () => {
    expect(countSolutions(parseBoard(puzzle), 2)).toBe(1)
  })

  it('rejects duplicate givens', () => {
    const invalid = parseBoard(puzzle)
    invalid[2] = 5
    expect(validateBoard(invalid)).toBe(false)
    expect(solve(invalid)).toBeNull()
  })
})
