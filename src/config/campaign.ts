import { DIFFICULTIES } from './difficulty'
import type { PuzzleTier, SudokuLevel } from '@/core/sudoku'
import type { LevelProgress } from '@/types/progress'

export const CAMPAIGN_GENERATOR_VERSION = 1
export const CAMPAIGN_PAGE_SIZE = 25
export const LEGACY_LEVEL_COUNT = 25
export type CampaignSlot = Pick<SudokuLevel, 'id' | 'difficultyId' | 'levelNo'>
export interface CampaignProfile {
  stage: number
  tier: PuzzleTier
  minScore: number
  maxScore: number
  clues: number
  label: string
  plateau: boolean
}

// The intervals do not overlap: advancing a stage raises the measured difficulty.
// A finite 9×9 board has a difficulty ceiling; the last stage supplies new expert puzzles.
const STAGES = [
  { tier: 'easy', minScore: 83, maxScore: 94, clues: 28, label: '基础巩固' },
  { tier: 'easy', minScore: 95, maxScore: 109, clues: 26, label: '基础强化' },
  { tier: 'advanced', minScore: 110, maxScore: 129, clues: 26, label: '进阶逻辑' },
  { tier: 'advanced', minScore: 130, maxScore: 249, clues: 24, label: '进阶强化' },
  { tier: 'expert', minScore: 250, maxScore: 329, clues: 26, label: '专家挑战' },
  { tier: 'expert', minScore: 330, maxScore: 399, clues: 25, label: '专家强化' },
  { tier: 'expert', minScore: 400, maxScore: Infinity, clues: 24, label: '专家持续挑战' }
] satisfies Omit<CampaignProfile, 'stage' | 'plateau'>[]
const START_STAGE: Record<string, number> = { master: 0, king: 2, grandmaster: 4 }

export function campaignSlot(difficultyId: string, levelNo: number): CampaignSlot {
  if (!DIFFICULTIES.some(d => d.id === difficultyId) || !Number.isSafeInteger(levelNo) || levelNo < 1) throw new Error('请选择有效关卡')
  return { id: `${difficultyId}-${String(levelNo).padStart(3, '0')}`, difficultyId, levelNo }
}
export function parseCampaignId(id: string): CampaignSlot | undefined {
  const match = /^(master|king|grandmaster)-(\d+)$/.exec(id)
  if (!match) return undefined
  const levelNo = Number(match[2])
  if (!Number.isSafeInteger(levelNo) || levelNo < 1) return undefined
  const slot = campaignSlot(match[1], levelNo)
  return slot.id === id ? slot : undefined
}
export function nextCampaignSlot(id: string): CampaignSlot | undefined {
  const current = parseCampaignId(id)
  return current && current.levelNo < Number.MAX_SAFE_INTEGER ? campaignSlot(current.difficultyId, current.levelNo + 1) : undefined
}
export function campaignPage(difficultyId: string, page: number): CampaignSlot[] {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error('请选择有效页码')
  const first = page * CAMPAIGN_PAGE_SIZE + 1
  campaignSlot(difficultyId, first + CAMPAIGN_PAGE_SIZE - 1)
  return Array.from({ length: CAMPAIGN_PAGE_SIZE }, (_, i) => campaignSlot(difficultyId, first + i))
}
export function campaignProfile(difficultyId: string, levelNo: number): CampaignProfile | null {
  campaignSlot(difficultyId, levelNo)
  if (levelNo <= LEGACY_LEVEL_COUNT) return null
  const index = Math.min(STAGES.length - 1, START_STAGE[difficultyId] + Math.floor((levelNo - LEGACY_LEVEL_COUNT - 1) / CAMPAIGN_PAGE_SIZE))
  return { ...STAGES[index], stage: Math.floor((levelNo - 1) / CAMPAIGN_PAGE_SIZE) + 1, plateau: index === STAGES.length - 1 }
}
export function matchesCampaignProfile(level: SudokuLevel): boolean {
  const profile = campaignProfile(level.difficultyId, level.levelNo)
  return !!profile && level.tier === profile.tier && level.difficultyScore >= profile.minScore && level.difficultyScore <= profile.maxScore
}
export function suggestedCampaignLevel(difficultyId: string, progress: Record<string, LevelProgress>): number {
  const completed = new Set(Object.values(progress).filter(p => p.completed && p.difficultyId === difficultyId).map(p => parseCampaignId(p.levelId)).filter((slot): slot is CampaignSlot => slot?.difficultyId === difficultyId).map(slot => slot.levelNo))
  let levelNo = 1
  while (completed.has(levelNo)) levelNo++
  return levelNo
}
