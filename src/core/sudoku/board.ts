import type { CellSnapshot, SudokuCell } from './types'

export const BOARD_SIZE = 9
export const CELL_COUNT = 81
export const FULL_MASK = 0b111111111

export function parseBoard(board: string): number[] {
  if (board.length !== CELL_COUNT || /[^0-9]/.test(board)) {
    throw new Error('Sudoku board must be exactly 81 digits.')
  }
  return [...board].map(Number)
}

export function serializeBoard(board: number[]): string {
  if (board.length !== CELL_COUNT) {
    throw new Error('Sudoku board must contain exactly 81 cells.')
  }
  return board.join('')
}

export function rowOf(index: number): number {
  return Math.floor(index / BOARD_SIZE)
}

export function colOf(index: number): number {
  return index % BOARD_SIZE
}

export function boxOf(index: number): number {
  const row = rowOf(index)
  const col = colOf(index)
  return Math.floor(row / 3) * 3 + Math.floor(col / 3)
}

export function peerIndexes(index: number): number[] {
  const row = rowOf(index)
  const col = colOf(index)
  const peers = new Set<number>()

  for (let i = 0; i < 9; i += 1) {
    peers.add(row * 9 + i)
    peers.add(i * 9 + col)
  }

  const boxRow = Math.floor(row / 3) * 3
  const boxCol = Math.floor(col / 3) * 3
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      peers.add(r * 9 + c)
    }
  }

  peers.delete(index)
  return [...peers]
}

export function snapshotCell(cell: SudokuCell): CellSnapshot {
  return {
    value: cell.value,
    origin: cell.origin,
    notesMask: cell.notesMask,
    error: cell.error
  }
}

export function createCells(puzzle: string, solution: string): SudokuCell[] {
  const puzzleValues = parseBoard(puzzle)
  const solutionValues = parseBoard(solution)

  return puzzleValues.map((value, index) => ({
    index,
    value,
    solution: solutionValues[index],
    origin: value === 0 ? null : 'GIVEN',
    notesMask: 0,
    error: false
  }))
}
