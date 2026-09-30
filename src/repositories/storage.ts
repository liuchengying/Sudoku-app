interface StorageEnvelope<T> {
  version: number
  data: T
}

const STORAGE_VERSION = 2

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = uni.getStorageSync(key)
    if (raw === '' || raw == null) return fallback
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return (parsed as StorageEnvelope<T>).data
    }
    // Legacy v0 payloads may have been stored without an envelope.
    return parsed as T
  } catch {
    return fallback
  }
}

export function writeStorage<T>(key: string, data: T): void {
  const envelope: StorageEnvelope<T> = { version: STORAGE_VERSION, data }
  uni.setStorageSync(key, JSON.stringify(envelope))
}

export function removeStorage(key: string): void {
  try {
    uni.removeStorageSync(key)
  } catch {
    // Storage cleanup is best-effort.
  }
}
