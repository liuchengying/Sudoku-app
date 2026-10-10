import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useWindowMetrics } from './useWindowMetrics'
export function useAppearance() {
  const store = useSettingsStore()
  const { metrics } = useWindowMetrics()
  const appearance = computed(() => ({
    'theme-dark': store.settings.theme === 'dark',
    'board-green': store.settings.boardColor === 'green',
    'large-digits': store.settings.largeDigits,
    'wide-window': metrics.width - metrics.safeLeft - metrics.safeRight >= 640
  }))
  const pageStyle = computed(() => ({
    '--safe-top': `${Math.max(metrics.statusBarHeight, metrics.safeTop)}px`,
    '--safe-bottom': `${metrics.safeBottom}px`,
    '--safe-left': `${metrics.safeLeft}px`,
    '--safe-right': `${metrics.safeRight}px`
  }))
  return { appearance, pageStyle }
}
