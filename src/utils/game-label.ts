import { getDifficulty } from '@/config/difficulty'
import { MODE_NAMES, tierName } from '@/config/practice'
import { CAMPAIGN_GENERATOR_VERSION, parseCampaignId } from '@/config/campaign'
import type { GameMode, GameState, PuzzleTier } from '@/core/sudoku'
import type { GameRecord } from '@/types/progress'
export function difficultyName(id: string): string {
  if (['master', 'king', 'grandmaster'].includes(id)) return getDifficulty(id).name
  return tierName(id as PuzzleTier)
}
export function recordTitle(record: Pick<GameRecord, 'difficultyId' | 'levelId' | 'levelNo' | 'mode' | 'dailyDate'>): string {
  const mode = record.mode ?? 'CAMPAIGN'
  if (mode === 'CAMPAIGN') {
    const edition = parseCampaignId(record.levelId)?.version === CAMPAIGN_GENERATOR_VERSION ? ' · 新版' : ''
    return `${difficultyName(record.difficultyId)} · 第 ${record.levelNo} 关${edition}`
  }
  return `${MODE_NAMES[mode]} · ${mode === 'DAILY' ? record.dailyDate : difficultyName(record.difficultyId)}`
}
export function gameTitle(game: GameState): string {
  return recordTitle({ ...game, levelNo: game.level?.levelNo ?? (Number(game.levelId.split('-').pop()) || 0) })
}
