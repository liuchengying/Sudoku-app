import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings'
import { readStorage, writeStorage } from './storage'

const KEY = 'sudoku:v1:settings'

export const settingsRepository = {
  load(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...readStorage<Partial<AppSettings>>(KEY, {}) }
  },
  save(settings: AppSettings): void {
    writeStorage(KEY, settings)
  },
  reset(): AppSettings {
    writeStorage(KEY, DEFAULT_SETTINGS)
    return { ...DEFAULT_SETTINGS }
  }
}
