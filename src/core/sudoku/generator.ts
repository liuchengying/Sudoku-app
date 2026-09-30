import { FULL_MASK, boxOf, colOf, rowOf, serializeBoard } from './board'
import { digitBit, maskToDigits, popCount } from './candidate'
import { countSolutions } from './solver'
import { rateDifficulty } from './difficulty'
import type { SudokuLevel } from './types'

export interface GeneratorOptions {
  seed: number
  targetClues: number
  symmetry?: boolean
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function generateSolvedBoard(random: () => number): number[] {
  const board = Array(81).fill(0) as number[]
  const rows = Array(9).fill(0) as number[]
  const cols = Array(9).fill(0) as number[]
  const boxes = Array(9).fill(0) as number[]

  const candidateMask = (index: number) => FULL_MASK & ~(rows[rowOf(index)] | cols[colOf(index)] | boxes[boxOf(index)])

  const search = (): boolean => {
    let bestCount = 10
    const best: { index: number; mask: number }[] = []
    for (let index = 0; index < 81; index += 1) {
      if (board[index] !== 0) continue
      const mask = candidateMask(index)
      const count = popCount(mask)
      if (count === 0) return false
      if (count < bestCount) {
        bestCount = count
        best.length = 0
        best.push({ index, mask })
      } else if (count === bestCount) {
        best.push({ index, mask })
      }
    }
    if (!best.length) return true

    const target = best[Math.floor(random() * best.length)]
    const digits = shuffle(maskToDigits(target.mask), random)
    const r = rowOf(target.index)
    const c = colOf(target.index)
    const b = boxOf(target.index)
    for (const digit of digits) {
      const bit = digitBit(digit)
      board[target.index] = digit
      rows[r] |= bit
      cols[c] |= bit
      boxes[b] |= bit
      if (search()) return true
      board[target.index] = 0
      rows[r] &= ~bit
      cols[c] &= ~bit
      boxes[b] &= ~bit
    }
    return false
  }

  if (!search()) throw new Error('Failed to generate a solved Sudoku board.')
  return board
}

export function generatePuzzle(options: GeneratorOptions): { puzzle: number[]; solution: number[] } {
  const random = mulberry32(options.seed)
  const solution = generateSolvedBoard(random)
  const puzzle = [...solution]
  const targetClues = Math.max(17, Math.min(80, Math.floor(options.targetClues)))

  const groups: number[][] = []
  const seen = new Set<number>()
  for (let index = 0; index < 81; index += 1) {
    if (seen.has(index)) continue
    const mirror = 80 - index
    seen.add(index)
    seen.add(mirror)
    groups.push(options.symmetry === false || index === mirror ? [index] : [index, mirror])
  }
  shuffle(groups, random)

  for (const group of groups) {
    const clues = puzzle.filter(Boolean).length
    if (clues - group.length < targetClues) continue
    const previous = group.map((index) => puzzle[index])
    for (const index of group) puzzle[index] = 0
    if (countSolutions(puzzle, 2) !== 1) {
      group.forEach((index, offset) => { puzzle[index] = previous[offset] })
    }
    if (puzzle.filter(Boolean).length <= targetClues) break
  }

  return { puzzle, solution }
}

export function generateLevel(input: {
  id: string
  difficultyId: string
  levelNo: number
  seed: number
  targetClues: number
}): SudokuLevel {
  const generated = generatePuzzle({ seed: input.seed, targetClues: input.targetClues, symmetry: true })
  const rating = rateDifficulty(generated.puzzle)
  return {
    id: input.id,
    difficultyId: input.difficultyId,
    levelNo: input.levelNo,
    puzzle: serializeBoard(generated.puzzle),
    solution: serializeBoard(generated.solution),
    difficultyScore: rating.score,
    clueCount: generated.puzzle.filter(Boolean).length,
    techniques: rating.techniques,
    version: 1
  }
}
