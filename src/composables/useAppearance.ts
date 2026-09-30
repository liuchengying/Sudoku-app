import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings.store'
export function useAppearance() {
  const store = useSettingsStore()
  return computed(() => ({ 'theme-dark': store.settings.theme === 'dark', 'large-digits': store.settings.largeDigits }))
}
