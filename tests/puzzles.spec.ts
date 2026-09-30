import { describe, expect, it } from 'vitest'
import { LEVELS } from '@/assets/puzzles'
import { countSolutions, isSolved, parseBoard, puzzleMatchesSolution, serializeBoard, solve, validateBoard } from '@/core/sudoku'

const difficultyIds = ['master', 'king', 'grandmaster']

describe('Bundled production puzzle bank', () => {
  it('contains 25 levels for every configured difficulty', () => {
    for (const id of difficultyIds) expect(LEVELS.filter((level) => level.difficultyId === id), id).toHaveLength(25)
    expect(LEVELS).toHaveLength(75)
  })

  it('has no duplicate puzzles', () => {
    expect(new Set(LEVELS.map((level) => level.puzzle)).size).toBe(LEVELS.length)
  })

  it('all puzzles are valid, unique-solution, and match their bundled solution', () => {
    for (const level of LEVELS) {
      const puzzle = parseBoard(level.puzzle)
      const solution = parseBoard(level.solution)
      expect(validateBoard(puzzle), level.id).toBe(true)
      expect(isSolved(solution), `${level.id}: solution`).toBe(true)
      expect(puzzleMatchesSolution(puzzle, solution), `${level.id}: givens`).toBe(true)
      expect(countSolutions(puzzle, 2), level.id).toBe(1)
      expect(serializeBoard(solve(puzzle)!), level.id).toBe(level.solution)
      expect(level.clueCount, level.id).toBe(puzzle.filter(Boolean).length)
    }
  })
})
