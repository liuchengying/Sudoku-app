import { computed } from 'vue'

export function useSafeArea() {
  let statusBarHeight = 0
  let bottom = 0
  try {
    const info = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()
    statusBarHeight = Number(info.statusBarHeight ?? 0)
    const safeBottom = info.safeAreaInsets?.bottom
    bottom = typeof safeBottom === 'number' ? safeBottom : 0
  } catch {
    // H5 / test environments may not expose window metrics.
  }
  return {
    statusBarHeight,
    bottomSafeArea: bottom,
    topStyle: computed(() => ({ paddingTop: `${statusBarHeight}px` }))
  }
}
