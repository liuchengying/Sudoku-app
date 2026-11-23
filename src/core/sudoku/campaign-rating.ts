import { CHAIN_TECHNIQUES } from './chains'
import { solveCampaignLogically } from './logical'
import { validateBoard } from './validator'
import type { SudokuTechnique } from './types'

export const CAMPAIGN_BANDS = ['naked', 'singles', 'fundamentals', 'patterns', 'one-chain', 'two-chains', 'three-chains', 'multi-chain'] as const
export type CampaignBand = typeof CAMPAIGN_BANDS[number]

interface CampaignRating {
  band: CampaignBand
  difficultyScore: number
  techniques: SudokuTechnique[]
  chainSteps: number
}

export function normalizeCampaignDigits(board: number[]): number[] {
  // Freeze digit order before rating so relabeling a numbered puzzle keeps its reference path.
  const digits = [0, ...new Set(board.filter(Boolean))]
  return board.map(digit => digits.indexOf(digit))
}

export function rateCampaignPuzzle(board: number[]): CampaignRating | null {
  if (!validateBoard(board)) return null
  const result = solveCampaignLogically(normalizeCampaignDigits(board))
  if (!result.solved || !result.valid) return null
  const chainSteps = result.steps.filter(step => CHAIN_TECHNIQUES.some(technique => technique === step.technique)).length
  const aic = result.techniques.includes('AIC')
  let band: CampaignBand
  if (chainSteps >= 4 && aic) band = 'multi-chain'
  else if (chainSteps === 3 && !aic) band = 'three-chains'
  else if (chainSteps === 2 && !aic) band = 'two-chains'
  else if (chainSteps === 1 && !aic) band = 'one-chain'
  else if (chainSteps) return null
  else if (result.techniques.some(technique => technique === 'NAKED_TRIPLE' || technique === 'X_WING' || technique === 'XY_WING')) band = 'patterns'
  else if (result.techniques.some(technique => technique === 'LOCKED_CANDIDATE' || technique === 'NAKED_PAIR' || technique === 'HIDDEN_PAIR')) band = 'fundamentals'
  else band = result.techniques.includes('HIDDEN_SINGLE') ? 'singles' : 'naked'
  return { band, difficultyScore: result.score, techniques: result.techniques, chainSteps }
}
