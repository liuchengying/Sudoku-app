import type { DifficultyResult, PuzzleTier } from '@/core/sudoku'

export const PRACTICE_TIERS: { id: PuzzleTier; name: string; desc: string; clues: number }[] = [
  { id: 'beginner', name: '入门', desc: '唯一候选，适合第一次玩', clues: 48 },
  { id: 'easy', name: '基础', desc: '唯一候选与隐藏唯一', clues: 33 },
  { id: 'advanced', name: '进阶', desc: '需要区块排除、数组等技巧', clues: 27 },
  { id: 'expert', name: '专家', desc: '当前教学技巧无法完整解出', clues: 24 }
]
export function classifyDifficulty(rating: DifficultyResult): PuzzleTier {
  if (!rating.solvedLogically) return 'expert'
  if (rating.techniques.some(t => t !== 'NAKED_SINGLE' && t !== 'HIDDEN_SINGLE')) return 'advanced'
  return rating.techniques.includes('HIDDEN_SINGLE') ? 'easy' : 'beginner'
}
export function tierName(tier?: PuzzleTier): string { return PRACTICE_TIERS.find(t => t.id === tier)?.name ?? '未评级' }
export const MODE_NAMES = { CAMPAIGN: '无限闯关', PRACTICE: '无限练习', DAILY: '每日挑战', CUSTOM: '自定义题目' }
