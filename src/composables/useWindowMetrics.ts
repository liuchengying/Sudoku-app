import { computed, onScopeDispose, reactive, readonly } from 'vue'
import { onResize, onShow } from '@dcloudio/uni-app'
import type { WindowMetrics } from '@/utils/window-layout'

const metrics = reactive<WindowMetrics>({ width: 375, height: 667, statusBarHeight: 0, safeTop: 0, safeBottom: 0, safeLeft: 0, safeRight: 0 })
let users = 0
let listening = false

function nonnegative(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

export function refreshWindowMetrics(size?: { windowWidth?: number; windowHeight?: number }) {
  let info: Partial<UniNamespace.GetWindowInfoResult> = {}
  try { info = uni.getWindowInfo() } catch {
    try { info = uni.getSystemInfoSync() } catch { /* Keep the last usable metrics. */ }
  }
  const width = nonnegative(size?.windowWidth, nonnegative(info.windowWidth, metrics.width))
  const height = nonnegative(size?.windowHeight, nonnegative(info.windowHeight, metrics.height))
  if (width > 0) metrics.width = width
  if (height > 0) metrics.height = height
  metrics.statusBarHeight = nonnegative(info.statusBarHeight, metrics.statusBarHeight)
  const safe = info.safeAreaInsets
  metrics.safeTop = nonnegative(safe?.top, Math.max(metrics.safeTop, metrics.statusBarHeight))
  metrics.safeBottom = nonnegative(safe?.bottom, metrics.safeBottom)
  metrics.safeLeft = nonnegative(safe?.left, metrics.safeLeft)
  metrics.safeRight = nonnegative(safe?.right, metrics.safeRight)
}

const resize = (event: UniNamespace.WindowResizeResult) => refreshWindowMetrics(event.size)

export function useWindowMetrics() {
  refreshWindowMetrics()
  users++
  if (!listening && typeof uni.onWindowResize === 'function' && typeof uni.offWindowResize === 'function') {
    try { uni.onWindowResize(resize); listening = true } catch { /* Page onResize remains available. */ }
  }
  // Components can use the page hook too; refreshed on return from cached pages.
  onShow(() => refreshWindowMetrics())
  onResize(event => refreshWindowMetrics(event.size))
  onScopeDispose(() => {
    users--
    if (users === 0 && listening) {
      try { uni.offWindowResize?.(resize) } catch { /* Best-effort on older runtimes. */ }
      listening = false
    }
  })
  return { metrics: readonly(metrics), refresh: refreshWindowMetrics,
    safeStyle: computed(() => ({ paddingLeft: `${metrics.safeLeft}px`, paddingRight: `${metrics.safeRight}px` })) }
}
