type SoundName = 'tap' | 'error' | 'success'

const SOURCES: Record<SoundName, string> = {
  tap: '/static/sounds/tap.wav',
  error: '/static/sounds/error.wav',
  success: '/static/sounds/success.wav'
}

type InnerAudio = ReturnType<typeof uni.createInnerAudioContext>

const contexts = new Map<SoundName, InnerAudio>()

function getContext(name: SoundName): InnerAudio | null {
  try {
    let context = contexts.get(name)
    if (!context) {
      context = uni.createInnerAudioContext()
      context.autoplay = false
      context.volume = 0.7
      context.src = SOURCES[name]
      contexts.set(name, context)
    }
    return context
  } catch {
    return null
  }
}

export const audioService = {
  play(name: SoundName, enabled = true): void {
    if (!enabled) return
    const context = getContext(name)
    if (!context) return
    try {
      context.stop()
      context.seek(0)
      context.play()
    } catch {
      // Audio is a non-critical enhancement on unsupported targets.
    }
  },
  dispose(): void {
    for (const context of contexts.values()) {
      try { context.destroy() } catch { /* noop */ }
    }
    contexts.clear()
  }
}
