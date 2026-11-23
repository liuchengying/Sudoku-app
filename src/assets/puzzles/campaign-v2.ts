import { CAMPAIGN_PAGE_SIZE, ladderProfile, type CampaignSlot } from '@/config/campaign'
import type { CampaignBand, SudokuLevel } from '@/core/sudoku'
import { seedFromText } from '@/utils/id'
import bank from './campaign-v2.json'

type CampaignSeed = Pick<SudokuLevel, 'puzzle' | 'solution' | 'difficultyScore' | 'techniques'> & { chainSteps: number }
export const CAMPAIGN_V2_BANK = bank as Record<CampaignBand, CampaignSeed[]>

export function campaignV2Level(slot: CampaignSlot): SudokuLevel {
  const profile = ladderProfile(slot)
  const pool = CAMPAIGN_V2_BANK[profile.band]
  // When two tracks share a band, their first pages draw from different templates.
  const offset = slot.difficultyId === 'king' ? CAMPAIGN_PAGE_SIZE : 0
  const ordinal = slot.levelNo - profile.from
  const rotation = Math.floor(ordinal / pool.length) % pool.length
  const template = pool[(ordinal % pool.length + offset + rotation) % pool.length]
  const seed = seedFromText(`sudoku-campaign-v2:${slot.id}`)
  let random = seed
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  // Digit relabeling keeps the normalized rating and preserves the unique solution.
  for (let i = 9; i > 1; i--) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0
    const j = 1 + Math.floor(random / 4294967296 * i)
    const digit = digits[i]
    digits[i] = digits[j]
    digits[j] = digit
  }
  const relabel = (board: string) => Array.from(board, digit => digits[Number(digit)]).join('')
  return {
    ...slot,
    seed,
    tier: profile.tier,
    puzzle: relabel(template.puzzle),
    solution: relabel(template.solution),
    clueCount: template.puzzle.replace(/0/g, '').length,
    difficultyScore: template.difficultyScore,
    techniques: [...template.techniques],
    chainSteps: template.chainSteps
  }
}
