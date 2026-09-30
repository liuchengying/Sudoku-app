import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  createCells,
  digitBit,
  findHint,
  getCandidateMask,
  peerIndexes,
  snapshotCell,
  type CellChange,
  type CellSnapshot,
  type GameAction,
  type GameActionType,
  type GameState,
  type GameMode,
  type HintResult,
  type ReplayEvent,
  type SudokuLevel
} from '@/core/sudoku'
import { currentGameRepository } from '@/repositories/current-game.repository'
import { resultsRepository } from '@/repositories/results.repository'
import { createId } from '@/utils/id'
import { useSettingsStore } from './settings.store'
import { useProgressStore } from './progress.store'
import { useHistoryStore } from './history.store'
import { getDifficulty } from '@/config/difficulty'
import { getLevelById } from '@/assets/puzzles'
import type { MedalType } from '@/types/progress'
import { audioService } from '@/services/audio.service'

let saveTimer: ReturnType<typeof setTimeout> | null = null

function cloneState(game: GameState): GameState {
  return JSON.parse(JSON.stringify(game)) as GameState
}

function sameSnapshot(a: CellSnapshot, b: CellSnapshot): boolean {
  return a.value === b.value && a.origin === b.origin && a.notesMask === b.notesMask && a.error === b.error
}

function medalFor(mistakes: number, hints: number): MedalType {
  if (mistakes === 0 && hints === 0) return 'GOLD'
  if (mistakes <= 2 && hints === 0) return 'SILVER'
  return 'BRONZE'
}

export const useGameStore = defineStore('game', () => {
  const game = ref<GameState | null>(null)
  const pendingHint = ref<HintResult | null>(null)
  const storageError = ref('')
  const activeDigit = ref<number | null>(null)
  watch(() => useSettingsStore().settings.inputStyle, () => { activeDigit.value = null })

  const isActive = computed(() => game.value?.status === 'PLAYING')
  const needsSettlement = computed(() => Boolean(game.value && game.value.status !== 'COMPLETED' && game.value.cells.every(c => c.value === c.solution)))
  const selectedCell = computed(() => {
    if (!game.value || game.value.selectedIndex == null) return null
    return game.value.cells[game.value.selectedIndex]
  })

  function feedback(kind: 'tap' | 'error' | 'success' = 'tap') {
    const settings = useSettingsStore().settings
    audioService.play(kind, settings.sound)
    if (!settings.haptics) return
    try {
      if (kind === 'error') uni.vibrateLong?.({})
      else uni.vibrateShort?.({ type: 'light' } as never)
    } catch {
      // Haptics are best-effort across Android versions and H5.
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => flushSave(), 180)
  }

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (game.value && game.value.status !== 'COMPLETED') {
      game.value.updatedAt = Date.now()
      try {
        currentGameRepository.save(cloneState(game.value))
        storageError.value = ''
        return true
      } catch {
        storageError.value = '进度保存失败，请释放设备存储后重试。'
        return false
      }
    }
    return true
  }

  function restoreGame(): boolean {
    const saved = currentGameRepository.load()
    if (!saved || saved.status === 'COMPLETED') return false
    if (resultsRepository.load().discardedGameId === saved.id) return false
    if (resultsRepository.completionFor(saved.id)) { try { currentGameRepository.clear() } catch { /* Committed settlement is authoritative. */ } return false }
    const settings = useSettingsStore().settings

    if (saved.status === 'PLAYING' && saved.activeStartedAt != null) {
      const end = settings.autoPauseOnBackground ? (saved.updatedAt || Date.now()) : Date.now()
      saved.accumulatedTime += Math.max(0, end - saved.activeStartedAt)
      saved.status = 'PAUSED'
      saved.activeStartedAt = null
    }
    saved.timeline ??= []
    saved.completion ??= null
    game.value = saved
    pendingHint.value = null
    return true
  }

  function startGame(level: SudokuLevel, mode: GameMode = 'CAMPAIGN', dailyDate?: string) {
    const now = Date.now()
    const cells = createCells(level.puzzle, level.solution)
    const firstEmpty = cells.find((cell) => cell.origin !== 'GIVEN')?.index ?? null
    game.value = {
      id: createId('game'),
      mode,
      level: { ...level },
      dailyDate,
      timelineBase: cells.map(snapshotCell),
      levelId: level.id,
      difficultyId: level.difficultyId,
      puzzle: level.puzzle,
      solution: level.solution,
      cells,
      selectedIndex: firstEmpty,
      inputMode: 'NORMAL',
      status: 'PLAYING',
      mistakeCount: 0,
      hintCount: 0,
      startedAt: now,
      accumulatedTime: 0,
      activeStartedAt: now,
      undoStack: [],
      redoStack: [],
      timeline: [],
      completion: null,
      createdAt: now,
      updatedAt: now
    }
    pendingHint.value = null
    activeDigit.value = null
    storageError.value = ''
    flushSave()
  }

  function restartCurrent(): boolean {
    if (!game.value) return false
    const level = game.value.level ?? getLevelById(game.value.levelId)
    if (!level) return false
    startGame(level, game.value.mode ?? 'CAMPAIGN', game.value.dailyDate)
    return true
  }

  function selectCell(index: number) {
    if (!game.value || game.value.status !== 'PLAYING' || !Number.isInteger(index) || index < 0 || index >= 81) return
    game.value.selectedIndex = index
    pendingHint.value = null
    if (useSettingsStore().settings.inputStyle === 'number-first' && activeDigit.value != null) inputDigit(activeDigit.value)
  }

  function toggleNoteMode() {
    if (!game.value || game.value.status !== 'PLAYING') return
    game.value.inputMode = game.value.inputMode === 'NOTE' ? 'NORMAL' : 'NOTE'
    pendingHint.value = null
    feedback()
    scheduleSave()
  }

  function buildChanges(indexes: number[], before: Map<number, CellSnapshot>): CellChange[] {
    if (!game.value) return []
    return [...new Set(indexes)]
      .map((index) => {
        const prior = before.get(index)
        if (!prior) return null
        const after = snapshotCell(game.value!.cells[index])
        if (sameSnapshot(prior, after)) return null
        return { index, before: prior, after }
      })
      .filter((item): item is CellChange => item !== null)
  }

  function appendTimeline(kind: ReplayEvent['kind'], action: GameAction) {
    if (!game.value) return
    game.value.timeline.push({
      id: createId('event'),
      kind,
      actionType: action.type,
      changes: action.changes,
      timestamp: Date.now()
    })
    if (game.value.timeline.length > 1500) {
      game.value.timelineTruncated = true
      game.value.timelineBase ??= createCells(game.value.puzzle, game.value.solution).map(snapshotCell)
      for (const event of game.value.timeline.splice(0, game.value.timeline.length - 1500)) {
        for (const change of event.changes) game.value.timelineBase[change.index] = { ...(event.kind === 'APPLY' ? change.after : change.before) }
      }
    }
  }

  function commitAction(type: GameActionType, changes: CellChange[]) {
    if (!game.value || changes.length === 0) return
    const action: GameAction = { id: createId('action'), type, changes, timestamp: Date.now() }
    game.value.undoStack.push(action)
    if (game.value.undoStack.length > 500) game.value.undoStack.shift()
    game.value.redoStack = []
    appendTimeline('APPLY', action)
    pendingHint.value = null
    scheduleSave()
  }

  function capture(indexes: number[]): Map<number, CellSnapshot> {
    const map = new Map<number, CellSnapshot>()
    if (!game.value) return map
    for (const index of new Set(indexes)) map.set(index, snapshotCell(game.value.cells[index]))
    return map
  }

  function currentBoard(clearKnownErrors = false): number[] {
    return game.value?.cells.map((cell) => (clearKnownErrors && cell.value !== cell.solution ? 0 : cell.value)) ?? []
  }

  function inputNormalDigit(digit: number) {
    if (!game.value || game.value.status !== 'PLAYING') return
    if (!Number.isInteger(digit) || digit < 1 || digit > 9 || game.value.selectedIndex == null) return
    const index = game.value.selectedIndex
    const cell = game.value.cells[index]
    if (cell.origin === 'GIVEN' || cell.value === digit) return

    const peers = peerIndexes(index)
    const tracked = [index, ...peers]
    const before = capture(tracked)
    const correct = digit === cell.solution
    const settings = useSettingsStore().settings

    cell.value = digit
    cell.origin = 'USER'
    cell.notesMask = 0
    cell.error = settings.immediateErrorCheck ? !correct : false

    if (!correct) {
      game.value.mistakeCount += 1
      if (settings.immediateErrorCheck) feedback('error')
      else feedback()
    } else {
      feedback()
    }

    if (correct && settings.autoRemoveCandidates) {
      const bit = digitBit(digit)
      for (const peerIndex of peers) game.value.cells[peerIndex].notesMask &= ~bit
    }

    commitAction('SET_VALUE', buildChanges(tracked, before))
    checkCompletion()
  }

  function inputNoteDigit(digit: number) {
    if (!game.value || game.value.status !== 'PLAYING') return
    if (!Number.isInteger(digit) || digit < 1 || digit > 9 || game.value.selectedIndex == null) return
    const index = game.value.selectedIndex
    const cell = game.value.cells[index]
    if (cell.origin === 'GIVEN' || cell.value !== 0) return

    const bit = digitBit(digit)
    const settings = useSettingsStore().settings
    const hasNote = (cell.notesMask & bit) !== 0
    if (!hasNote && settings.smartNotes) {
      const valid = getCandidateMask(currentBoard(true), index)
      if ((valid & bit) === 0) {
        feedback('error')
        return
      }
    }

    const before = capture([index])
    cell.notesMask ^= bit
    commitAction('TOGGLE_NOTE', buildChanges([index], before))
    feedback()
  }

  function inputDigit(digit: number) {
    if (!game.value) return
    if (game.value.inputMode === 'NOTE') inputNoteDigit(digit)
    else inputNormalDigit(digit)
  }

  function erase() {
    if (!game.value || game.value.status !== 'PLAYING' || game.value.selectedIndex == null) return
    const index = game.value.selectedIndex
    const cell = game.value.cells[index]
    if (cell.origin === 'GIVEN') return

    const before = capture([index])
    if (cell.value !== 0) {
      cell.value = 0
      cell.origin = null
      cell.error = false
    } else if (cell.notesMask !== 0) {
      cell.notesMask = 0
    } else {
      return
    }
    commitAction('CLEAR_VALUE', buildChanges([index], before))
    feedback()
  }

  function autoCandidates() {
    if (!game.value || game.value.status !== 'PLAYING' || game.value.selectedIndex == null) return
    const index = game.value.selectedIndex
    const cell = game.value.cells[index]
    if (cell.origin === 'GIVEN' || cell.value !== 0) return
    const before = capture([index])
    cell.notesMask = getCandidateMask(currentBoard(true), index)
    commitAction('SET_NOTES', buildChanges([index], before))
    feedback()
  }

  function autoCandidatesAll() {
    if (!game.value || game.value.status !== 'PLAYING') return
    const indexes = game.value.cells.filter((cell) => cell.origin !== 'GIVEN' && cell.value === 0).map((cell) => cell.index)
    if (!indexes.length) return
    const before = capture(indexes)
    const board = currentBoard(true)
    for (const index of indexes) game.value.cells[index].notesMask = getCandidateMask(board, index)
    commitAction('SET_ALL_NOTES', buildChanges(indexes, before))
    feedback()
  }

  function requestHint(): HintResult | null {
    if (!game.value || game.value.status !== 'PLAYING') return null
    if (pendingHint.value) return pendingHint.value
    const wrong = game.value.cells.find(c => c.origin !== 'GIVEN' && c.value !== 0 && c.value !== c.solution)
    if (wrong) {
      pendingHint.value = { index: wrong.index, digit: wrong.solution, technique: 'BACKTRACKING', message: `第 ${Math.floor(wrong.index / 9) + 1} 行第 ${wrong.index % 9 + 1} 列的填写有误，请先检查这个格。展开答案可以更正。`, focusIndexes: [wrong.index] }
    } else {
      pendingHint.value = findHint(currentBoard(true))
      if (!pendingHint.value) {
        const target = game.value.cells.find(c => !c.value)
        if (target) pendingHint.value = { index: target.index, digit: target.solution, technique: 'BACKTRACKING', message: '现有教学技巧暂时无法继续推导，可展开答案提示。', focusIndexes: [target.index] }
      }
    }
    if (pendingHint.value) {
      game.value.selectedIndex = pendingHint.value.index
      game.value.hintCount++
      scheduleSave()
    }
    return pendingHint.value
  }

  function applyHint() {
    if (!game.value || !pendingHint.value || game.value.status !== 'PLAYING') return
    const { index, digit } = pendingHint.value
    if (!Number.isInteger(index) || index < 0 || index > 80) { pendingHint.value = null; return }
    const cell = game.value.cells[index]
    if (cell.origin === 'GIVEN' || digit !== cell.solution) { pendingHint.value = null; return }
    const peers = peerIndexes(index)
    const tracked = [index, ...peers]
    const before = capture(tracked)

    cell.value = digit
    cell.origin = 'HINT'
    cell.error = false
    cell.notesMask = 0

    if (useSettingsStore().settings.autoRemoveCandidates) {
      const bit = digitBit(digit)
      for (const peerIndex of peers) game.value.cells[peerIndex].notesMask &= ~bit
    }

    game.value.selectedIndex = index
    commitAction('HINT', buildChanges(tracked, before))
    pendingHint.value = null
    feedback()
    checkCompletion()
  }

  function applySnapshot(index: number, snapshot: CellSnapshot) {
    if (!game.value) return
    Object.assign(game.value.cells[index], snapshot)
  }

  function undo() {
    if (!game.value || game.value.status !== 'PLAYING') return
    const action = game.value.undoStack.pop()
    if (!action) return
    for (const change of action.changes) applySnapshot(change.index, change.before)
    game.value.redoStack.push(action)
    appendTimeline('REVERT', action)
    pendingHint.value = null
    feedback()
    scheduleSave()
  }

  function redo() {
    if (!game.value || game.value.status !== 'PLAYING') return
    const action = game.value.redoStack.pop()
    if (!action) return
    for (const change of action.changes) applySnapshot(change.index, change.after)
    game.value.undoStack.push(action)
    appendTimeline('APPLY', action)
    pendingHint.value = null
    feedback()
    scheduleSave()
    checkCompletion()
  }

  function elapsed(now = Date.now()): number {
    if (!game.value) return 0
    if (game.value.status === 'PLAYING' && game.value.activeStartedAt != null) {
      return game.value.accumulatedTime + Math.max(0, now - game.value.activeStartedAt)
    }
    return game.value.accumulatedTime
  }

  function pause(force = false) {
    if (!game.value || game.value.status !== 'PLAYING') return
    if (force && !useSettingsStore().settings.autoPauseOnBackground) {
      flushSave()
      return
    }
    if (game.value.activeStartedAt != null) game.value.accumulatedTime += Math.max(0, Date.now() - game.value.activeStartedAt)
    game.value.activeStartedAt = null
    game.value.status = 'PAUSED'
    pendingHint.value = null
    flushSave()
  }

  function resume() {
    if (!game.value || game.value.status !== 'PAUSED') return
    game.value.status = 'PLAYING'
    game.value.activeStartedAt = Date.now()
    feedback()
    scheduleSave()
  }

  function checkCompletion() {
    if (!game.value) return
    if (game.value.cells.every((cell) => cell.value === cell.solution)) completeGame()
  }

  function completeGame(): boolean {
    if (!game.value || game.value.status === 'COMPLETED' || !game.value.cells.every(c => c.value === c.solution)) return false
    const now = Date.now()
    const duration = elapsed(now)
    const campaign = (game.value.mode ?? 'CAMPAIGN') === 'CAMPAIGN'
    try {
      const completion = resultsRepository.settle(game.value.id, {
        id: `record-${game.value.id}`, levelId: game.value.levelId, difficultyId: game.value.difficultyId,
        levelNo: game.value.level?.levelNo ?? getLevelById(game.value.levelId)?.levelNo ?? 0,
        mode: game.value.mode ?? 'CAMPAIGN', dailyDate: game.value.dailyDate,
        puzzle: game.value.puzzle, solution: game.value.solution,
        finalValues: game.value.cells.map(c => c.value), origins: game.value.cells.map(c => c.origin),
        elapsedTime: duration, mistakeCount: game.value.mistakeCount, hintCount: game.value.hintCount,
        baseScore: campaign ? getDifficulty(game.value.difficultyId).score : 0,
        medal: medalFor(game.value.mistakeCount, game.value.hintCount), startedAt: game.value.startedAt, completedAt: now,
        actions: [], timeline: [...game.value.timeline], timelineBase: game.value.timelineBase, timelineTruncated: game.value.timelineTruncated
      })
      game.value.accumulatedTime = duration
      game.value.activeStartedAt = null
      game.value.status = 'COMPLETED'
      game.value.completion = completion
      storageError.value = ''
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = null
      useProgressStore().reload()
      useHistoryStore().refresh()
      try { currentGameRepository.clear() } catch { /* A stale save is rejected by its settlement id. */ }
      feedback('success')
      setTimeout(() => uni.redirectTo({ url: '/pages/result/index' }), 80)
      return true
    } catch {
      const saved = flushSave()
      storageError.value = saved
        ? '完成结果保存失败，棋盘已存档。请释放存储后点击重试结算。'
        : '存储不可写，棋盘仅保留在当前页面。请释放存储后重试结算，暂勿关闭游戏。'
      return false
    }
  }

  function checkBoard(): number {
    if (!game.value || game.value.status !== 'PLAYING') return 0
    const indexes = game.value.cells.filter(c => c.origin !== 'GIVEN').map(c => c.index)
    const before = capture(indexes)
    for (const index of indexes) {
      const cell = game.value.cells[index]
      cell.error = cell.value !== 0 && cell.value !== cell.solution
    }
    commitAction('CHECK', buildChanges(indexes, before))
    return game.value.cells.filter(c => c.error).length
  }

  function chooseDigit(digit: number) {
    if (!isActive.value || !Number.isInteger(digit) || digit < 1 || digit > 9) return
    if (useSettingsStore().settings.inputStyle === 'number-first') activeDigit.value = activeDigit.value === digit ? null : digit
    else inputDigit(digit)
  }

  function saveBookmark() {
    if (!game.value || game.value.status !== 'PLAYING') return
    game.value.bookmark = game.value.cells.map(snapshotCell)
    flushSave()
  }

  function restoreBookmark(): boolean {
    if (!game.value?.bookmark || game.value.status !== 'PLAYING') return false
    const indexes = game.value.cells.filter(c => c.origin !== 'GIVEN').map(c => c.index)
    const before = capture(indexes)
    indexes.forEach(i => applySnapshot(i, game.value!.bookmark![i]))
    commitAction('RESTORE_BOOKMARK', buildChanges(indexes, before))
    checkCompletion()
    return true
  }

  function discard(persist = true) {
    if (persist) currentGameRepository.clear()
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    storageError.value = ''
    activeDigit.value = null
    game.value = null
    pendingHint.value = null
  }

  return {
    game,
    pendingHint,
    storageError,
    activeDigit,
    chooseDigit,
    checkBoard,
    saveBookmark,
    restoreBookmark,
    completeGame,
    isActive,
    needsSettlement,
    selectedCell,
    startGame,
    restartCurrent,
    restoreGame,
    selectCell,
    toggleNoteMode,
    inputDigit,
    inputNormalDigit,
    inputNoteDigit,
    erase,
    autoCandidates,
    autoCandidatesAll,
    requestHint,
    applyHint,
    undo,
    redo,
    elapsed,
    pause,
    resume,
    flushSave,
    discard
  }
})
