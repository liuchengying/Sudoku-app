const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const core = require('./load-core.cjs')
const file = path.join(root, 'src/assets/puzzles/puzzles.json')
const bank = JSON.parse(fs.readFileSync(file, 'utf8'))
const counts = {}
for (const levels of Object.values(bank)) for (const level of levels) {
  const board = core.parseBoard(level.puzzle)
  const rating = core.rateDifficulty(board)
  if (core.countSolutions(board, 2) !== 1 || core.serializeBoard(core.solve(board)) !== level.solution) throw new Error('Invalid puzzle')
  const tier = !rating.solvedLogically ? 'expert' : rating.techniques.some(t => !['NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(t)) ? 'advanced' : rating.techniques.includes('HIDDEN_SINGLE') ? 'easy' : 'beginner'
  if (process.argv.includes('--write')) Object.assign(level, { difficultyScore: rating.score, techniques: rating.techniques, clueCount: board.filter(Boolean).length, tier })
  else if (level.difficultyScore !== rating.score || JSON.stringify(level.techniques) !== JSON.stringify(rating.techniques) || level.tier !== tier) throw new Error('Puzzle metadata needs calibration')
  counts[tier] = (counts[tier] ?? 0) + 1
}
if (process.argv.includes('--write')) fs.writeFileSync(file, JSON.stringify(bank, null, 2) + '\n')
console.log(JSON.stringify({ total: Object.values(counts).reduce((s, n) => s + n, 0), counts }))
