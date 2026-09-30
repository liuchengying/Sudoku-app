import { boxOf, colOf, rowOf } from './board'

export function isBoardShapeValid(board: number[]): boolean {
  return board.length === 81 && board.every((value) => Number.isInteger(value) && value >= 0 && value <= 9)
}

export function validateBoard(board: number[]): boolean {
  if (!isBoardShapeValid(board)) return false

  const rows = Array.from({ length: 9 }, () => new Set<number>())
  const cols = Array.from({ length: 9 }, () => new Set<number>())
  const boxes = Array.from({ length: 9 }, () => new Set<number>())

  for (let index = 0; index < 81; index += 1) {
    const value = board[index]
    if (!value) continue
    const r = rowOf(index)
    const c = colOf(index)
    const b = boxOf(index)
    if (rows[r].has(value) || cols[c].has(value) || boxes[b].has(value)) return false
    rows[r].add(value)
    cols[c].add(value)
    boxes[b].add(value)
  }
  return true
}

export function isSolved(board: number[]): boolean {
  return board.every((value) => value >= 1 && value <= 9) && validateBoard(board)
}

export function puzzleMatchesSolution(puzzle: number[], solution: number[]): boolean {
  if (!validateBoard(puzzle) || !isSolved(solution)) return false
  return puzzle.every((value, index) => value === 0 || value === solution[index])
}
