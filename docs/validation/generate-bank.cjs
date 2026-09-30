const fs = require('node:fs')
const path = require('node:path')
const core = require('./load-core.cjs')
const root = path.resolve(__dirname, '../..')
const output = process.env.OUTPUT || path.join(root, 'docs/generated/puzzles.json')
const count = Number(process.env.LEVELS_PER_DIFFICULTY || 25)
const initialSeed = Number(process.env.SEED || 20260930)
if (!Number.isInteger(count) || count < 1 || count > 1000 || !Number.isFinite(initialSeed)) throw new Error('Invalid generation parameters')
const plans = [{ id: 'master', clues: 33 }, { id: 'king', clues: 29 }, { id: 'grandmaster', clues: 25 }]
const bank = {}, seen = new Set()
let offset = 0
for (const plan of plans) {
  bank[plan.id] = []
  while (bank[plan.id].length < count) {
    if (offset > count * 100) throw new Error('Generation budget exceeded')
    const seed = (initialSeed + Math.imul(offset++, 2654435761)) >>> 0
    const generated = core.generatePuzzle({ seed, targetClues: plan.clues })
    const puzzle = core.serializeBoard(generated.puzzle)
    if (seen.has(puzzle)) continue
    seen.add(puzzle)
    const rating = core.rateDifficulty(generated.puzzle)
    const tier = !rating.solvedLogically ? 'expert' : rating.techniques.some(t => !['NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(t)) ? 'advanced' : rating.techniques.includes('HIDDEN_SINGLE') ? 'easy' : 'beginner'
    bank[plan.id].push({ puzzle, solution: core.serializeBoard(generated.solution), clueCount: generated.puzzle.filter(Boolean).length, difficultyScore: rating.score, techniques: rating.techniques, tier })
  }
  console.log(`${plan.id}: ${count} generated with calibrated metadata`)
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(bank, null, 2) + '\n')
console.log(`Generated puzzle bank: ${output}`)
