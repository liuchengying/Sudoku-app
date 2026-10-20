export interface StorageEnvelope<T> {
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

export function readEnvelope<T>(key: string): StorageEnvelope<T> | null {
  try {
    const raw = uni.getStorageSync(key)
    if (raw === '' || raw == null) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && 'data' in parsed && typeof (parsed as { version?: unknown }).version === 'number') {
      return parsed as StorageEnvelope<T>
    }
    // Legacy v0 payloads were stored without an envelope; wrap them so a backup round-trips.
    return { version: 0, data: parsed as T }
  } catch {
    return null
  }
}

export function writeEnvelope<T>(key: string, envelope: StorageEnvelope<T>): void {
  uni.setStorageSync(key, JSON.stringify(envelope))
}

export function writeStorage<T>(key: string, data: T): void {
  writeEnvelope(key, { version: STORAGE_VERSION, data })
}

export function removeStorage(key: string): void {
  try {
    uni.removeStorageSync(key)
  } catch {
    // Storage cleanup is best-effort.
  }
}
