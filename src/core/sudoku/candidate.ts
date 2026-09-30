import { FULL_MASK, boxOf, colOf, rowOf } from './board'

export interface ConstraintMasks {
  rows: number[]
  cols: number[]
  boxes: number[]
}

export function digitBit(digit: number): number {
  return 1 << (digit - 1)
}

export function hasDigit(mask: number, digit: number): boolean {
  return (mask & digitBit(digit)) !== 0
}

export function popCount(mask: number): number {
  let value = mask >>> 0
  let count = 0
  while (value) {
    value &= value - 1
    count += 1
  }
  return count
}

export function maskToDigits(mask: number): number[] {
  const digits: number[] = []
  for (let digit = 1; digit <= 9; digit += 1) {
    if (hasDigit(mask, digit)) digits.push(digit)
  }
  return digits
}

export function buildConstraintMasks(board: number[]): ConstraintMasks {
  const masks: ConstraintMasks = {
    rows: Array(9).fill(0),
    cols: Array(9).fill(0),
    boxes: Array(9).fill(0)
  }

  board.forEach((digit, index) => {
    if (!digit) return
    const bit = digitBit(digit)
    masks.rows[rowOf(index)] |= bit
    masks.cols[colOf(index)] |= bit
    masks.boxes[boxOf(index)] |= bit
  })

  return masks
}

export function getCandidateMask(
  board: number[],
  index: number,
  masks = buildConstraintMasks(board)
): number {
  if (board[index] !== 0) return 0
  const used = masks.rows[rowOf(index)] | masks.cols[colOf(index)] | masks.boxes[boxOf(index)]
  return FULL_MASK & ~used
}
