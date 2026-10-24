export interface WindowMetrics {
  width: number
  height: number
  statusBarHeight: number
  safeTop: number
  safeBottom: number
  safeLeft: number
  safeRight: number
}

export interface GameWindowLayout {
  split: boolean
  boardSize: number
  controlsWidth: number
  rail: boolean
}

// These are CSS/uni window pixels, not physical screen pixels or native dp.
// Device viewports vary a lot (a foldable inner screen may report ~740-850px
// CSS width), so the split arrangement is chosen adaptively instead of by
// absolute size thresholds: whichever form yields the larger board wins.
export function gameWindowLayout(window: WindowMetrics): GameWindowLayout {
  const width = Math.max(0, window.width - window.safeLeft - window.safeRight)
  const height = Math.max(0, window.height - Math.max(window.statusBarHeight, window.safeTop) - window.safeBottom)
  const split = width >= 640 && height >= 320
  if (!split) {
    const heightLimit = Math.max(306, height - 168)
    const boardSize = Math.floor(Math.min(Math.max(0, Math.min(width, 1200) - 24), heightLimit, 520))
    return { split, boardSize, controlsWidth: 0, rail: false }
  }
  // Two-column form: a control column next to the board, digits under the board.
  const controls = Math.min(300, Math.max(232, width * .28))
  const twoColBoard = Math.min(
    Math.max(0, Math.min(width, 1200) - 24 - controls - 32),
    Math.max(306, height - 168),
    840
  )
  // Rail form: a slim toolbar pinned to the right edge and one bottom row of
  // digits — spends 76px of width and 72px of extra height reserve.
  const railWidth = 76
  const railBoard = Math.min(
    Math.max(0, width - 24 - railWidth - 28),
    Math.max(306, height - 240),
    1024
  )
  if (railBoard > twoColBoard) {
    return { split, boardSize: Math.floor(railBoard), controlsWidth: railWidth, rail: true }
  }
  return { split, boardSize: Math.floor(twoColBoard), controlsWidth: Math.round(controls), rail: false }
}
