// Audit the current implementation in Node. All platform APIs and storage below
// are mocks; no app, browser, device, native audio or real user data is accessed.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { parse, compileScript } = require('vue/compiler-sfc')
const { reactive } = require('vue')
const { createPinia, setActivePinia } = require('pinia')
const root = path.resolve(__dirname, '../../..')
const hooks = { shows: [], hides: [], backs: [] }
const storage = new Map()
const timers = new Map()
let timerId = 0
let simulatedTime = 0
process.env.TZ = 'Asia/Shanghai'
const originals = { resolve: Module._resolveFilename, load: Module._load, date: Date, timeout: setTimeout, clear: clearTimeout }

Module._resolveFilename = function (request, ...args) {
  return originals.resolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, ...args)
}
Module._load = function (request, ...args) {
  if (request === '@dcloudio/uni-app') return {
    onShow: callback => hooks.shows.push(callback),
    onHide: callback => hooks.hides.push(callback),
    onBackPress: callback => hooks.backs.push(callback),
    onLoad: callback => callback({}), onLaunch: () => {}
  }
  return originals.load.call(this, request, ...args)
}
const transpile = (source, filename) => ts.transpileModule(source, {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText
require.extensions['.ts'] = (module, filename) => module._compile(transpile(fs.readFileSync(filename, 'utf8'), filename), filename)
require.extensions['.vue'] = (module, filename) => {
  const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename })
  assert.equal(errors.length, 0)
  const content = descriptor.scriptSetup || descriptor.script ? compileScript(descriptor, { id: filename }).content : 'export default {}'
  module._compile(transpile(content, filename), filename)
}
global.Date = class extends originals.date {
  constructor(...args) { if (args.length) super(...args); else super(simulatedTime) }
  static now() { return simulatedTime }
}
global.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId }
global.clearTimeout = id => timers.delete(id)
global.uni = {
  getStorageSync: key => storage.get(key) ?? '',
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  getWindowInfo: () => ({ statusBarHeight: 0, safeAreaInsets: { bottom: 0 } }),
  navigateTo: () => {}, redirectTo: () => {}, reLaunch: () => {}, navigateBack: () => {},
  showToast: () => {}, showModal: () => {}, vibrateShort: () => {}, vibrateLong: () => {}
}

const observations = []
try {
  setActivePinia(createPinia())
  const { LEVELS } = require(path.join(root, 'src/assets/puzzles/index.ts'))
  const core = require(path.join(root, 'src/core/sudoku/index.ts'))
  const settings = require(path.join(root, 'src/stores/settings.store.ts')).useSettingsStore()
  Object.assign(settings.settings, { sound: false, haptics: false, onboardingSeen: true })
  const store = require(path.join(root, 'src/stores/game.store.ts')).useGameStore()
  const setup = (relative, props = {}) => require(path.join(root, relative)).default.setup(props, { expose: () => {}, emit: () => {} })
  store.startGame(LEVELS[0])
  const gamePage = setup('src/pages/game/index.vue')

  const countBefore = store.game.hintCount
  gamePage.hint()
  assert.equal(gamePage.hintVisible.value, true)
  assert.equal(store.game.hintCount, countBefore + 1)
  observations.push({ id: 'hint-counts-on-open', observed: { countBefore, countAfter: store.game.hintCount, panelOpened: true, derivationExpanded: false, answerApplied: false }, conclusion: 'The hint count changes on requesting the panel, before expanding a teaching step.' })

  store.startGame(LEVELS[0])
  const logical = core.findHint(core.parseBoard(LEVELS[0].puzzle))
  assert(logical, 'The audit puzzle must have an available logical hint')
  const chosen = store.game.cells.find(cell => cell.origin !== 'GIVEN' && cell.index !== logical.index).index
  store.selectCell(chosen)
  const suggested = store.requestHint()
  assert.equal(suggested.index, logical.index)
  assert.notEqual(suggested.index, chosen)
  observations.push({ id: 'hint-does-not-target-selection', observed: { chosenIndex: chosen, suggestedIndex: suggested.index }, conclusion: 'The global logical hint overrides the selected empty cell; the controls article promises a selected-cell answer.' })

  store.pause()
  const statusBefore = store.game.status
  gamePage.openMore()
  gamePage.moreAction('bookmark')
  assert.equal(statusBefore, 'PAUSED')
  assert.equal(store.game.status, 'PLAYING')
  assert(store.game.bookmark)
  observations.push({ id: 'paused-bookmark-resumes', observed: { statusBefore, statusAfter: store.game.status, bookmarkSaved: true }, conclusion: 'Saving a bookmark via More resumes a previously paused game.' })

  const cells = core.createCells(LEVELS[0].puzzle, LEVELS[0].solution)
  const editable = cells.find(cell => cell.origin !== 'GIVEN')
  const digit = editable.solution
  cells.filter(cell => cell.solution === digit).forEach(cell => { cell.value = digit })
  const incorrect = cells.find(cell => cell.origin !== 'GIVEN' && cell.solution !== digit)
  assert(incorrect)
  const props = reactive({ cells, disabled: false, disableCompletedDigit: true, noteMode: false, activeDigit: null, showRemaining: false })
  const pad = setup('src/components/sudoku/NumberPad.vue', props)
  const visibleBefore = props.cells.filter(cell => cell.value === digit).length
  const blockedBefore = pad.blocked(digit)
  props.cells[editable.index].value = 0
  props.cells[incorrect.index].value = digit
  const visibleAfter = props.cells.filter(cell => cell.value === digit).length
  const blockedAfter = pad.blocked(digit)
  assert.equal(visibleBefore, 9)
  assert.equal(visibleAfter, 9)
  assert.equal(blockedBefore, true)
  assert.equal(blockedAfter, false)
  observations.push({ id: 'hidden-checking-disabled-key-leaks-correctness', observed: { digit, visibleBefore, visibleAfter, blockedBefore, blockedAfter, showRemaining: false }, conclusion: 'With remaining labels hidden, key disabling still distinguishes nine correct entries from nine visible entries containing a wrong one.' })

  store.pause()
  const home = setup('src/pages/home/index.vue')
  home.play()
  const homeResumeStatus = store.game.status
  store.pause()
  const levels = setup('src/pages/levels/index.vue')
  levels.startSelected()
  const selectionResumeStatus = store.game.status
  assert.equal(homeResumeStatus, 'PLAYING')
  assert.equal(selectionResumeStatus, 'PAUSED')
  observations.push({ id: 'resume-entry-inconsistent', observed: { homeResumeStatus, selectionResumeStatus }, conclusion: 'Home Continue resumes timing; Continue this level only navigates and leaves the paused overlay.' })

  simulatedTime = originals.date.parse('2026-09-30T23:59:00+08:00')
  hooks.shows.length = 0
  const daily = setup('src/pages/daily/index.vue')
  const selectionBefore = daily.selected.value
  simulatedTime = originals.date.parse('2026-10-01T00:01:00+08:00')
  hooks.shows.forEach(callback => callback())
  assert.equal(daily.today.value, '2026-10-01')
  assert.equal(daily.selected.value, '2026-09-30')
  assert.equal(daily.month.value, '2026-09')
  observations.push({ id: 'daily-date-stale-on-return', observed: { selectionBefore, todayAfter: daily.today.value, selectionAfter: daily.selected.value, displayedMonthAfter: daily.month.value }, conclusion: 'Returning to a retained daily page updates today, while the selected challenge and displayed month remain unchanged.' })

  const report = {
    method: 'Node script using transpiled current TypeScript and Vue script-setup code, with mocked uni APIs, in-memory storage, controlled dates and inert timers; no UI rendered or app started.',
    confirmsObservedBehavior: true,
    assertsExpectedProductBehavior: false,
    observations
  }
  fs.writeFileSync(path.join(__dirname, 'interaction-probes.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ observedPaths: observations.length, report: 'docs/tasks/2026-10-10-feature-ux-review/interaction-probes.json' }, null, 2))
} finally {
  Module._resolveFilename = originals.resolve
  Module._load = originals.load
  global.Date = originals.date
  global.setTimeout = originals.timeout
  global.clearTimeout = originals.clear
  delete global.uni
}
