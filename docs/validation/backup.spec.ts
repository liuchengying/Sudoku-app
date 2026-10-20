import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LEVELS } from '@/assets/puzzles'
import { useGameStore } from '@/stores/game.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useProgressStore } from '@/stores/progress.store'
import { useHistoryStore } from '@/stores/history.store'
import { resultsRepository, RESULTS_KEY } from '@/repositories/results.repository'
import { currentGameRepository, CURRENT_GAME_KEY } from '@/repositories/current-game.repository'
import { settingsRepository, SETTINGS_KEY } from '@/repositories/settings.repository'
import { readEnvelope } from '@/repositories/storage'
import { applyBackup, BACKUP_KIND, BACKUP_VERSION, buildBackupPayload, parseBackup, summarizeBackup, type BackupPayload } from '@/services/backup.service'

const storage = new Map<string, string>()

function makeUni(overrides: Record<string, unknown> = {}) {
  return {
    getStorageSync: (key: string) => storage.get(key) ?? '',
    setStorageSync: (key: string, value: string) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    redirectTo: vi.fn(),
    navigateTo: vi.fn(),
    reLaunch: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
    vibrateShort: vi.fn(),
    vibrateLong: vi.fn(),
    ...overrides
  }
}

beforeEach(() => {
  storage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(100000)
  vi.stubGlobal('uni', makeUni())
  setActivePinia(createPinia())
  const settings = useSettingsStore()
  settings.settings.sound = false
  settings.settings.haptics = false
})

function handcraftedResults() {
  const level = LEVELS[0]
  const progressEntry = {
    levelId: level.id, difficultyId: level.difficultyId, levelNo: 1, completed: true, baseScore: 2000, bestMedal: 'GOLD',
    bestTime: 60000, minMistakes: 0, minHints: 0, completionCount: 1, firstCompletedAt: 100000, lastCompletedAt: 100000
  }
  const record = {
    id: 'record-handcrafted', levelId: level.id, difficultyId: level.difficultyId, levelNo: 1, mode: 'CAMPAIGN',
    puzzle: level.puzzle, solution: level.solution,
    finalValues: [...level.solution].map(Number),
    origins: [...level.puzzle].map((v) => (Number(v) ? 'GIVEN' : 'USER')),
    elapsedTime: 60000, mistakeCount: 0, hintCount: 0, baseScore: 2000, scoreAwarded: 2000,
    medal: 'GOLD', startedAt: 40000, completedAt: 100000, actions: [], timeline: []
  }
  return { progress: { [level.id]: progressEntry }, history: [record], dailyDates: ['2026-10-19'], serial: 1 }
}

function handcraftedPayload(data: Record<string, unknown>) {
  return { kind: BACKUP_KIND, backupVersion: BACKUP_VERSION, exportedAt: '2026-10-20T00:00:00.000Z', data }
}

describe('Backup envelope helpers', () => {
  it('wraps legacy unwrapped payloads with version 0 and rejects unreadable values', () => {
    storage.set(SETTINGS_KEY, JSON.stringify({ version: 2, data: { theme: 'dark' } }))
    expect(readEnvelope(SETTINGS_KEY)).toEqual({ version: 2, data: { theme: 'dark' } })

    storage.set(SETTINGS_KEY, JSON.stringify({ legacy: true }))
    expect(readEnvelope(SETTINGS_KEY)).toEqual({ version: 0, data: { legacy: true } })

    storage.set(SETTINGS_KEY, '{broken')
    expect(readEnvelope(SETTINGS_KEY)).toBeNull()
    expect(readEnvelope('sudoku:missing')).toBeNull()
  })
})

describe('Backup export and restore round-trip', () => {
  it('keeps progress, history, totals and settings identical through export, wipe and restore', () => {
    const store = useGameStore()
    store.startGame(LEVELS[0])
    for (let i = 0; i < 81; i++) {
      const cell = store.game!.cells[i]
      if (cell.origin === 'GIVEN') continue
      store.game!.selectedIndex = i
      store.inputNormalDigit(cell.solution)
    }
    expect(store.game!.status).toBe('COMPLETED')
    store.discard(false)
    useSettingsStore().setSetting('theme', 'dark')

    const text = JSON.stringify(buildBackupPayload())
    const summary = summarizeBackup(JSON.parse(text) as BackupPayload)
    expect(summary.historyCount).toBe(1)
    expect(summary.progressCount).toBe(1)
    expect(summary.hasCurrentGame).toBe(false)

    // Move the live device away from the backed-up state to prove restore overwrites it.
    useSettingsStore().setSetting('theme', 'light')
    storage.clear()
    applyBackup(parseBackup(text))
    useProgressStore().reload()
    useHistoryStore().refresh()
    useSettingsStore().reload()

    expect(useProgressStore().get(LEVELS[0].id)?.completed).toBe(true)
    expect(useHistoryStore().records.length).toBe(1)
    expect(resultsRepository.load().totals.totalCompletions).toBe(1)
    expect(useSettingsStore().settings.theme).toBe('dark')
  })

  it('restores an unfinished paused board with notes after a wipe', () => {
    const store = useGameStore()
    store.startGame(LEVELS[0])
    const index = store.game!.selectedIndex!
    store.inputNoteDigit(store.game!.cells[index].solution)
    store.pause()

    const text = JSON.stringify(buildBackupPayload())
    expect(summarizeBackup(JSON.parse(text) as BackupPayload).hasCurrentGame).toBe(true)

    storage.clear()
    useGameStore().discard(false)
    applyBackup(parseBackup(text))
    const restored = useGameStore()
    expect(restored.restoreGame()).toBe(true)
    expect(restored.game!.status).toBe('PAUSED')
    expect(restored.game!.cells[index].notesMask).not.toBe(0)
  })

  it('wraps legacy unwrapped settings so they survive a round-trip', () => {
    storage.set(SETTINGS_KEY, JSON.stringify({ theme: 'dark', sound: false }))
    const text = JSON.stringify(buildBackupPayload())
    expect(JSON.parse(text).data[SETTINGS_KEY]).toEqual({ version: 0, data: { theme: 'dark', sound: false } })

    storage.clear()
    applyBackup(parseBackup(text))
    const settings = settingsRepository.load()
    expect(settings.theme).toBe('dark')
    expect(settings.sound).toBe(false)
  })
})

describe('Snapshot restore semantics', () => {
  it('overwrites present keys and removes keys missing from the backup', () => {
    const store = useGameStore()
    store.startGame(LEVELS[0])
    store.pause()
    settingsRepository.save({ ...useSettingsStore().settings, theme: 'dark' })
    expect(storage.has(CURRENT_GAME_KEY)).toBe(true)

    const payload = handcraftedPayload({ [RESULTS_KEY]: { version: 2, data: handcraftedResults() } })
    applyBackup(parseBackup(JSON.stringify(payload)))

    expect(storage.has(CURRENT_GAME_KEY)).toBe(false)
    expect(storage.has(SETTINGS_KEY)).toBe(false)
    useSettingsStore().reload()
    useProgressStore().reload()
    useHistoryStore().refresh()
    expect(useProgressStore().get(LEVELS[0].id)?.completed).toBe(true)
    expect(useHistoryStore().records.length).toBe(1)
    expect(resultsRepository.load().dailyDates).toEqual(['2026-10-19'])
    useGameStore().discard(false)
    expect(useGameStore().restoreGame()).toBe(false)
  })

  it('treats a null current game in the backup as an absent game', () => {
    const store = useGameStore()
    store.startGame(LEVELS[0])
    store.pause()

    const payload = handcraftedPayload({ [CURRENT_GAME_KEY]: { version: 2, data: null } })
    applyBackup(parseBackup(JSON.stringify(payload)))
    expect(storage.has(CURRENT_GAME_KEY)).toBe(false)
  })
})

describe('Backup validation rejects corrupt payloads', () => {
  it('rejects each corruption case without touching local data', () => {
    settingsRepository.save({ ...useSettingsStore().settings, theme: 'dark' })
    const before = JSON.stringify([...storage.entries()])

    const brokenHistory = handcraftedResults()
    brokenHistory.history = [{ id: 'not-a-record' } as never]
    const brokenProgress = handcraftedResults()
    ;(brokenProgress.progress as Record<string, unknown>).bad = {}

    const cases: Array<[string, string]> = [
      ['not-json', 'not json{'],
      ['missing-kind', JSON.stringify({ backupVersion: BACKUP_VERSION, data: {} })],
      ['wrong-kind', JSON.stringify(handcraftedPayload({}) as unknown as Record<string, unknown>).replace(BACKUP_KIND, 'other-kind')],
      ['wrong-version', JSON.stringify({ kind: BACKUP_KIND, backupVersion: 99, data: {} })],
      ['missing-data', JSON.stringify({ kind: BACKUP_KIND, backupVersion: BACKUP_VERSION })],
      ['empty-data', JSON.stringify(handcraftedPayload({}))],
      ['history-incomplete', JSON.stringify(handcraftedPayload({ [RESULTS_KEY]: { version: 2, data: brokenHistory } }))],
      ['progress-incomplete', JSON.stringify(handcraftedPayload({ [RESULTS_KEY]: { version: 2, data: brokenProgress } }))],
      ['missing-daily-dates', JSON.stringify(handcraftedPayload({ [RESULTS_KEY]: { version: 2, data: { ...handcraftedResults(), dailyDates: 'nope' } } }))],
      ['broken-current-game', JSON.stringify(handcraftedPayload({ [CURRENT_GAME_KEY]: { version: 2, data: { id: 'nope' } } }))],
      ['broken-settings', JSON.stringify(handcraftedPayload({ [SETTINGS_KEY]: { version: 2, data: 'nope' } }))],
      ['non-object-envelope', JSON.stringify(handcraftedPayload({ [SETTINGS_KEY]: 'nope' }))]
    ]
    for (const [name, text] of cases) {
      expect(() => parseBackup(text), name).toThrow()
    }
    expect(JSON.stringify([...storage.entries()])).toBe(before)
  })

  it('reports a storage failure during restore instead of failing silently', () => {
    const payload = handcraftedPayload({ [SETTINGS_KEY]: { version: 2, data: { theme: 'dark' } } })
    const parsed = parseBackup(JSON.stringify(payload))
    vi.stubGlobal('uni', makeUni({ setStorageSync: () => { throw new Error('storage full') } }))
    expect(() => applyBackup(parsed)).toThrow('恢复未完成')
  })

  it('round-trips through currentGameRepository and resultsRepository accessors', () => {
    const payload = handcraftedPayload({ [RESULTS_KEY]: { version: 2, data: handcraftedResults() } })
    applyBackup(parseBackup(JSON.stringify(payload)))
    expect(resultsRepository.load().serial).toBe(1)
    expect(currentGameRepository.load()).toBeNull()
  })
})
