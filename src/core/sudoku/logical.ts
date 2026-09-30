import { boxOf, colOf, FULL_MASK, peerIndexes, rowOf } from './board'
import { digitBit, getCandidateMask, hasDigit, maskToDigits, popCount } from './candidate'
import { validateBoard } from './validator'
import type { CandidateElimination, LogicalSolveResult, LogicalStep, SudokuTechnique } from './types'

const TECHNIQUE_WEIGHTS: Record<SudokuTechnique, number> = {
  NAKED_SINGLE: 1,
  HIDDEN_SINGLE: 2,
  LOCKED_CANDIDATE: 5,
  NAKED_PAIR: 9,
  HIDDEN_PAIR: 12,
  NAKED_TRIPLE: 18,
  X_WING: 34,
  BACKTRACKING: 90
}

const ROW_UNITS = Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => row * 9 + col))
const COL_UNITS = Array.from({ length: 9 }, (_, col) => Array.from({ length: 9 }, (_, row) => row * 9 + col))
const BOX_UNITS = Array.from({ length: 9 }, (_, box) => {
  const startRow = Math.floor(box / 3) * 3
  const startCol = (box % 3) * 3
  return Array.from({ length: 9 }, (_, offset) =>
    (startRow + Math.floor(offset / 3)) * 9 + startCol + (offset % 3)
  )
})
const ALL_UNITS = [...ROW_UNITS, ...COL_UNITS, ...BOX_UNITS]

function unitName(unit: number[]): string {
  const rows = new Set(unit.map(rowOf))
  const cols = new Set(unit.map(colOf))
  if (rows.size === 1) return `第 ${rowOf(unit[0]) + 1} 行`
  if (cols.size === 1) return `第 ${colOf(unit[0]) + 1} 列`
  return `第 ${boxOf(unit[0]) + 1} 宫`
}

function initializeCandidates(board: number[]): number[] {
  return board.map((value, index) => (value === 0 ? getCandidateMask(board, index) : 0))
}

function placeDigit(board: number[], candidates: number[], index: number, digit: number): boolean {
  if (board[index] !== 0) return board[index] === digit
  const bit = digitBit(digit)
  if ((candidates[index] & bit) === 0) return false
  board[index] = digit
  candidates[index] = 0
  for (const peer of peerIndexes(index)) {
    if (board[peer] === 0) candidates[peer] &= ~bit
  }
  return true
}

function applyEliminations(candidates: number[], eliminations: CandidateElimination[]): number {
  let changed = 0
  for (const item of eliminations) {
    const before = candidates[item.index]
    candidates[item.index] &= ~item.mask
    if (before !== candidates[item.index]) changed += 1
  }
  return changed
}

function findNakedSingle(board: number[], candidates: number[]): LogicalStep | null {
  for (let index = 0; index < 81; index += 1) {
    if (board[index] !== 0) continue
    if (popCount(candidates[index]) !== 1) continue
    const digit = maskToDigits(candidates[index])[0]
    return {
      technique: 'NAKED_SINGLE',
      kind: 'PLACE',
      index,
      digit,
      message: `第 ${rowOf(index) + 1} 行第 ${colOf(index) + 1} 列只剩候选 ${digit}`
    }
  }
  return null
}

function findHiddenSingle(board: number[], candidates: number[]): LogicalStep | null {
  for (const unit of ALL_UNITS) {
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = digitBit(digit)
      const locations = unit.filter((index) => board[index] === 0 && (candidates[index] & bit) !== 0)
      if (locations.length !== 1) continue
      const index = locations[0]
      return {
        technique: 'HIDDEN_SINGLE',
        kind: 'PLACE',
        index,
        digit,
        message: `${unitName(unit)}中只有第 ${rowOf(index) + 1} 行第 ${colOf(index) + 1} 列可以填 ${digit}`
      }
    }
  }
  return null
}

function findLockedCandidate(board: number[], candidates: number[]): LogicalStep | null {
  // Pointing: within a box, a digit is restricted to one row/column.
  for (let box = 0; box < 9; box += 1) {
    const unit = BOX_UNITS[box]
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = digitBit(digit)
      const locations = unit.filter((index) => board[index] === 0 && (candidates[index] & bit) !== 0)
      if (locations.length < 2) continue
      const rows = new Set(locations.map(rowOf))
      if (rows.size === 1) {
        const row = rowOf(locations[0])
        const eliminations = ROW_UNITS[row]
          .filter((index) => boxOf(index) !== box && board[index] === 0 && (candidates[index] & bit) !== 0)
          .map((index) => ({ index, mask: bit }))
        if (eliminations.length) {
          return {
            technique: 'LOCKED_CANDIDATE', kind: 'ELIMINATE', eliminations,
            message: `数字 ${digit} 在第 ${box + 1} 宫被锁定在第 ${row + 1} 行，可从该行其他宫删除 ${digit}`
          }
        }
      }
      const cols = new Set(locations.map(colOf))
      if (cols.size === 1) {
        const col = colOf(locations[0])
        const eliminations = COL_UNITS[col]
          .filter((index) => boxOf(index) !== box && board[index] === 0 && (candidates[index] & bit) !== 0)
          .map((index) => ({ index, mask: bit }))
        if (eliminations.length) {
          return {
            technique: 'LOCKED_CANDIDATE', kind: 'ELIMINATE', eliminations,
            message: `数字 ${digit} 在第 ${box + 1} 宫被锁定在第 ${col + 1} 列，可从该列其他宫删除 ${digit}`
          }
        }
      }
    }
  }

  // Claiming: within a row/column, a digit is restricted to one box.
  for (const unit of [...ROW_UNITS, ...COL_UNITS]) {
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = digitBit(digit)
      const locations = unit.filter((index) => board[index] === 0 && (candidates[index] & bit) !== 0)
      if (locations.length < 2) continue
      const boxes = new Set(locations.map(boxOf))
      if (boxes.size !== 1) continue
      const box = boxOf(locations[0])
      const unitSet = new Set(unit)
      const eliminations = BOX_UNITS[box]
        .filter((index) => !unitSet.has(index) && board[index] === 0 && (candidates[index] & bit) !== 0)
        .map((index) => ({ index, mask: bit }))
      if (eliminations.length) {
        return {
          technique: 'LOCKED_CANDIDATE', kind: 'ELIMINATE', eliminations,
          message: `${unitName(unit)}中的 ${digit} 都位于第 ${box + 1} 宫，可从该宫其他格删除 ${digit}`
        }
      }
    }
  }
  return null
}

function findNakedPair(board: number[], candidates: number[]): LogicalStep | null {
  for (const unit of ALL_UNITS) {
    const pairMap = new Map<number, number[]>()
    for (const index of unit) {
      if (board[index] !== 0 || popCount(candidates[index]) !== 2) continue
      const list = pairMap.get(candidates[index]) ?? []
      list.push(index)
      pairMap.set(candidates[index], list)
    }
    for (const [mask, locations] of pairMap) {
      if (locations.length !== 2) continue
      const locationSet = new Set(locations)
      const eliminations = unit
        .filter((index) => !locationSet.has(index) && board[index] === 0 && (candidates[index] & mask) !== 0)
        .map((index) => ({ index, mask }))
      if (eliminations.length) {
        const digits = maskToDigits(mask).join('、')
        return {
          technique: 'NAKED_PAIR', kind: 'ELIMINATE', eliminations,
          message: `${unitName(unit)}存在裸对 ${digits}，可从该单位其他格删除这两个候选`
        }
      }
    }
  }
  return null
}

function findHiddenPair(board: number[], candidates: number[]): LogicalStep | null {
  for (const unit of ALL_UNITS) {
    const digitLocations = new Map<number, number[]>()
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = digitBit(digit)
      const locations = unit.filter((index) => board[index] === 0 && (candidates[index] & bit) !== 0)
      if (locations.length === 2) digitLocations.set(digit, locations)
    }
    const digits = [...digitLocations.keys()]
    for (let a = 0; a < digits.length; a += 1) {
      for (let b = a + 1; b < digits.length; b += 1) {
        const d1 = digits[a]
        const d2 = digits[b]
        const l1 = digitLocations.get(d1)!
        const l2 = digitLocations.get(d2)!
        if (l1[0] !== l2[0] || l1[1] !== l2[1]) continue
        const keepMask = digitBit(d1) | digitBit(d2)
        const eliminations = l1
          .filter((index) => (candidates[index] & ~keepMask) !== 0)
          .map((index) => ({ index, mask: candidates[index] & ~keepMask }))
        if (eliminations.length) {
          return {
            technique: 'HIDDEN_PAIR', kind: 'ELIMINATE', eliminations,
            message: `${unitName(unit)}中 ${d1}、${d2} 只出现在同两个格，形成隐藏对`
          }
        }
      }
    }
  }
  return null
}

function findNakedTriple(board: number[], candidates: number[]): LogicalStep | null {
  for (const unit of ALL_UNITS) {
    const eligible = unit.filter((index) => {
      if (board[index] !== 0) return false
      const count = popCount(candidates[index])
      return count >= 2 && count <= 3
    })
    for (let a = 0; a < eligible.length; a += 1) {
      for (let b = a + 1; b < eligible.length; b += 1) {
        for (let c = b + 1; c < eligible.length; c += 1) {
          const locations = [eligible[a], eligible[b], eligible[c]]
          const mask = candidates[locations[0]] | candidates[locations[1]] | candidates[locations[2]]
          if (popCount(mask) !== 3) continue
          const locationSet = new Set(locations)
          const eliminations = unit
            .filter((index) => !locationSet.has(index) && board[index] === 0 && (candidates[index] & mask) !== 0)
            .map((index) => ({ index, mask }))
          if (eliminations.length) {
            return {
              technique: 'NAKED_TRIPLE', kind: 'ELIMINATE', eliminations,
              message: `${unitName(unit)}存在裸三数组 ${maskToDigits(mask).join('、')}，可排除其他格中的这些候选`
            }
          }
        }
      }
    }
  }
  return null
}

function findXWing(board: number[], candidates: number[]): LogicalStep | null {
  for (let digit = 1; digit <= 9; digit += 1) {
    const bit = digitBit(digit)
    const rowPairs: { row: number; cols: number[] }[] = []
    for (let row = 0; row < 9; row += 1) {
      const cols = ROW_UNITS[row]
        .filter((index) => board[index] === 0 && (candidates[index] & bit) !== 0)
        .map(colOf)
      if (cols.length === 2) rowPairs.push({ row, cols })
    }
    for (let a = 0; a < rowPairs.length; a += 1) {
      for (let b = a + 1; b < rowPairs.length; b += 1) {
        const one = rowPairs[a]
        const two = rowPairs[b]
        if (one.cols[0] !== two.cols[0] || one.cols[1] !== two.cols[1]) continue
        const eliminations: CandidateElimination[] = []
        for (const col of one.cols) {
          for (let row = 0; row < 9; row += 1) {
            if (row === one.row || row === two.row) continue
            const index = row * 9 + col
            if (board[index] === 0 && (candidates[index] & bit) !== 0) eliminations.push({ index, mask: bit })
          }
        }
        if (eliminations.length) {
          return {
            technique: 'X_WING', kind: 'ELIMINATE', eliminations,
            message: `数字 ${digit} 在第 ${one.row + 1}、${two.row + 1} 行形成 X-Wing，可从对应两列其他格删除 ${digit}`
          }
        }
      }
    }

    const colPairs: { col: number; rows: number[] }[] = []
    for (let col = 0; col < 9; col += 1) {
      const rows = COL_UNITS[col]
        .filter((index) => board[index] === 0 && (candidates[index] & bit) !== 0)
        .map(rowOf)
      if (rows.length === 2) colPairs.push({ col, rows })
    }
    for (let a = 0; a < colPairs.length; a += 1) {
      for (let b = a + 1; b < colPairs.length; b += 1) {
        const one = colPairs[a]
        const two = colPairs[b]
        if (one.rows[0] !== two.rows[0] || one.rows[1] !== two.rows[1]) continue
        const eliminations: CandidateElimination[] = []
        for (const row of one.rows) {
          for (let col = 0; col < 9; col += 1) {
            if (col === one.col || col === two.col) continue
            const index = row * 9 + col
            if (board[index] === 0 && (candidates[index] & bit) !== 0) eliminations.push({ index, mask: bit })
          }
        }
        if (eliminations.length) {
          return {
            technique: 'X_WING', kind: 'ELIMINATE', eliminations,
            message: `数字 ${digit} 在第 ${one.col + 1}、${two.col + 1} 列形成 X-Wing，可从对应两行其他格删除 ${digit}`
          }
        }
      }
    }
  }
  return null
}

function hasCandidateContradiction(board: number[], candidates: number[]): boolean {
  return board.some((value, index) => value === 0 && candidates[index] === 0)
}

const finders = [findNakedSingle, findHiddenSingle, findLockedCandidate, findNakedPair, findHiddenPair, findNakedTriple, findXWing]

export function solveLogically(input: number[], maxSteps = 2000): LogicalSolveResult {
  const board = [...input]
  if (!validateBoard(board)) {
    return { board, candidates: Array(81).fill(0), steps: [], techniques: [], score: 0, solved: false, valid: false, remaining: board.filter((v) => v === 0).length }
  }
  const candidates = initializeCandidates(board)
  const steps: LogicalStep[] = []
  let score = 0

  while (board.some((value) => value === 0) && steps.length < maxSteps) {
    if (hasCandidateContradiction(board, candidates)) {
      return { board, candidates, steps, techniques: [...new Set(steps.map((s) => s.technique))], score, solved: false, valid: false, remaining: board.filter((v) => v === 0).length }
    }

    let progressed = false
    for (const finder of finders) {
      const step = finder(board, candidates)
      if (!step) continue
      if (step.kind === 'PLACE') {
        if (step.index == null || step.digit == null || !placeDigit(board, candidates, step.index, step.digit)) {
          return { board, candidates, steps, techniques: [...new Set(steps.map((s) => s.technique))], score, solved: false, valid: false, remaining: board.filter((v) => v === 0).length }
        }
      } else if (!step.eliminations || applyEliminations(candidates, step.eliminations) === 0) {
        continue
      }
      steps.push(step)
      score += TECHNIQUE_WEIGHTS[step.technique]
      progressed = true
      break
    }
    if (!progressed) break
  }

  const remaining = board.filter((value) => value === 0).length
  return {
    board,
    candidates,
    steps,
    techniques: [...new Set(steps.map((step) => step.technique))],
    score,
    solved: remaining === 0,
    valid: !hasCandidateContradiction(board, candidates),
    remaining
  }
}

export function nextLogicalPlacement(input: number[]): { step: LogicalStep; preceding: SudokuTechnique[]; steps: LogicalStep[] } | null {
  const board = [...input]
  if (!validateBoard(board)) return null
  const candidates = initializeCandidates(board)
  const preceding: SudokuTechnique[] = []
  const steps: LogicalStep[] = []

  for (let guard = 0; guard < 200; guard += 1) {
    if (hasCandidateContradiction(board, candidates)) return null
    const naked = findNakedSingle(board, candidates)
    if (naked) return { step: naked, preceding, steps: [...steps, naked] }
    const hidden = findHiddenSingle(board, candidates)
    if (hidden) return { step: hidden, preceding, steps: [...steps, hidden] }

    let eliminated = false
    for (const finder of [findLockedCandidate, findNakedPair, findHiddenPair, findNakedTriple, findXWing]) {
      const step = finder(board, candidates)
      if (!step?.eliminations) continue
      if (applyEliminations(candidates, step.eliminations) === 0) continue
      preceding.push(step.technique)
      steps.push(step)
      eliminated = true
      break
    }
    if (!eliminated) return null
  }
  return null
}

export function techniqueWeight(technique: SudokuTechnique): number {
  return TECHNIQUE_WEIGHTS[technique]
}
