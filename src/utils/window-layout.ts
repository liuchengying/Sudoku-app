export interface WindowMetrics {
  width: number
  height: number
  statusBarHeight: number
  safeTop: number
  safeBottom: number
  safeLeft: number
  safeRight: number
}

// These are CSS/uni window pixels, not physical screen pixels or native dp.
export function gameWindowLayout(window: WindowMetrics) {
  const width = Math.max(0, window.width - window.safeLeft - window.safeRight)
  const height = Math.max(0, window.height - Math.max(window.statusBarHeight, window.safeTop) - window.safeBottom)
  const split = width >= 640 && height >= 320
  const controls = split ? Math.min(320, Math.max(240, width * .32)) : 0
  const available = Math.max(0, Math.min(width, 1120) - 24 - (split ? controls + 24 : 0))
  // A short viewport scrolls instead of forcing an unreadable 9×9 grid.
  // Reserve room for the stable header/context block. Extra notices or large
  // system text can still grow the page; keep a readable minimum and scroll.
  const heightLimit = Math.max(306, height - 168)
  const boardSize = Math.floor(Math.min(available, heightLimit, split ? 600 : 520))
  return { split, boardSize, controlsWidth: controls }
}
