import { getLevelById, LEVELS } from '@/assets/puzzles'
import { campaignProfile, campaignSlot, CAMPAIGN_GENERATOR_VERSION, matchesCampaignProfile, parseCampaignId } from '@/config/campaign'
import { classifyDifficulty } from '@/config/practice'
import { generatePuzzle, rateDifficulty, serializeBoard, type SudokuLevel } from '@/core/sudoku'
import { campaignRepository, validGeneratedCampaignLevel } from '@/repositories/campaign.repository'
import { GenerationCancelled, seedFromText } from './puzzle.service'

export function knownCampaignLevel(id: string): SudokuLevel | undefined {
  return getLevelById(id) ?? campaignRepository.find(id)
}

// Fix the attempt count, rather than a time budget, so slower devices generate the
// same numbered puzzle. Algorithm changes need versioned compatibility for old IDs.
export async function createCampaignLevel(difficultyId: string, levelNo: number, isCancelled?: () => boolean): Promise<SudokuLevel> {
  const slot = campaignSlot(difficultyId, levelNo)
  const yieldAndCheck = async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    if (isCancelled?.()) throw new GenerationCancelled()
  }
  await yieldAndCheck()
  const original = getLevelById(slot.id)
  if (original) return original
  const profile = campaignProfile(difficultyId, levelNo)!
  const key = `sudoku-campaign-v${CAMPAIGN_GENERATOR_VERSION}:${slot.id}`
  const seed = seedFromText(key)
  const makeLevel = (puzzle: number[], solution: number[]): SudokuLevel => {
    const rating = rateDifficulty(puzzle)
    return { ...slot, puzzle: serializeBoard(puzzle), solution: serializeBoard(solution), tier: classifyDifficulty(rating), difficultyScore: rating.score, techniques: rating.techniques, clueCount: puzzle.filter(Boolean).length, seed, version: CAMPAIGN_GENERATOR_VERSION }
  }
  for (let attempt = 0; attempt < 32; attempt++) {
    await yieldAndCheck()
    const generated = generatePuzzle({ seed: seedFromText(`${key}:fresh:${attempt}`), targetClues: profile.clues, symmetry: attempt % 2 === 0 })
    const level = makeLevel(generated.puzzle, generated.solution)
    if (matchesCampaignProfile(level)) return level
  }
  // A validated seed pool bounds waiting time when fresh digging misses a band.
  // Transform both the geometry and digits, then re-rate: no easier-tier fallback.
  const pool = LEVELS.filter(level => level.tier === profile.tier && level.difficultyScore >= profile.minScore && level.difficultyScore <= profile.maxScore)
  for (let attempt = 0; attempt < 256 && pool.length; attempt++) {
    await yieldAndCheck()
    const base = pool[(seed + attempt) % pool.length]
    let random = seedFromText(`${key}:variant:${attempt}`)
    const shuffle = (values: number[]) => {
      for (let i = values.length - 1; i > 0; i--) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0
        const j = random % (i + 1); [values[i], values[j]] = [values[j], values[i]]
      }
      return values
    }
    const digits = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])]
    const units = () => shuffle([0, 1, 2]).flatMap(group => shuffle([0, 1, 2]).map(i => group * 3 + i))
    const rows = units(), cols = units(), transpose = random % 2 === 0
    const transform = (board: string) => Array.from({ length: 81 }, (_, i) => digits[Number(board[transpose ? cols[i % 9] * 9 + rows[Math.floor(i / 9)] : rows[Math.floor(i / 9)] * 9 + cols[i % 9]])])
    const level = makeLevel(transform(base.puzzle), transform(base.solution))
    if (matchesCampaignProfile(level)) return level
  }
  throw new Error('暂未生成符合本阶段的题目，请再试一次')
}

export async function requestCampaignLevel(id: string, isCancelled?: () => boolean): Promise<SudokuLevel> {
  const slot = parseCampaignId(id)
  if (!slot) throw new Error('请选择有效关卡')
  if (isCancelled?.()) throw new GenerationCancelled()
  const original = getLevelById(id)
  if (original) return original
  const cached = campaignRepository.find(id)
  const level = cached && validGeneratedCampaignLevel(cached) ? cached : await createCampaignLevel(slot.difficultyId, slot.levelNo, isCancelled)
  if (isCancelled?.()) throw new GenerationCancelled()
  // The game itself persists the complete puzzle. An evicted cache entry can also
  // be reproduced from its ID, independently of play order or device speed.
  try { campaignRepository.save(level) } catch { /* Game saves remain authoritative. */ }
  return level
}
