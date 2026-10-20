import { object } from '@/repositories/validation'
import { readEnvelope, removeStorage, writeEnvelope, type StorageEnvelope } from '@/repositories/storage'
import { normalizeProgress, normalizeRecords, RESULTS_KEY } from '@/repositories/results.repository'
import { CURRENT_GAME_KEY, normalizeCurrentGame } from '@/repositories/current-game.repository'
import { SETTINGS_KEY } from '@/repositories/settings.repository'

// A backup only carries irreplaceable data: practice and campaign caches are
// regenerable by level id / generation seed, so they are intentionally excluded.
export const BACKUP_KIND = 'sudoku-backup'
export const BACKUP_VERSION = 1
export const BACKUP_KEYS = [CURRENT_GAME_KEY, RESULTS_KEY, SETTINGS_KEY] as const
export type BackupKey = (typeof BACKUP_KEYS)[number]

export interface BackupPayload {
  kind: typeof BACKUP_KIND
  backupVersion: typeof BACKUP_VERSION
  exportedAt: string
  data: Partial<Record<BackupKey, StorageEnvelope<unknown>>>
}

export interface BackupSummary {
  exportedAt: string
  historyCount: number
  progressCount: number
  hasCurrentGame: boolean
  characters: number
}

const KEY_LABELS: Record<BackupKey, string> = {
  [CURRENT_GAME_KEY]: '未完成对局',
  [RESULTS_KEY]: '成绩与历史',
  [SETTINGS_KEY]: '设置'
}

export function buildBackupPayload(): BackupPayload {
  const data: BackupPayload['data'] = {}
  for (const key of BACKUP_KEYS) {
    // An unreadable local value is unreadable to the app as well; excluding it beats failing the whole export.
    const envelope = readEnvelope<unknown>(key)
    if (envelope) data[key] = envelope
  }
  return { kind: BACKUP_KIND, backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

export function summarizeBackup(payload: BackupPayload): BackupSummary {
  const results = payload.data[RESULTS_KEY]?.data
  const history = results && object(results) && Array.isArray(results.history) ? results.history : []
  const progress = results && object(results) && object(results.progress) ? Object.keys(results.progress).length : 0
  return {
    exportedAt: payload.exportedAt,
    historyCount: history.length,
    progressCount: progress,
    hasCurrentGame: Boolean(payload.data[CURRENT_GAME_KEY]?.data),
    characters: JSON.stringify(payload).length
  }
}

function asEnvelope(raw: unknown, key: BackupKey): StorageEnvelope<unknown> {
  if (!object(raw) || typeof raw.version !== 'number' || !('data' in raw)) {
    throw new Error(`备份中的${KEY_LABELS[key]}数据结构无效`)
  }
  return { version: raw.version, data: raw.data }
}

export function parseBackup(text: string): BackupPayload {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('无法解析备份内容，请确认复制了完整的备份文本')
  }
  if (!object(raw) || raw.kind !== BACKUP_KIND) throw new Error('不是数独备份内容（缺少备份标识）')
  if (raw.backupVersion !== BACKUP_VERSION) throw new Error('备份版本不受支持，请先更新应用再导入')
  const backupData = object(raw.data) ? raw.data : null
  if (!backupData) throw new Error('备份数据缺失或损坏')
  if (!BACKUP_KEYS.some((key) => key in backupData)) throw new Error('备份缺少本机数据，无法恢复')

  const data: BackupPayload['data'] = {}
  for (const key of BACKUP_KEYS) {
    if (!(key in backupData)) continue
    const envelope = asEnvelope(backupData[key], key)
    if (key === CURRENT_GAME_KEY) {
      if (envelope.data !== null && !normalizeCurrentGame(envelope.data)) throw new Error('备份中的未完成对局数据无效')
    } else if (key === RESULTS_KEY) {
      if (!object(envelope.data)) throw new Error('备份中的成绩与历史数据无效')
      const history = envelope.data.history
      if (!Array.isArray(history) || normalizeRecords(history).length !== history.length) throw new Error('备份中的历史记录不完整，无法恢复')
      const progress = envelope.data.progress
      if (!object(progress) || Object.keys(normalizeProgress(progress)).length !== Object.keys(progress).length) throw new Error('备份中的关卡进度不完整，无法恢复')
      if (!Array.isArray(envelope.data.dailyDates)) throw new Error('备份中的每日完成记录无效')
    } else if (!object(envelope.data)) {
      throw new Error('备份中的设置数据无效')
    }
    data[key] = envelope
  }
  return { kind: BACKUP_KIND, backupVersion: BACKUP_VERSION, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '', data }
}

export function applyBackup(payload: BackupPayload): void {
  for (const key of BACKUP_KEYS) {
    const envelope = payload.data[key]
    try {
      if (envelope && envelope.data != null) writeEnvelope(key, envelope)
      else removeStorage(key)
    } catch {
      throw new Error('恢复未完成：设备存储写入失败，请释放空间后重试')
    }
  }
}
