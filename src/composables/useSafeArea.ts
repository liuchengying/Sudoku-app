import { computed } from 'vue'
import { useWindowMetrics } from './useWindowMetrics'

export function useSafeArea() {
  const { metrics } = useWindowMetrics()
  return {
    statusBarHeight: computed(() => Math.max(metrics.statusBarHeight, metrics.safeTop)),
    bottomSafeArea: computed(() => metrics.safeBottom),
    topStyle: computed(() => ({ paddingTop: `${Math.max(metrics.statusBarHeight, metrics.safeTop)}px`, paddingLeft: `${metrics.safeLeft}px`, paddingRight: `${metrics.safeRight}px` }))
  }
}
