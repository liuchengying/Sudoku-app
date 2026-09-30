import { validateBoard } from '@/core/sudoku/validator'
import type { CellSnapshot, GameAction, ReplayEvent } from '@/core/sudoku/types'

export const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
export const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
export const digit = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 9
export const origin = (v: unknown) => v === null || ['GIVEN', 'USER', 'HINT'].includes(String(v))
export function boards(puzzle: unknown, solution: unknown): boolean {
  if (typeof puzzle !== 'string' || typeof solution !== 'string' || !/^[0-9]{81}$/.test(puzzle) || !/^[1-9]{81}$/.test(solution)) return false
  return validateBoard([...solution].map(Number)) && [...puzzle].every((v, i) => v === '0' || v === solution[i])
}
export function snapshot(v: unknown): v is CellSnapshot {
  return object(v) && digit(v.value) && origin(v.origin) && Number.isInteger(v.notesMask) && Number(v.notesMask) >= 0 && Number(v.notesMask) <= 511 && typeof v.error === 'boolean'
}
export function snapshots(v: unknown): v is CellSnapshot[] { return Array.isArray(v) && v.length === 81 && v.every(snapshot) }
const actions = ['SET_VALUE', 'CLEAR_VALUE', 'SET_NOTES', 'SET_ALL_NOTES', 'TOGGLE_NOTE', 'HINT', 'CHECK', 'RESTORE_BOOKMARK']
export function action(v: unknown): v is GameAction {
  return object(v) && typeof v.id === 'string' && actions.includes(String(v.type)) && nonnegative(v.timestamp) && Array.isArray(v.changes) && v.changes.length <= 81 && v.changes.every(c => object(c) && Number.isInteger(c.index) && Number(c.index) >= 0 && Number(c.index) < 81 && snapshot(c.before) && snapshot(c.after))
}
export function event(v: unknown): v is ReplayEvent { return object(v) && ['APPLY', 'REVERT'].includes(String(v.kind)) && action({ ...v, type: v.actionType }) }
