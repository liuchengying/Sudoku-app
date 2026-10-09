import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings'
import { readStorage, writeStorage } from './storage'
import { object } from './validation'

const KEY = 'sudoku:v1:settings'

export const settingsRepository = {
  load(): AppSettings {
    const raw = readStorage<unknown>(KEY, {})
    const settings = { ...DEFAULT_SETTINGS }
    if (!object(raw)) return settings
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
      const v = raw[key]
      if (typeof DEFAULT_SETTINGS[key] === 'boolean' && typeof v === 'boolean') (settings as unknown as Record<string, unknown>)[key] = v
    }
    if (raw.theme === 'light' || raw.theme === 'dark') settings.theme = raw.theme
    if (raw.boardColor === 'blue' || raw.boardColor === 'green') settings.boardColor = raw.boardColor
    if (raw.inputStyle === 'cell-first' || raw.inputStyle === 'number-first') settings.inputStyle = raw.inputStyle
    return settings
  },
  save(settings: AppSettings): void {
    writeStorage(KEY, settings)
  },
  reset(): AppSettings {
    // Onboarding completion is a lifecycle marker, rather than a preference.
    const settings = { ...DEFAULT_SETTINGS, onboardingSeen: settingsRepository.load().onboardingSeen }
    writeStorage(KEY, settings)
    return settings
  }
}
