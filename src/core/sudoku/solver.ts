import { boxOf, colOf, FULL_MASK, rowOf } from './board'
import { digitBit, maskToDigits, popCount } from './candidate'
import { validateBoard } from './validator'

interface WorkingState {
  board: number[]
  rows: number[]
  cols: number[]
  boxes: number[]
}

function createWorkingState(input: number[]): WorkingState | null {
  if (!validateBoard(input)) return null

  const state: WorkingState = {
    board: [...input],
    rows: Array(9).fill(0),
    cols: Array(9).fill(0),
    boxes: Array(9).fill(0)
  }

  state.board.forEach((digit, index) => {
    if (!digit) return
    const bit = digitBit(digit)
    state.rows[rowOf(index)] |= bit
    state.cols[colOf(index)] |= bit
    state.boxes[boxOf(index)] |= bit
  })

  return state
}

function candidateMask(state: WorkingState, index: number): number {
  const used = state.rows[rowOf(index)] | state.cols[colOf(index)] | state.boxes[boxOf(index)]
  return FULL_MASK & ~used
}

function findMRV(state: WorkingState): { index: number; mask: number } | null {
  let bestIndex = -1
  let bestMask = 0
  let bestCount = 10

  for (let index = 0; index < 81; index += 1) {
    if (state.board[index] !== 0) continue
    const mask = candidateMask(state, index)
    const count = popCount(mask)
    if (count === 0) return { index, mask }
    if (count < bestCount) {
      bestIndex = index
      bestMask = mask
      bestCount = count
      if (count === 1) break
    }
  }

  return bestIndex === -1 ? null : { index: bestIndex, mask: bestMask }
}

function place(state: WorkingState, index: number, digit: number): void {
  const bit = digitBit(digit)
  state.board[index] = digit
  state.rows[rowOf(index)] |= bit
  state.cols[colOf(index)] |= bit
  state.boxes[boxOf(index)] |= bit
}

function remove(state: WorkingState, index: number, digit: number): void {
  const bit = digitBit(digit)
  state.board[index] = 0
  state.rows[rowOf(index)] &= ~bit
  state.cols[colOf(index)] &= ~bit
  state.boxes[boxOf(index)] &= ~bit
}

export function solve(input: number[]): number[] | null {
  const state = createWorkingState(input)
  if (!state) return null

  const search = (): boolean => {
    const target = findMRV(state)
    if (!target) return true
    if (target.mask === 0) return false

    for (const digit of maskToDigits(target.mask)) {
      place(state, target.index, digit)
      if (search()) return true
      remove(state, target.index, digit)
    }
    return false
  }

  return search() ? [...state.board] : null
}

export function countSolutions(input: number[], limit = 2): number {
  const state = createWorkingState(input)
  if (!state || limit <= 0) return 0

  let count = 0

  const search = (): void => {
    if (count >= limit) return
    const target = findMRV(state)
    if (!target) {
      count += 1
      return
    }
    if (target.mask === 0) return

    for (const digit of maskToDigits(target.mask)) {
      place(state, target.index, digit)
      search()
      remove(state, target.index, digit)
      if (count >= limit) return
    }
  }

  search()
  return count
}
