import { countSolutions, parseBoard, rateDifficulty, type SudokuLevel } from '@/core/sudoku'
import { CAMPAIGN_GENERATOR_VERSION, LEGACY_LEVEL_COUNT, matchesCampaignProfile, parseCampaignId } from '@/config/campaign'
import { classifyDifficulty } from '@/config/practice'
import { boards, object } from './validation'
import { readStorage, removeStorage, writeStorage } from './storage'

const KEY = 'sudoku:v1:campaign-cache'
const CACHE_LIMIT = 100
const TECHNIQUES = ['NAKED_SINGLE', 'HIDDEN_SINGLE', 'LOCKED_CANDIDATE', 'NAKED_PAIR', 'HIDDEN_PAIR', 'NAKED_TRIPLE', 'X_WING', 'BACKTRACKING']

function shape(raw: unknown): raw is SudokuLevel {
  if (!object(raw) || typeof raw.id !== 'string') return false
  const slot = parseCampaignId(raw.id)
  return !!slot && slot.levelNo > LEGACY_LEVEL_COUNT && raw.difficultyId === slot.difficultyId && raw.levelNo === slot.levelNo && raw.version === CAMPAIGN_GENERATOR_VERSION && Number.isInteger(raw.seed) && Number(raw.seed) >= 0 && Number(raw.seed) <= 0xffffffff && boards(raw.puzzle, raw.solution) && raw.clueCount === String(raw.puzzle).replace(/0/g, '').length && Number.isFinite(raw.difficultyScore) && Array.isArray(raw.techniques) && raw.techniques.every(t => TECHNIQUES.includes(t)) && matchesCampaignProfile(raw as unknown as SudokuLevel)
}
export function validGeneratedCampaignLevel(raw: unknown): raw is SudokuLevel {
  if (!shape(raw)) return false
  const puzzle = parseBoard(raw.puzzle)
  const rating = rateDifficulty(puzzle)
  return countSolutions(puzzle, 2) === 1 && raw.tier === classifyDifficulty(rating) && raw.difficultyScore === rating.score && JSON.stringify(raw.techniques) === JSON.stringify(rating.techniques)
}
export const campaignRepository = {
  load(): SudokuLevel[] {
    const raw = readStorage<unknown>(KEY, [])
    return Array.isArray(raw) ? raw.filter(shape).slice(-CACHE_LIMIT) : []
  },
  find(id: string): SudokuLevel | undefined { return this.load().find(level => level.id === id) },
  save(level: SudokuLevel): void {
    if (!shape(level)) throw new Error('关卡数据不完整')
    writeStorage(KEY, [...this.load().filter(item => item.id !== level.id), level].slice(-CACHE_LIMIT))
  },
  clear(): void { removeStorage(KEY) }
}
