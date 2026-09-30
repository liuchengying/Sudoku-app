import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FULL = 0x1ff
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = process.env.OUTPUT || path.join(ROOT, 'generated-puzzles.json')
const LEVELS_PER_DIFFICULTY = 25

function bit(digit) { return 1 << (digit - 1) }
function rowOf(index) { return Math.floor(index / 9) }
function colOf(index) { return index % 9 }
function boxOf(index) { return Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3) }
function popCount(mask) { let v = mask >>> 0; let n = 0; while (v) { v &= v - 1; n += 1 } return n }
function maskToDigits(mask) { const out = []; for (let d = 1; d <= 9; d += 1) if (mask & bit(d)) out.push(d); return out }
function boardString(board) { return board.join('') }

function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function buildMasks(board) {
  const rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0)
  for (let i = 0; i < 81; i += 1) {
    const d = board[i]
    if (!d) continue
    const b = bit(d), r = rowOf(i), c = colOf(i), x = boxOf(i)
    if ((rows[r] & b) || (cols[c] & b) || (boxes[x] & b)) return null
    rows[r] |= b; cols[c] |= b; boxes[x] |= b
  }
  return { rows, cols, boxes }
}

function countSolutions(input, limit = 2) {
  const board = [...input]
  const masks = buildMasks(board)
  if (!masks) return 0
  const { rows, cols, boxes } = masks
  let count = 0
  function search() {
    if (count >= limit) return
    let best = -1, bestMask = 0, bestCount = 10
    for (let i = 0; i < 81; i += 1) {
      if (board[i]) continue
      const mask = FULL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)])
      const n = popCount(mask)
      if (!n) return
      if (n < bestCount) { best = i; bestMask = mask; bestCount = n; if (n === 1) break }
    }
    if (best < 0) { count += 1; return }
    const r = rowOf(best), c = colOf(best), x = boxOf(best)
    for (const d of maskToDigits(bestMask)) {
      const b = bit(d)
      board[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b
      search()
      board[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b
      if (count >= limit) return
    }
  }
  search()
  return count
}

function randomSolvedBoard(random) {
  const board = Array(81).fill(0), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0)
  function search() {
    let bestCount = 10
    const options = []
    for (let i = 0; i < 81; i += 1) {
      if (board[i]) continue
      const mask = FULL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)])
      const n = popCount(mask)
      if (!n) return false
      if (n < bestCount) { bestCount = n; options.length = 0; options.push([i, mask]) }
      else if (n === bestCount) options.push([i, mask])
    }
    if (!options.length) return true
    const [index, mask] = options[Math.floor(random() * options.length)]
    const r = rowOf(index), c = colOf(index), x = boxOf(index)
    for (const d of shuffle(maskToDigits(mask), random)) {
      const b = bit(d)
      board[index] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b
      if (search()) return true
      board[index] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b
    }
    return false
  }
  if (!search()) throw new Error('Failed to create solved board')
  return board
}

function dig(solution, targetClues, random) {
  const puzzle = [...solution]
  const groups = []
  const used = new Set()
  for (let i = 0; i < 81; i += 1) {
    if (used.has(i)) continue
    const j = 80 - i
    used.add(i); used.add(j)
    groups.push(i === j ? [i] : [i, j])
  }
  shuffle(groups, random)
  for (const group of groups) {
    const clues = puzzle.filter(Boolean).length
    if (clues - group.length < targetClues) continue
    const old = group.map((i) => puzzle[i])
    group.forEach((i) => { puzzle[i] = 0 })
    if (countSolutions(puzzle, 2) !== 1) group.forEach((i, n) => { puzzle[i] = old[n] })
    if (puzzle.filter(Boolean).length <= targetClues) break
  }
  return puzzle
}

const plans = [
  { id: 'master', clues: [31, 32, 33], scoreBase: 600 },
  { id: 'king', clues: [27, 28, 29, 30], scoreBase: 720 },
  { id: 'grandmaster', clues: [24, 25, 26, 27], scoreBase: 900 }
]

const random = mulberry32(Number(process.env.SEED || 20260929))
const output = {}
for (const plan of plans) {
  const seen = new Set()
  output[plan.id] = []
  while (output[plan.id].length < LEVELS_PER_DIFFICULTY) {
    const solution = randomSolvedBoard(random)
    const target = plan.clues[Math.floor(random() * plan.clues.length)]
    const puzzle = dig(solution, target, random)
    const key = boardString(puzzle)
    if (seen.has(key)) continue
    seen.add(key)
    const clueCount = puzzle.filter(Boolean).length
    output[plan.id].push({
      puzzle: key,
      solution: boardString(solution),
      clueCount,
      difficultyScore: plan.scoreBase + (35 - clueCount) * 14,
      techniques: plan.id === 'grandmaster'
        ? ['NAKED_SINGLE', 'HIDDEN_SINGLE', 'LOCKED_CANDIDATE', 'NAKED_PAIR', 'BACKTRACKING']
        : ['NAKED_SINGLE', 'HIDDEN_SINGLE']
    })
    process.stdout.write(`\r${plan.id}: ${output[plan.id].length}/${LEVELS_PER_DIFFICULTY}`)
  }
  process.stdout.write('\n')
}
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2))
console.log(`Generated puzzle bank: ${OUTPUT}`)
