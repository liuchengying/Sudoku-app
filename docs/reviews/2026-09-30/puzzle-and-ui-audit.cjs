const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '../../..')
// Compile the real pure TypeScript Core in memory, without writing build files.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename
  })
  module._compile(result.outputText, filename)
}

const core = require(path.join(root, 'src/core/sudoku/index.ts'))
const bank = JSON.parse(fs.readFileSync(path.join(root, 'src/assets/puzzles/puzzles.json'), 'utf8'))
const range = values => [Math.min(...values), Math.max(...values)]
const results = Object.entries(bank).map(([difficulty, levels]) => {
  const ratings = levels.map((level, offset) => {
    const board = core.parseBoard(level.puzzle)
    const logical = core.solveLogically(board)
    const rating = core.rateDifficulty(board)
    if (core.countSolutions(board, 2) !== 1 || !core.isSolved(core.parseBoard(level.solution))) {
      throw new Error(`${difficulty}-${offset + 1}: invalid puzzle or solution`)
    }
    if (logical.solved && core.serializeBoard(logical.board) !== level.solution) {
      throw new Error(`${difficulty}-${offset + 1}: logical solver gave wrong solution`)
    }
    return {
      id: `${difficulty}-${String(offset + 1).padStart(3, '0')}`,
      clues: level.clueCount,
      storedScore: level.difficultyScore,
      coreScore: rating.score,
      logicallySolved: logical.solved,
      valid: logical.valid,
      remaining: logical.remaining,
      storedTechniques: level.techniques,
      actualTechniques: rating.techniques
    }
  })
  return {
    difficulty,
    count: ratings.length,
    clues: range(ratings.map(item => item.clues)),
    storedScore: range(ratings.map(item => item.storedScore)),
    coreScore: range(ratings.map(item => item.coreScore)),
    logicallySolved: ratings.filter(item => item.logicallySolved).length,
    requiresBeyondCurrentLogic: ratings.filter(item => !item.logicallySolved).length,
    invalidLogicResults: ratings.filter(item => !item.valid).length,
    onlySingles: ratings.filter(item => item.logicallySolved && item.actualTechniques.every(technique => ['NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(technique))).length,
    scoreMismatch: ratings.filter(item => item.storedScore !== item.coreScore).length,
    techniqueMetadataMismatch: ratings.filter(item => [...item.storedTechniques].sort().join(',') !== [...item.actualTechniques].sort().join(',')).length,
    ratings
  }
})

const generated = []
for (const seed of [1, 42, 20260930]) {
  for (const targetClues of [32, 28, 25]) {
    const item = core.generatePuzzle({ seed, targetClues, symmetry: true })
    if (core.countSolutions(item.puzzle, 2) !== 1 || !core.puzzleMatchesSolution(item.puzzle, item.solution)) throw new Error('Generation failed')
    generated.push({ seed, targetClues, symmetry: true, clues: item.puzzle.filter(Boolean).length })
  }
  const item = core.generatePuzzle({ seed, targetClues: 25, symmetry: false })
  generated.push({ seed, targetClues: 25, symmetry: false, clues: item.puzzle.filter(Boolean).length })
}

let wrongHintExample = null
outer: for (const [difficulty, levels] of Object.entries(bank)) {
  for (const [offset, level] of levels.entries()) {
    const board = core.parseBoard(level.puzzle)
    for (let index = 0; index < 81; index++) {
      if (board[index]) continue
      for (const wrong of core.maskToDigits(core.getCandidateMask(board, index))) {
        if (wrong === Number(level.solution[index])) continue
        const trial = [...board]
        trial[index] = wrong
        const hint = core.findHint(trial)
        if (hint && hint.digit !== Number(level.solution[hint.index])) {
          wrongHintExample = {
            levelId: `${difficulty}-${String(offset + 1).padStart(3, '0')}`,
            wrongInput: { row: core.rowOf(index) + 1, column: core.colOf(index) + 1, digit: wrong, answer: Number(level.solution[index]) },
            resultingHint: { row: core.rowOf(hint.index) + 1, column: core.colOf(hint.index) + 1, digit: hint.digit, answer: Number(level.solution[hint.index]), technique: hint.technique }
          }
          break outer
        }
      }
    }
  }
}

function luminance(hex) {
  const values = hex.replace('#', '').match(/../g).map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background)
  return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2))
}

const evidence = {
  date: '2026-09-30',
  scope: 'Source and script checks only; no app, browser or native UI launch',
  puzzles: results,
  generatorSmoke: generated,
  wrongHintExample,
  uiStatic: {
    contrast: [
      { foreground: '#929399', background: '#ffffff', ratio: contrast('#929399', '#ffffff') },
      { foreground: '#b0b2b6', background: '#ffffff', ratio: contrast('#b0b2b6', '#ffffff') },
      { foreground: '#b9babd', background: '#e6e7e9', ratio: contrast('#b9babd', '#e6e7e9') }
    ],
    compactHomeSwiperRpx: 720,
    levelGridMinimumRpx: 5 * 126 + 4 * 20 + 18 + 20 + 2 * 3,
    viewport375: {
      caveat: 'CSS dimensions inferred from source; not actual Android dp or rendered device measurements',
      numberKeyWidthCssPx: Number(((375 - 60 * 375 / 750) / 9).toFixed(2)),
      answerKeyHeightCssPx: 86 * 375 / 750,
      noteDigitCssPx: 17 * 375 / 750
    }
  }
}

fs.writeFileSync(path.join(__dirname, 'puzzle-and-ui-evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify({
  puzzles: results.map(({ ratings, ...summary }) => summary),
  generatorSmoke: generated,
  wrongHintExample,
  uiStatic: evidence.uiStatic
}, null, 2))
