const fs = require('node:fs')
const path = require('node:path')
const core = require('./load-core.cjs')

const root = path.resolve(__dirname, '../..')
const output = process.env.SUDOKU_CAMPAIGN_OUTPUT || path.join(root, 'docs/generated/campaign-v2.json')
const targetCounts = {
  naked: 15,
  singles: 25,
  fundamentals: 35,
  patterns: 60,
  'one-chain': 35,
  'two-chains': 55,
  'three-chains': 55,
  'multi-chain': 50
}
const bank = Object.fromEntries(core.CAMPAIGN_BANDS.map(band => [band, []]))
const seen = new Set()
const uniqueSolutions = new Set()

function addPuzzle(seed, targetClues, symmetry) {
  const { puzzle, solution } = core.generatePuzzle({ seed, targetClues, symmetry })
  const normalized = core.normalizeCampaignDigits(puzzle)
  const key = core.serializeBoard(normalized)
  if (seen.has(key)) return
  seen.add(key)
  const rating = core.rateCampaignPuzzle(puzzle)
  if (!rating) return
  const { band, ...metadata } = rating
  if (bank[band].length >= targetCounts[band]) return
  const solutionKey = core.serializeBoard(core.normalizeCampaignDigits(solution))
  if (uniqueSolutions.has(solutionKey)) return
  if (metadata.chainSteps > 1 && core.canSolveWithAtMostOneChain(normalized)) return
  uniqueSolutions.add(solutionKey)
  bank[band].push({ puzzle: core.serializeBoard(puzzle), solution: core.serializeBoard(solution), ...metadata })
  if (bank[band].length === targetCounts[band]) console.log(`${band}: ${targetCounts[band]} puzzles`)
}

const filled = () => core.CAMPAIGN_BANDS.every(band => bank[band].length >= targetCounts[band])
for (let attempt = 0; attempt < 25000 && !filled(); attempt++) {
  const clues = bank.naked.length < targetCounts.naked ? 44 : bank.singles.length < targetCounts.singles ? 32 : 23 + attempt % 5
  addPuzzle((20261121 + Math.imul(attempt, 2654435761)) >>> 0, clues, attempt % 3 !== 0)
  if ((attempt + 1) % 1000 === 0) console.log(`Tried ${attempt + 1} generated puzzles. ${core.CAMPAIGN_BANDS.map(band => `${band} ${bank[band].length}`).join(', ')}`)
}
if (!filled()) throw new Error('The generation budget did not fill all campaign bands.')

const entries = Object.entries(bank).map(([band, puzzles]) =>
  `  ${JSON.stringify(band)}: [\n${puzzles.map(puzzle => `    ${JSON.stringify(puzzle)}`).join(',\n')}\n  ]`)
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `{\n${entries.join(',\n')}\n}\n`)
console.log(`Generated campaign bank: ${output}`)
