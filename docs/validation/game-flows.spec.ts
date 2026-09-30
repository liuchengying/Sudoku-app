import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createRenderer, h, nextTick, reactive, type Component } from 'vue'
import { LEVELS } from '@/assets/puzzles'
import { createCells, digitBit, findHint, getCandidateMask, maskToDigits, parseBoard, peerIndexes, snapshotCell, validateBoard } from '@/core/sudoku'
import { useGameStore } from '@/stores/game.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useProgressStore } from '@/stores/progress.store'
import { useHistoryStore } from '@/stores/history.store'
import { useStatisticsStore } from '@/stores/statistics.store'
import { RESULTS_KEY, resultsRepository } from '@/repositories/results.repository'
import { currentGameRepository } from '@/repositories/current-game.repository'
import { replayCells } from '@/core/sudoku'
import { createDailyLevel, requestPracticeLevel, resetPracticeCache } from '@/services/puzzle.service'
import { practiceRepository } from '@/repositories/practice.repository'
import { historyRepository } from '@/repositories/history.repository'
import NumberPad from '@/components/sudoku/NumberPad.vue'
import MedalBadge from '@/components/common/MedalBadge.vue'
import HistoryDetail from '@/pages/history/detail.vue'
import HintSheet from '@/components/sudoku/HintSheet.vue'
import GamePage from '@/pages/game/index.vue'
import HomePage from '@/pages/home/index.vue'
import ResultPage from '@/pages/result/index.vue'
import { requestCampaignLevel } from '@/services/campaign.service'
import { campaignRepository } from '@/repositories/campaign.repository'

const hooks = vi.hoisted(() => ({ shows: [] as Array<() => void>, hides: [] as Array<() => void>, backs: [] as Array<() => boolean> }))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (callback: (query: { id: string }) => void) => callback({ id: 'audit-old' }),
  onShow: (callback: () => void) => hooks.shows.push(callback),
  onHide: (callback: () => void) => hooks.hides.push(callback),
  onBackPress: (callback: () => boolean) => hooks.backs.push(callback)
}))

const storage = new Map<string, string>()
const CURRENT = 'sudoku:v1:current-game'
const HISTORY = 'sudoku:v1:history'

beforeEach(() => {
  storage.clear()
  hooks.shows.length = 0; hooks.hides.length = 0; hooks.backs.length = 0
  vi.useFakeTimers()
  vi.setSystemTime(100000)
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.get(key) ?? '',
    setStorageSync: (key: string, value: string) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    redirectTo: vi.fn(),
    navigateTo: vi.fn(),
    reLaunch: vi.fn(),
    navigateBack: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
    vibrateShort: vi.fn(),
    vibrateLong: vi.fn()
  })
  setActivePinia(createPinia())
  useSettingsStore().settings.sound = false
  useSettingsStore().settings.haptics = false
})

describe('Infinite campaign game and page integration', () => {
  async function generated(id: string) {
    const pending = requestCampaignLevel(id)
    await vi.advanceTimersByTimeAsync(1000)
    return pending
  }

  it('restores generated campaign input, notes and undo after a cold start; scores once and replays the same puzzle', async () => {
    const level = await generated('master-026')
    const store = useGameStore()
    store.startGame(level)
    const index = store.game!.selectedIndex!
    store.inputNoteDigit(store.game!.cells[index].solution)
    store.inputNormalDigit(store.game!.cells[index].solution)
    store.pause(); store.flushSave()
    vi.clearAllTimers()
    campaignRepository.clear()
    setActivePinia(createPinia())
    const restored = useGameStore()
    expect(restored.restoreGame()).toBe(true)
    expect(restored.game!.status).toBe('PAUSED')
    expect(restored.game!.level).toEqual(level)
    expect(restored.game!.cells[index].value).toBe(Number(level.solution[index]))
    restored.resume(); restored.undo()
    expect(restored.game!.cells[index].value).toBe(0)
    expect(restored.game!.cells[index].notesMask).not.toBe(0)
    restored.redo(); finish(restored)
    expect(restored.game!.completion?.scoreAwarded).toBe(2000)
    expect(useProgressStore().get(level.id)?.levelNo).toBe(26)
    expect(useStatisticsStore().byDifficulty[0]).toMatchObject({ completed: 1, highestCompleted: 26, nextLevelNo: 1 })
    expect(restored.restartCurrent()).toBe(true)
    expect(restored.game!.puzzle).toBe(level.puzzle)
    finish(restored)
    expect(restored.game!.completion?.scoreAwarded).toBe(0)
    expect(useProgressStore().totalScore).toBe(2000)
    expect(useProgressStore().get(level.id)?.completionCount).toBe(2)
    expect(useHistoryStore().totals.byMode.CAMPAIGN).toBe(2)
  })

  it('rejects a generated snapshot with a falsified rating while retaining legacy restore compatibility', async () => {
    const level = await generated('king-026')
    const store = useGameStore()
    store.startGame(level)
    store.game!.level!.difficultyScore++
    store.pause(); store.flushSave()
    expect(currentGameRepository.load()).toBeNull()
    store.startGame(LEVELS[0]); store.pause(); store.flushSave()
    expect(currentGameRepository.load()?.levelId).toBe('master-001')
  })

  it('shows successive pages beyond 25 and launches a generated level from the real home component', async () => {
    const mounted = mount(HomePage, {})
    hooks.shows.forEach(cb => cb())
    const nextGroup = find(mounted.root, el => el.tag === 'button' && el.text === '下一组')!
    nextGroup.props.onTap()
    await nextTick()
    expect(findAll(mounted.root, el => el.tag === 'text' && el.props.class === 'number').map(el => el.text)).toEqual(Array.from({ length: 25 }, (_, i) => String(26 + i)))
    const startButton = find(mounted.root, el => el.tag === 'button' && String(el.props.class).includes('primary-action'))!
    startButton.props.onTap(); startButton.props.onTap()
    await nextTick()
    expect(startButton.props.disabled).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(useGameStore().game).toMatchObject({ mode: 'CAMPAIGN', levelId: 'master-026' })
    expect(uni.navigateTo).toHaveBeenCalledOnce()
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/game/index' })
    mounted.unmount()
  })

  it('recommends level 26 after legacy completion and keeps the initial-bank achievement after new completions', async () => {
    const progress = Object.fromEntries(LEVELS.map(level => [level.id, {
      levelId: level.id, difficultyId: level.difficultyId, levelNo: level.levelNo, completed: true,
      baseScore: level.difficultyId === 'master' ? 2000 : level.difficultyId === 'king' ? 4000 : 10000,
      bestMedal: 'GOLD' as const, bestTime: 1000, minMistakes: 0, minHints: 0,
      completionCount: 1, firstCompletedAt: 1, lastCompletedAt: 1
    }]))
    resultsRepository.saveProgress(progress)
    const mounted = mount(HomePage, {})
    hooks.shows.forEach(cb => cb())
    await nextTick()
    expect(findAll(mounted.root, el => el.tag === 'text' && el.props.class === 'number')[0].text).toBe('26')
    find(mounted.root, el => el.tag === 'button' && String(el.props.class).includes('primary-action'))!.props.onTap()
    await vi.advanceTimersByTimeAsync(1000)
    finish(useGameStore())
    const stats = useStatisticsStore()
    expect(stats.summary).toMatchObject({ completedLevels: 76, legacyCompletedLevels: 75, legacyTotal: 75, totalScore: 402000 })
    expect(stats.byDifficulty[0]).toMatchObject({ completed: 26, highestCompleted: 26, nextLevelNo: 27, stageCompleted: 1 })
    mounted.unmount()
  })

  it('jumps to distant numbered levels and can cancel or leave without starting a game', async () => {
    const mounted = mount(HomePage, {})
    hooks.shows.forEach(cb => cb())
    const input = find(mounted.root, el => el.tag === 'input')!
    input.props.onInput({ detail: { value: '10001' } })
    find(mounted.root, el => el.tag === 'button' && el.text === '前往')!.props.onTap()
    await nextTick()
    expect(findAll(mounted.root, el => el.tag === 'text' && String(el.props.class).split(' ').includes('number'))[0].text).toBe('10001')
    find(mounted.root, el => el.tag === 'button' && String(el.props.class).includes('primary-action'))!.props.onTap()
    await nextTick()
    find(mounted.root, el => el.tag === 'button' && el.text === '取消生成')!.props.onTap()
    await vi.advanceTimersByTimeAsync(1000)
    expect(useGameStore().game).toBeNull()
    expect(campaignRepository.load()).toEqual([])
    expect(uni.navigateTo).not.toHaveBeenCalled()
    find(mounted.root, el => el.tag === 'button' && String(el.props.class).includes('primary-action'))!.props.onTap()
    hooks.hides.forEach(cb => cb())
    await vi.advanceTimersByTimeAsync(1000)
    expect(useGameStore().game).toBeNull()
    expect(uni.navigateTo).not.toHaveBeenCalled()
    mounted.unmount()
  })

  it('advances directly from original level 25 to generated 26 and then 27 from the result page', async () => {
    const store = useGameStore()
    store.startGame(LEVELS.find(level => level.id === 'grandmaster-025')!); finish(store)
    await vi.advanceTimersByTimeAsync(100)
    for (const nextId of ['grandmaster-026', 'grandmaster-027']) {
      const mounted = mount(ResultPage, {})
      const next = find(mounted.root, el => el.tag === 'button' && el.text === '下一关')!
      expect(next).toBeDefined()
      next.props.onTap()
      await vi.advanceTimersByTimeAsync(1000)
      expect(store.game!.levelId).toBe(nextId)
      expect(store.game!.status).toBe('PLAYING')
      mounted.unmount()
      finish(store)
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(useProgressStore().totalScore).toBe(30000)
    expect(useStatisticsStore().summary.legacyCompletedLevels).toBe(1)
    expect(useStatisticsStore().byDifficulty[2].highestCompleted).toBe(27)
  })

  it('cancelled next-level generation keeps the completed result available for retry', async () => {
    const store = useGameStore()
    store.startGame(LEVELS.find(level => level.id === 'master-025')!); finish(store)
    await vi.advanceTimersByTimeAsync(100)
    const completedId = store.game!.id
    const mounted = mount(ResultPage, {})
    vi.mocked(uni.redirectTo).mockClear()
    find(mounted.root, el => el.tag === 'button' && el.text === '下一关')!.props.onTap()
    await nextTick()
    find(mounted.root, el => el.tag === 'button' && el.text === '取消生成')!.props.onTap()
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.game).toMatchObject({ id: completedId, status: 'COMPLETED' })
    expect(uni.redirectTo).not.toHaveBeenCalled()
    find(mounted.root, el => el.tag === 'button' && el.text === '下一关')!.props.onTap()
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.game!.levelId).toBe('master-026')
    mounted.unmount()
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function start() {
  const store = useGameStore()
  store.startGame(LEVELS[0])
  return store
}

function finish(store: ReturnType<typeof useGameStore>) {
  const indexes = store.game!.cells.filter(cell => cell.origin !== 'GIVEN').map(cell => cell.index)
  for (const index of indexes) {
    store.selectCell(index)
    store.inputNormalDigit(store.game!.cells[index].solution)
  }
}

// A tiny in-memory Vue host exercises actual component rendering and events.
// No browser, DOM, application server or native UI is started.
type HostNode = { tag: string; text: string; props: Record<string, any>; children: HostNode[]; parent: HostNode | null }
const node = (tag: string, text = ''): HostNode => ({ tag, text, props: {}, children: [], parent: null })
const renderer = createRenderer<HostNode, HostNode>({
  patchProp: (el, key, _old, value) => { el.props[key] = value },
  insert: (el, parent, anchor) => {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(el)
    else parent.children.splice(index, 0, el)
  },
  remove: el => {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = null
  },
  createElement: tag => node(tag),
  createText: text => node('#text', text),
  createComment: text => node('#comment', text),
  setText: (el, text) => { el.text = text },
  setElementText: (el, text) => { el.text = text; el.children = [] },
  insertStaticContent: (content, parent, anchor) => {
    const el = node('#static', content)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(el)
    else parent.children.splice(index, 0, el)
    return [el, el]
  },
  parentNode: el => el.parent,
  nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null
})

function mount(component: Component, props: Record<string, any>) {
  const root = node('root')
  const app = renderer.createApp({ render: () => h(component, props) })
  app.mount(root)
  return { root, unmount: () => app.unmount() }
}

function find(root: HostNode, predicate: (el: HostNode) => boolean): HostNode | undefined {
  if (predicate(root)) return root
  for (const child of root.children) {
    const found = find(child, predicate)
    if (found) return found
  }
}

function findAll(root: HostNode, predicate: (el: HostNode) => boolean): HostNode[] {
  return [...(predicate(root) ? [root] : []), ...root.children.flatMap(child => findAll(child, predicate))]
}

describe('Normal business flows, using real stores and in-memory uni storage', () => {
  it('clears peer notes with a correct answer and restores the whole patch on undo', () => {
    const store = start()
    store.autoCandidatesAll()
    const target = store.game!.cells.find(cell => !cell.value && peerIndexes(cell.index).some(index =>
      !store.game!.cells[index].value && (store.game!.cells[index].notesMask & digitBit(cell.solution)) !== 0))!
    const peer = peerIndexes(target.index).find(index => !store.game!.cells[index].value &&
      (store.game!.cells[index].notesMask & digitBit(target.solution)) !== 0)!
    const before = snapshotCell(store.game!.cells[peer])
    store.selectCell(target.index)
    store.inputNormalDigit(target.solution)
    expect(store.game!.cells[peer].notesMask & digitBit(target.solution)).toBe(0)
    store.undo()
    expect(snapshotCell(store.game!.cells[peer])).toEqual(before)
    expect(store.game!.cells[target.index].value).toBe(0)
    store.redo()
    expect(store.game!.cells[target.index].value).toBe(target.solution)
  })

  it('protects given cells and keeps cumulative mistakes after undo', () => {
    const store = start()
    const index = store.game!.selectedIndex!
    const wrong = store.game!.cells[index].solution % 9 + 1
    store.inputNormalDigit(wrong)
    expect(store.game!.mistakeCount).toBe(1)
    expect(store.game!.cells[index].error).toBe(true)
    store.undo()
    expect(store.game!.cells[index].value).toBe(0)
    expect(store.game!.mistakeCount).toBe(1)
    const given = store.game!.cells.find(cell => cell.origin === 'GIVEN')!
    store.selectCell(given.index)
    store.inputNormalDigit(given.value % 9 + 1)
    expect(store.game!.cells[given.index].value).toBe(given.value)
  })

  it('toggles valid notes, blocks impossible notes and erases notes', () => {
    const store = start()
    const index = store.game!.selectedIndex!
    const candidates = maskToDigits(getCandidateMask(parseBoard(store.game!.puzzle), index))
    store.inputNoteDigit(candidates[0])
    expect(store.game!.cells[index].notesMask & digitBit(candidates[0])).not.toBe(0)
    const impossible = Array.from({ length: 9 }, (_, i) => i + 1).find(digit => !candidates.includes(digit))!
    const before = store.game!.cells[index].notesMask
    store.inputNoteDigit(impossible)
    expect(store.game!.cells[index].notesMask).toBe(before)
    store.erase()
    expect(store.game!.cells[index].notesMask).toBe(0)
  })

  it('counts active time and excludes paused time', () => {
    const store = start()
    vi.setSystemTime(110000)
    expect(store.elapsed()).toBe(10000)
    store.pause()
    vi.setSystemTime(130000)
    expect(store.elapsed()).toBe(10000)
    store.resume()
    vi.setSystemTime(135000)
    expect(store.elapsed()).toBe(15000)
  })

  it('keeps running on background pause when the preference is disabled', () => {
    const store = start()
    useSettingsStore().settings.autoPauseOnBackground = false
    vi.setSystemTime(110000)
    store.pause(true)
    expect(store.game!.status).toBe('PLAYING')
    vi.setSystemTime(120000)
    expect(store.elapsed()).toBe(20000)
  })

  it('restores the saved board, notes and operation stacks after a simulated cold start', () => {
    const store = start()
    const index = store.game!.selectedIndex!
    store.autoCandidatesAll()
    store.inputNormalDigit(store.game!.cells[index].solution)
    store.pause()
    setActivePinia(createPinia())
    const restored = useGameStore()
    expect(restored.restoreGame()).toBe(true)
    expect(restored.game!.status).toBe('PAUSED')
    expect(restored.game!.cells[index].value).toBe(store.game!.cells[index].value)
    expect(restored.game!.undoStack.length).toBe(store.game!.undoStack.length)
    expect(restored.game!.timeline.length).toBe(store.game!.timeline.length)
  })

  it('records first completion, medal and history without awarding repeat points', () => {
    const store = start()
    finish(store)
    expect(store.game!.status).toBe('COMPLETED')
    expect(store.game!.completion!.medal).toBe('GOLD')
    expect(store.game!.completion!.scoreAwarded).toBe(2000)
    expect(useHistoryStore().records).toHaveLength(1)
    expect(storage.has(CURRENT)).toBe(false)
    store.restartCurrent()
    finish(store)
    expect(store.game!.completion!.scoreAwarded).toBe(0)
    expect(useProgressStore().totalScore).toBe(2000)
    expect(useHistoryStore().records).toHaveLength(2)
  })

  it('counts a viewed hint and fills the target as HINT', () => {
    const store = start()
    const hint = store.requestHint()!
    expect(hint).not.toBeNull()
    expect(store.game!.hintCount).toBe(1)
    expect(store.game!.cells[hint.index].value).toBe(0)
    store.applyHint()
    expect(store.game!.cells[hint.index].value).toBe(hint.digit)
    expect(store.game!.cells[hint.index].origin).toBe('HINT')
    store.undo()
    expect(store.game!.hintCount).toBe(1)
  })
})

describe('Reliability regressions', () => {
  it('keeps unchecked wrong digits from disabling a number key', () => {
    const store = start()
    useSettingsStore().settings.immediateErrorCheck = false
    for (const c of store.game!.cells.filter(c => c.origin !== 'GIVEN').slice(0, 9)) { store.selectCell(c.index); store.inputNormalDigit(1) }
    const answer = vi.fn()
    const mounted = mount(NumberPad, { cells: store.game!.cells, onAnswer: answer })
    const key = find(mounted.root, el => el.tag === 'button' && el.children.some(c => c.text === '1'))!
    expect(String(key.props.class)).not.toContain('completed')
    key.props.onTap()
    expect(answer).toHaveBeenCalledWith(1)
    mounted.unmount()
  })

  it('updates the displayed medal number with its prop', async () => {
    const props = reactive({ medal: 'BRONZE' })
    const mounted = mount(MedalBadge, props)
    props.medal = 'GOLD'; await nextTick()
    expect(find(mounted.root, el => el.tag === 'text')!.text).toBe('1')
    mounted.unmount()
  })

  it('shows a final board with no phantom controls when replay is archived', () => {
    const store = start(); finish(store)
    useHistoryStore().add({ ...useHistoryStore().records[0], id: 'audit-old', timeline: [] })
    const mounted = mount(HistoryDetail, {})
    expect(findAll(mounted.root, el => el.tag === 'text' && el.props.class === 'value')).toHaveLength(81)
    expect(find(mounted.root, el => el.tag === 'slider')).toBeUndefined()
    mounted.unmount()
  })

  it('preserves the baseline when timeline events are trimmed', () => {
    const store = start()
    const empty = store.game!.cells.filter(c => !c.value)
    store.selectCell(empty[0].index); store.inputNormalDigit(empty[0].solution)
    store.selectCell(empty[1].index)
    useSettingsStore().settings.smartNotes = false
    for (let i = 0; i < 1500; i++) store.inputNoteDigit(1)
    const g = store.game!
    expect(g.timeline).toHaveLength(1500)
    const replay = replayCells({ ...g, finalValues: g.cells.map(c => c.value), origins: g.cells.map(c => c.origin) }, 1499)
    expect(replay[empty[0].index].value).toBe(empty[0].solution)
    store.pause()
    setActivePinia(createPinia())
    expect(useGameStore().restoreGame()).toBe(true)
    expect(useGameStore().game!.timelineBase![empty[0].index].value).toBe(empty[0].solution)
  })

  it('migrates legacy history and keeps cumulative totals after retention and deletion', () => {
    const store = start(); finish(store)
    const record = useHistoryStore().records[0]
    storage.delete(RESULTS_KEY)
    storage.set(HISTORY, JSON.stringify({ version: 2, data: Array.from({ length: 1000 }, (_, i) => ({ ...record, id: `old-${i}`, serialNo: 1000 - i, elapsedTime: i === 999 ? 999000 : 1000, timeline: [] })) }))
    useHistoryStore().refresh()
    const stats = useStatisticsStore()
    const before = stats.summary.totalPlayTime
    useHistoryStore().add({ ...record, id: 'new-record', elapsedTime: 1000, timeline: [] })
    expect(useHistoryStore().records).toHaveLength(1000)
    expect(stats.summary.totalCompletions).toBe(1001)
    expect(stats.summary.totalPlayTime).toBe(before + 1000)
    useHistoryStore().remove('new-record')
    expect(stats.summary.totalCompletions).toBe(1001)
    const next = useHistoryStore().add({ ...record, id: 'newer-record', timeline: [] })
    expect(next.serialNo).toBe(1002)
    setActivePinia(createPinia())
    expect(useStatisticsStore().summary.totalCompletions).toBe(1002)
  })

  it('rejects malformed storage and damaged action indexes safely', () => {
    storage.set(HISTORY, JSON.stringify({ version: 2, data: {} }))
    storage.set('sudoku:v1:progress', JSON.stringify({ data: { x: { completed: true } } }))
    storage.set('sudoku:v1:settings', JSON.stringify({ data: { sound: 'false', theme: 'bad' } }))
    expect(historyRepository.list()).toEqual([])
    expect(useProgressStore().progressMap).toEqual({})
    const store = start(); store.pause()
    const raw = JSON.parse(storage.get(CURRENT)!)
    raw.data.undoStack = [{ id: 'bad', type: 'HINT', timestamp: 1, changes: [{ index: 999 }] }]
    storage.set(CURRENT, JSON.stringify(raw))
    expect(currentGameRepository.load()!.undoStack).toEqual([])
    raw.data.cells[0].solution = 99
    storage.set(CURRENT, JSON.stringify(raw))
    expect(currentGameRepository.load()).toBeNull()
  })

  it('keeps settlement atomic on failure and retries without duplicate awards', () => {
    const store = start()
    const original = uni.setStorageSync
    uni.setStorageSync = ((key: string, value: string) => { if (key === RESULTS_KEY) throw new Error('quota'); original(key, value) }) as typeof uni.setStorageSync
    expect(() => finish(store)).not.toThrow()
    expect(store.game!.status).toBe('PLAYING')
    expect(useProgressStore().totalScore).toBe(0)
    expect(useHistoryStore().records).toHaveLength(0)
    expect(currentGameRepository.load()!.cells.every(c => c.value === c.solution)).toBe(true)
    expect(store.storageError).toContain('重试结算')
    uni.setStorageSync = original
    expect(store.completeGame()).toBe(true)
    expect(store.completeGame()).toBe(false)
    expect(useHistoryStore().records).toHaveLength(1)
    expect(useProgressStore().totalScore).toBe(2000)
  })

  it('allows settlement retry after a failed completion and a cold restart', () => {
    const store = start()
    const original = uni.setStorageSync
    uni.setStorageSync = ((key: string, value: string) => { if (key === RESULTS_KEY) throw new Error('quota'); original(key, value) }) as typeof uni.setStorageSync
    finish(store); store.pause()
    uni.setStorageSync = original
    setActivePinia(createPinia())
    const restored = useGameStore()
    expect(restored.restoreGame()).toBe(true)
    expect(restored.needsSettlement).toBe(true)
    expect(restored.completeGame()).toBe(true)
    expect(useHistoryStore().records).toHaveLength(1)
    expect(useProgressStore().totalScore).toBe(2000)
  })

  it('rejects a stale completed save even if cleanup fails', () => {
    const store = start(); store.flushSave()
    const stale = storage.get(CURRENT)!
    finish(store)
    storage.set(CURRENT, stale)
    setActivePinia(createPinia())
    expect(useGameStore().restoreGame()).toBe(false)
    expect(useHistoryStore().records).toHaveLength(1)
  })

  it('rejects a stale save after reset even if current-game cleanup is unavailable', () => {
    const store = start()
    const prior = storage.get(CURRENT)!
    resultsRepository.reset()
    store.discard(false)
    storage.set(CURRENT, prior)
    setActivePinia(createPinia())
    expect(useGameStore().restoreGame()).toBe(false)
    expect(useProgressStore().totalScore).toBe(0)
    expect(useHistoryStore().totals.totalCompletions).toBe(0)
  })

  it('corrects unchecked mistakes before logical hints and protects hint application', () => {
    const store = start()
    useSettingsStore().settings.immediateErrorCheck = false
    const index = store.game!.selectedIndex!
    store.inputNormalDigit(store.game!.cells[index].solution % 9 + 1)
    expect(store.game!.cells[index].error).toBe(false)
    const hint = store.requestHint()!
    expect(hint.index).toBe(index)
    expect(hint.digit).toBe(store.game!.cells[index].solution)
    expect(store.requestHint()).toEqual(hint)
    expect(store.game!.hintCount).toBe(1)
    hint.digit = hint.digit % 9 + 1
    store.applyHint()
    expect(store.game!.cells[index].origin).toBe('USER')
    store.requestHint(); store.applyHint()
    expect(store.game!.cells[index].value).toBe(store.game!.cells[index].solution)
  })
})

describe('Additional play modes and tools', () => {
  it('resumes after closing More, respects a previously paused game and pauses on hide', async () => {
    const store = start()
    useSettingsStore().settings.onboardingSeen = true
    const mounted = mount(GamePage, {})
    hooks.shows.forEach(cb => cb())
    const openMore = () => find(mounted.root, el => String(el.props.class).includes('more-button'))!.props.onTap()
    const closeMore = () => find(mounted.root, el => el.props.class === 'close')!.props.onTap()
    openMore(); await nextTick()
    expect(store.game!.status).toBe('PAUSED')
    closeMore(); await vi.advanceTimersByTimeAsync(0); await nextTick()
    expect(store.game!.status).toBe('PLAYING')
    store.pause(); openMore(); await nextTick()
    closeMore(); await vi.advanceTimersByTimeAsync(0)
    expect(store.game!.status).toBe('PAUSED')
    store.resume(); hooks.hides.forEach(cb => cb())
    expect(store.game!.status).toBe('PAUSED')
    mounted.unmount()
  })

  it('reveals teaching steps before enabling answer fill', async () => {
    const props = reactive({ modelValue: true, hint: { index: 0, digit: 4, technique: 'NAKED_SINGLE', message: '候选唯一', steps: [{ technique: 'NAKED_SINGLE', kind: 'PLACE', index: 0, digit: 4, message: '该格只剩 4' }] }, onApply: vi.fn() })
    const mounted = mount(HintSheet, props)
    expect(find(mounted.root, el => el.tag === 'text' && String(el.props.class).includes('answer'))).toBeUndefined()
    find(mounted.root, el => el.tag === 'button' && String(el.props.class).includes('primary-action'))!.props.onTap()
    await nextTick()
    expect(find(mounted.root, el => el.tag === 'text' && String(el.props.class).includes('answer'))).toBeDefined()
    find(mounted.root, el => el.tag === 'button' && String(el.props.class).includes('primary-action'))!.props.onTap()
    expect(props.onApply).toHaveBeenCalledOnce()
    mounted.unmount()
  })

  it('uses a cached puzzle once and prepares a different next puzzle', async () => {
    const level = LEVELS.find(l => l.tier === 'beginner')!
    const cached = { ...level, id: 'cached-test', difficultyId: 'beginner' }
    practiceRepository.save({ recent: [], cache: { beginner: cached } })
    expect((await requestPracticeLevel('beginner')).id).toBe('cached-test')
    expect(practiceRepository.load().recent).toContain(cached.puzzle)
    expect(practiceRepository.load().cache.beginner).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1000)
    const next = practiceRepository.load().cache.beginner!
    expect(next).toBeDefined()
    expect(next.puzzle).not.toBe(cached.puzzle)
    resetPracticeCache()
    expect(practiceRepository.load().recent).toEqual([])
  })
  it('uses number-first input only on editable cells', () => {
    const store = start()
    useSettingsStore().settings.inputStyle = 'number-first'
    const empty = store.game!.cells.find(c => !c.value)!
    store.chooseDigit(empty.solution)
    expect(store.game!.cells[empty.index].value).toBe(0)
    store.selectCell(empty.index)
    expect(store.game!.cells[empty.index].value).toBe(empty.solution)
    const given = store.game!.cells.find(c => c.origin === 'GIVEN')!
    store.selectCell(given.index)
    expect(store.game!.cells[given.index].value).toBe(given.solution)
    store.chooseDigit(empty.solution)
    expect(store.activeDigit).toBeNull()
  })

  it('checks hidden errors without counting a mistake twice; restores bookmarks with undo', () => {
    const store = start()
    useSettingsStore().settings.immediateErrorCheck = false
    const index = store.game!.selectedIndex!
    store.saveBookmark()
    store.inputNormalDigit(store.game!.cells[index].solution % 9 + 1)
    expect(store.checkBoard()).toBe(1)
    expect(store.checkBoard()).toBe(1)
    expect(store.game!.mistakeCount).toBe(1)
    expect(store.restoreBookmark()).toBe(true)
    expect(store.game!.cells[index].value).toBe(0)
    expect(store.game!.mistakeCount).toBe(1)
    store.undo()
    expect(store.game!.cells[index].error).toBe(true)
  })

  it('restores and restarts generated games with their own puzzle; excludes campaign points', () => {
    const level = createDailyLevel('2026-09-30')
    const store = useGameStore()
    store.startGame(level, 'PRACTICE')
    store.pause()
    setActivePinia(createPinia())
    const restored = useGameStore()
    expect(restored.restoreGame()).toBe(true)
    expect(restored.restartCurrent()).toBe(true)
    expect(restored.game!.puzzle).toBe(level.puzzle)
    expect(restored.game!.mode).toBe('PRACTICE')
    finish(restored)
    expect(useProgressStore().totalScore).toBe(0)
    expect(useProgressStore().completedCount).toBe(0)
    expect(useHistoryStore().totals.byMode.PRACTICE).toBe(1)
  })

  it('records daily completion once per date while preserving replay attempt totals', () => {
    const level = createDailyLevel('2026-09-30')
    const store = useGameStore()
    store.startGame(level, 'DAILY', '2026-09-30'); finish(store)
    store.restartCurrent(); finish(store)
    expect(useHistoryStore().dailyDates).toEqual(['2026-09-30'])
    expect(useHistoryStore().totals.byMode.DAILY).toBe(2)
    expect(useProgressStore().totalScore).toBe(0)
  })
})
