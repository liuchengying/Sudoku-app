import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings.store'
export function useAppearance() {
  const store = useSettingsStore()
  return computed(() => ({
    'theme-dark': store.settings.theme === 'dark',
    'board-green': store.settings.boardColor === 'green',
    'large-digits': store.settings.largeDigits
  }))
}
