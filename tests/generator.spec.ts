import { describe, expect, it } from 'vitest'
import { countSolutions, generatePuzzle, isSolved, validateBoard } from '@/core/sudoku'

describe('Sudoku generator', () => {
  it('generates a valid uniquely-solvable puzzle for a deterministic seed', () => {
    const generated = generatePuzzle({ seed: 42, targetClues: 32, symmetry: true })
    expect(isSolved(generated.solution)).toBe(true)
    expect(validateBoard(generated.puzzle)).toBe(true)
    expect(countSolutions(generated.puzzle, 2)).toBe(1)
    expect(generated.puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(17)
  })
})
