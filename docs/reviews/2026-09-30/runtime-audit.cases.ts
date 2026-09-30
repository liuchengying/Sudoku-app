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
import { historyRepository } from '@/repositories/history.repository'
import NumberPad from '@/components/sudoku/NumberPad.vue'
import MedalBadge from '@/components/common/MedalBadge.vue'
import HistoryDetail from '@/pages/history/detail.vue'

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (callback: (query: { id: string }) => void) => callback({ id: 'audit-old' })
}))

const storage = new Map<string, string>()
const CURRENT = 'sudoku:v1:current-game'
const HISTORY = 'sudoku:v1:history'

beforeEach(() => {
  storage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(100000)
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.get(key) ?? '',
    setStorageSync: (key: string, value: string) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    redirectTo: vi.fn(),
    vibrateShort: vi.fn(),
    vibrateLong: vi.fn()
  })
  setActivePinia(createPinia())
  useSettingsStore().settings.sound = false
  useSettingsStore().settings.haptics = false
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

describe('Confirmed current issues (passing assertions reproduce defects)', () => {
  it('reproduces an incorrect completion lock in the real NumberPad when error checking is off', () => {
    const store = start()
    useSettingsStore().settings.immediateErrorCheck = false
    for (const cell of store.game!.cells.filter(cell => cell.origin !== 'GIVEN').slice(0, 9)) {
      store.selectCell(cell.index)
      store.inputNormalDigit(1)
    }
    const answer = vi.fn()
    const mounted = mount(NumberPad, { cells: store.game!.cells, onAnswer: answer })
    const key = find(mounted.root, el => el.text === '1' && String(el.props.class).includes('answer-key'))!
    expect(store.game!.cells.filter(cell => cell.value === 1 && cell.solution === 1).length).toBeLessThan(9)
    expect(String(key.props.class)).toContain('completed')
    key.props.onTap()
    expect(answer).not.toHaveBeenCalled()
    mounted.unmount()
  })

  it('reproduces a stale medal number after the medal prop changes', async () => {
    const props = reactive({ medal: 'BRONZE' })
    const mounted = mount(MedalBadge, props)
    props.medal = 'GOLD'
    await nextTick()
    expect(find(mounted.root, el => String(el.props.class).includes('medal gold'))).toBeDefined()
    expect(find(mounted.root, el => el.tag === 'text')!.text).toBe('3')
    mounted.unmount()
  })

  it('reproduces phantom replay steps on the actual history detail with no retained timeline', async () => {
    const store = start()
    finish(store)
    useHistoryStore().add({ ...useHistoryStore().records[0], id: 'audit-old', serialNo: undefined, timeline: [] })
    const mounted = mount(HistoryDetail, {})
    const displayedDigits = () => findAll(mounted.root, el => el.tag === 'text' && el.props.class === 'value').length
    expect(displayedDigits()).toBe(81)
    const slider = find(mounted.root, el => el.tag === 'slider')!
    expect(slider.props.max).toBe(1)
    slider.props.onChange({ detail: { value: 1 } })
    await nextTick()
    expect(displayedDigits()).toBe(LEVELS[0].clueCount)
    mounted.unmount()
  })

  it('reproduces lost replay context once the first event is trimmed', () => {
    const store = start()
    const empty = store.game!.cells.filter(cell => !cell.value)
    store.selectCell(empty[0].index)
    store.inputNormalDigit(empty[0].solution)
    store.selectCell(empty[1].index)
    useSettingsStore().settings.smartNotes = false
    for (let i = 0; i < 1500; i++) store.inputNoteDigit(1)
    expect(store.game!.timeline).toHaveLength(1500)
    const replay = createCells(store.game!.puzzle, store.game!.solution)
    for (const event of store.game!.timeline.slice(0, 1499)) {
      for (const change of event.changes) Object.assign(replay[change.index], event.kind === 'APPLY' ? change.after : change.before)
    }
    expect(store.game!.cells[empty[0].index].value).toBe(empty[0].solution)
    expect(replay[empty[0].index].value).toBe(0)
  })

  it('reproduces cumulative statistics dropping early history beyond 1000 records', () => {
    const store = start()
    finish(store)
    const record = useHistoryStore().records[0]
    const oldRecords = Array.from({ length: 1000 }, (_, i) => ({ ...record, id: `old-${i}`, serialNo: 1000 - i, elapsedTime: i === 999 ? 999000 : 1000, timeline: [] }))
    storage.set(HISTORY, JSON.stringify({ version: 2, data: oldRecords }))
    useHistoryStore().refresh()
    const stats = useStatisticsStore()
    const before = stats.summary.totalPlayTime
    useHistoryStore().add({ ...record, id: 'new-record', serialNo: undefined, elapsedTime: 1000, timeline: [] })
    expect(stats.summary.totalCompletions).toBe(1000)
    expect(stats.summary.totalPlayTime).toBeLessThan(before)
  })

  it('reproduces a crash when syntactically valid history storage has the wrong shape', () => {
    storage.set(HISTORY, JSON.stringify({ version: 2, data: {} }))
    expect(() => historyRepository.list()).toThrow()
  })

  it('reproduces inconsistent settlement after a history write fails', () => {
    const store = start()
    const original = uni.setStorageSync
    vi.mocked(uni).setStorageSync = ((key: string, value: string) => {
      if (key === HISTORY) throw new Error('simulated storage quota error')
      original(key, value)
    }) as typeof uni.setStorageSync
    expect(() => finish(store)).toThrow('simulated storage quota error')
    expect(store.game!.status).toBe('COMPLETED')
    expect(useProgressStore().totalScore).toBe(2000)
    expect(useHistoryStore().records).toHaveLength(0)
    expect(storage.has(CURRENT)).toBe(true)
  })

  it('reproduces a wrong logically-derived hint being filled and marked non-error in unchecked mode', () => {
    let example: { level: typeof LEVELS[number]; index: number; wrong: number } | null = null
    outer: for (const level of LEVELS) {
      const board = parseBoard(level.puzzle)
      for (let index = 0; index < 81; index++) {
        if (board[index]) continue
        for (const wrong of maskToDigits(getCandidateMask(board, index))) {
          if (wrong === Number(level.solution[index])) continue
          const trial = [...board]
          trial[index] = wrong
          if (!validateBoard(trial)) continue
          const hint = findHint(trial)
          if (hint && hint.digit !== Number(level.solution[hint.index])) {
            example = { level, index, wrong }
            break outer
          }
        }
      }
    }
    expect(example).not.toBeNull()
    const { level, index, wrong } = example!
    const store = useGameStore()
    store.startGame(level)
    useSettingsStore().settings.immediateErrorCheck = false
    store.selectCell(index)
    store.inputNormalDigit(wrong)
    store.selectCell(store.game!.cells.find(cell => cell.origin === 'GIVEN')!.index)
    const hint = store.requestHint()!
    expect(hint.digit).not.toBe(store.game!.cells[hint.index].solution)
    store.applyHint()
    expect(store.game!.cells[hint.index].origin).toBe('HINT')
    expect(store.game!.cells[hint.index].error).toBe(false)
    expect(store.game!.cells[hint.index].value).not.toBe(store.game!.cells[hint.index].solution)
  })
})
