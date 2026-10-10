import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { useWindowMetrics } from '@/composables/useWindowMetrics'
import { useSafeArea } from '@/composables/useSafeArea'
import { gameWindowLayout, type WindowMetrics } from '@/utils/window-layout'

const lifecycle = vi.hoisted(() => ({ shows: [] as Array<() => void>, resizes: [] as Array<(event: any) => void> }))
vi.mock('@dcloudio/uni-app', () => ({ onShow: (cb: () => void) => lifecycle.shows.push(cb), onResize: (cb: (event: any) => void) => lifecycle.resizes.push(cb) }))

let scopes: EffectScope[]
let listeners: Set<(event: any) => void>
let info: any
beforeEach(() => {
  scopes = []; listeners = new Set(); lifecycle.shows.length = 0; lifecycle.resizes.length = 0
  info = { windowWidth: 352, windowHeight: 780, statusBarHeight: 24, safeAreaInsets: { top: 24, bottom: 16, left: 0, right: 0 } }
  vi.stubGlobal('uni', { getWindowInfo: vi.fn(() => info), getSystemInfoSync: vi.fn(() => info), onWindowResize: vi.fn((cb: (event: any) => void) => listeners.add(cb)), offWindowResize: vi.fn((cb: (event: any) => void) => listeners.delete(cb)) })
})
afterEach(() => { scopes.forEach(scope => scope.stop()); vi.unstubAllGlobals() })
function scoped<T>(fn: () => T) { const scope = effectScope(); scopes.push(scope); return { scope, value: scope.run(fn)! } }

describe('Foldable window metrics and lifetime', () => {
  it('shares one native listener and updates safe areas without remounting consumers', () => {
    const a = scoped(useWindowMetrics), b = scoped(useSafeArea)
    expect(listeners.size).toBe(1)
    expect(b.value.topStyle.value.paddingTop).toBe('24px')
    info = { ...info, statusBarHeight: 32, safeAreaInsets: { top: 32, bottom: 28, left: 10, right: 12 } }
    for (const cb of listeners) cb({ size: { windowWidth: 800, windowHeight: 720 } })
    expect(a.value.metrics).toMatchObject({ width: 800, height: 720, safeLeft: 10, safeRight: 12 })
    expect(b.value.topStyle.value).toEqual({ paddingTop: '32px', paddingLeft: '10px', paddingRight: '12px' })
    expect(b.value.bottomSafeArea.value).toBe(28)
    a.scope.stop(); expect(listeners.size).toBe(1)
    b.scope.stop(); expect(listeners.size).toBe(0)
    expect(uni.offWindowResize).toHaveBeenCalledOnce()
  })

  it('rereads a cached page on show and falls back to system info if window info fails', () => {
    vi.mocked(uni.getWindowInfo).mockImplementation(() => { throw new Error('unsupported') })
    const mounted = scoped(useWindowMetrics)
    expect(mounted.value.metrics.width).toBe(352)
    info = { ...info, windowWidth: 768, windowHeight: 1024, safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 } }
    lifecycle.shows.forEach(cb => cb())
    expect(mounted.value.metrics).toMatchObject({ width: 768, height: 1024, safeBottom: 0 })
  })

  it('uses page resize when the global API is missing and ignores invalid dimensions', () => {
    uni.onWindowResize = undefined as never
    const mounted = scoped(useWindowMetrics)
    lifecycle.resizes.forEach(cb => cb({ size: { windowWidth: 480, windowHeight: 360 } }))
    expect(mounted.value.metrics).toMatchObject({ width: 480, height: 360 })
    info = {}
    lifecycle.resizes.forEach(cb => cb({ size: { windowWidth: NaN, windowHeight: 0 } }))
    expect(mounted.value.metrics).toMatchObject({ width: 480, height: 360 })
  })

  it('releases and reacquires the subscription across repeated screen lifetimes', () => {
    for (let i = 0; i < 20; i++) {
      const mounted = scoped(useWindowMetrics)
      expect(listeners.size).toBe(1)
      mounted.scope.stop(); expect(listeners.size).toBe(0)
    }
    expect(uni.onWindowResize).toHaveBeenCalledTimes(20)
    expect(uni.offWindowResize).toHaveBeenCalledTimes(20)
  })
})

describe('Window-based game layout', () => {
  it.each([
    ['outer screen', 352, 780, false], ['inner portrait', 768, 1024, true],
    ['inner landscape', 1024, 768, true], ['wide fold', 800, 720, true],
    ['split screen', 480, 720, false], ['short split screen', 480, 360, false],
    ['wide short window', 900, 280, false]
  ])('%s keeps a square board within its actual available pane', (_name, width, height, split) => {
    const metrics: WindowMetrics = { width: Number(width), height: Number(height), statusBarHeight: 24, safeTop: 24, safeBottom: 16, safeLeft: 0, safeRight: 0 }
    const layout = gameWindowLayout(metrics)
    expect(layout.split).toBe(split)
    expect(layout.boardSize).toBeGreaterThanOrEqual(300)
    expect(layout.boardSize + layout.controlsWidth + (split ? 24 : 0) + 24).toBeLessThanOrEqual(Number(width))
    if (split) expect(layout.controlsWidth).toBeGreaterThanOrEqual(240)
  })

  it('uses safe regions and does not assume a device-wide inner screen', () => {
    const metrics: WindowMetrics = { width: 660, height: 720, statusBarHeight: 24, safeTop: 24, safeBottom: 16, safeLeft: 20, safeRight: 20 }
    expect(gameWindowLayout(metrics).split).toBe(false)
    expect(gameWindowLayout(metrics).boardSize).toBeLessThanOrEqual(620 - 24)
  })

  it('reduces the board in a wide short or keyboard-resized window while retaining readable cells', () => {
    const metrics: WindowMetrics = { width: 900, height: 900, statusBarHeight: 24, safeTop: 24, safeBottom: 16, safeLeft: 0, safeRight: 0 }
    const tall = gameWindowLayout(metrics)
    const short = gameWindowLayout({ ...metrics, height: 400 })
    const keyboard = gameWindowLayout({ ...metrics, height: 280 })
    expect(short.split).toBe(true)
    expect(short.boardSize).toBeLessThan(tall.boardSize)
    expect(short.boardSize).toBeGreaterThanOrEqual(300)
    expect(short.boardSize).toBeLessThanOrEqual(320)
    expect(keyboard.split).toBe(false)
    expect(keyboard.boardSize).toBeLessThanOrEqual(320)
  })
})
