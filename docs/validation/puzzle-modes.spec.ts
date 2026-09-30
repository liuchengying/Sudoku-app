import { describe, expect, it } from 'vitest'
import { LEVELS } from '@/assets/puzzles'
import { countSolutions, generatePuzzle, isSolved, parseBoard, rateDifficulty, serializeBoard, solve } from '@/core/sudoku'
import { classifyDifficulty, PRACTICE_TIERS } from '@/config/practice'
import { createDailyLevel, createPracticeLevel, GenerationCancelled, importPuzzle, localDate } from '@/services/puzzle.service'
import { previousDate, streaks } from '@/services/daily.service'

describe('Difficulty and offline generation', () => {
  it('calibrates all bundled metadata from the real logical solver', () => {
    for (const level of LEVELS) {
      const rating = rateDifficulty(parseBoard(level.puzzle))
      expect(level.difficultyScore, level.id).toBe(rating.score)
      expect(level.techniques, level.id).toEqual(rating.techniques)
      expect(level.tier, level.id).toBe(classifyDifficulty(rating))
    }
  })

  it('digs cells throughout an asymmetric puzzle', () => {
    for (const seed of [1, 42, 20260930]) {
      const generated = generatePuzzle({ seed, targetClues: 25, symmetry: false })
      expect(generated.puzzle.filter(Boolean).length).toBeLessThan(40)
      expect(generated.puzzle.slice(41).some(v => v === 0)).toBe(true)
      expect(countSolutions(generated.puzzle, 2)).toBe(1)
    }
  })

  it.each(PRACTICE_TIERS)('generates reproducible unique games at $id difficulty', async ({ id }) => {
    const a = await createPracticeLevel(id, 20260930)
    const b = await createPracticeLevel(id, 20260930)
    expect(a).toEqual(b)
    expect(a.tier).toBe(id)
    expect(classifyDifficulty(rateDifficulty(parseBoard(a.puzzle)))).toBe(id)
    expect(isSolved(parseBoard(a.solution))).toBe(true)
    expect(countSolutions(parseBoard(a.puzzle), 2)).toBe(1)
    expect(serializeBoard(solve(parseBoard(a.puzzle))!)).toBe(a.solution)
    const next = await createPracticeLevel(id, 20260931)
    expect(next.puzzle).not.toBe(a.puzzle)
  }, 15000)

  it('generates a stable daily puzzle and uses local calendar dates', () => {
    const a = createDailyLevel('2026-09-30')
    expect(a).toEqual(createDailyLevel('2026-09-30'))
    expect(a.puzzle).not.toBe(createDailyLevel('2026-10-01').puzzle)
    expect(countSolutions(parseBoard(a.puzzle), 2)).toBe(1)
    expect(localDate(new Date(2026, 8, 30, 0, 1))).toBe('2026-09-30')
    expect(previousDate('2024-03-01')).toBe('2024-02-29')
    expect(() => createDailyLevel('2026-02-30')).toThrow('有效日期')
  })

  it('rejects cancelled generation and excludes recent boards', async () => {
    await expect(createPracticeLevel('beginner', 1, { isCancelled: () => true })).rejects.toBeInstanceOf(GenerationCancelled)
    const a = await createPracticeLevel('beginner', 42)
    const next = await createPracticeLevel('beginner', 42, { excluded: new Set([a.puzzle]) })
    expect(next.puzzle).not.toBe(a.puzzle)
    expect(next.tier).toBe('beginner')
  })

  it('keeps tier and unique-solution guarantees across multiple independent seeds', async () => {
    for (const { id } of PRACTICE_TIERS) for (const seed of [1, 42, 731, 98413, 2147483647, 4294967295]) {
      const level = await createPracticeLevel(id, seed)
      expect(classifyDifficulty(rateDifficulty(parseBoard(level.puzzle))), `${id}-${seed}`).toBe(id)
      expect(countSolutions(parseBoard(level.puzzle), 2), `${id}-${seed}`).toBe(1)
    }
  }, 20000)

  it('computes streaks with gaps, duplicate dates, leap dates and a missed today', () => {
    expect(streaks(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-29'], '2026-09-30')).toEqual({ current: 3, best: 3 })
    expect(streaks(['2026-09-27', '2026-09-28'], '2026-09-30')).toEqual({ current: 0, best: 2 })
    expect(streaks(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01')).toEqual({ current: 3, best: 3 })
  })
})

describe('Custom puzzle import', () => {
  it('accepts formatted input with a single solution', () => {
    const puzzle = LEVELS[0].puzzle.replace(/0/g, '.').match(/.{9}/g)!.join('\n')
    expect(importPuzzle(puzzle).solution).toBe(LEVELS[0].solution)
  })
  it('rejects malformed, conflicting, ambiguous and already completed boards', () => {
    expect(() => importPuzzle('abc')).toThrow('81')
    expect(() => importPuzzle('11' + '0'.repeat(79))).toThrow('重复')
    expect(() => importPuzzle('0'.repeat(81))).toThrow('多个解')
    expect(() => importPuzzle(LEVELS[0].solution)).toThrow('填满')
  })
})
