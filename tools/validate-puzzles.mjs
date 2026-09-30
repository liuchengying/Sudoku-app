import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(ROOT, 'src/assets/puzzles/puzzles.json')
const bank = JSON.parse(fs.readFileSync(file, 'utf8'))
const FULL = 0x1ff
const bit = (d) => 1 << (d - 1)
const rowOf = (i) => Math.floor(i / 9)
const colOf = (i) => i % 9
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)
const popCount = (m) => { let n = 0; while (m) { m &= m - 1; n += 1 } return n }
const digits = (m) => { const out = []; for (let d = 1; d <= 9; d += 1) if (m & bit(d)) out.push(d); return out }

function countSolutions(input, limit = 2) {
  const board = [...input], rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0)
  for (let i = 0; i < 81; i += 1) {
    const d = board[i]; if (!d) continue
    const b = bit(d), r = rowOf(i), c = colOf(i), x = boxOf(i)
    if ((rows[r] & b) || (cols[c] & b) || (boxes[x] & b)) return 0
    rows[r] |= b; cols[c] |= b; boxes[x] |= b
  }
  let count = 0
  function search() {
    if (count >= limit) return
    let best = -1, mask = 0, min = 10
    for (let i = 0; i < 81; i += 1) {
      if (board[i]) continue
      const m = FULL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)])
      const n = popCount(m); if (!n) return
      if (n < min) { best = i; mask = m; min = n; if (n === 1) break }
    }
    if (best < 0) { count += 1; return }
    const r = rowOf(best), c = colOf(best), x = boxOf(best)
    for (const d of digits(mask)) {
      const b = bit(d); board[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b
      search(); board[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b
      if (count >= limit) return
    }
  }
  search(); return count
}

let total = 0
const all = new Set()
for (const [difficulty, levels] of Object.entries(bank)) {
  if (levels.length !== 25) throw new Error(`${difficulty}: expected 25 puzzles, got ${levels.length}`)
  for (let i = 0; i < levels.length; i += 1) {
    const item = levels[i]
    if (!/^\d{81}$/.test(item.puzzle) || !/^[1-9]{81}$/.test(item.solution)) throw new Error(`${difficulty}-${i + 1}: invalid shape`)
    if (all.has(item.puzzle)) throw new Error(`${difficulty}-${i + 1}: duplicate puzzle`)
    all.add(item.puzzle)
    const puzzle = [...item.puzzle].map(Number), solution = [...item.solution].map(Number)
    if (!puzzle.every((v, index) => v === 0 || v === solution[index])) throw new Error(`${difficulty}-${i + 1}: givens do not match solution`)
    if (countSolutions(puzzle, 2) !== 1) throw new Error(`${difficulty}-${i + 1}: not unique`)
    total += 1
  }
  console.log(`${difficulty}: ${levels.length} valid unique puzzles`)
}
console.log(`OK: ${total} production puzzles validated`)
