import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEVELS } from '@/assets/puzzles'
import { CAMPAIGN_V2_BANK } from '@/assets/puzzles/campaign-v2'
import { campaignPage, campaignProfile, campaignSlot, CAMPAIGN_GENERATOR_VERSION, ladderProfile, matchesCampaignProfile, nextCampaignSlot, parseCampaignId, suggestedCampaignLevel } from '@/config/campaign'
import { classifyDifficulty } from '@/config/practice'
import { CAMPAIGN_BANDS, canSolveWithAtMostOneChain, countSolutions, normalizeCampaignDigits, parseBoard, rateCampaignPuzzle, rateDifficulty, serializeBoard, solve } from '@/core/sudoku'
import { campaignRepository, validGeneratedCampaignLevel } from '@/repositories/campaign.repository'
import { createCampaignLevel, requestCampaignLevel } from '@/services/campaign.service'
import { GenerationCancelled } from '@/services/puzzle.service'
import type { LevelProgress } from '@/types/progress'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const storage = new Map<string, string>()
beforeEach(() => {
  storage.clear()
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.get(key) ?? '',
    setStorageSync: (key: string, value: string) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key)
  })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('continuous numbered campaigns', () => {
  it('preserves every original ID, puzzle, solution and score metadata', async () => {
    for (const level of LEVELS) expect(await requestCampaignLevel(level.id)).toBe(level)
    expect(LEVELS).toHaveLength(75)
  })

  it('paginates and continues beyond 25, 999 and 10000 for every difficulty', () => {
    for (const id of ['master', 'king', 'grandmaster']) {
      expect(campaignPage(id, 1).map(slot => slot.levelNo)).toEqual(Array.from({ length: 25 }, (_, i) => 26 + i))
      expect(campaignPage(id, 400)[0].id).toBe(`${id}-10001`)
      expect(nextCampaignSlot(`${id}-025`)?.id).toBe(`${id}-026`)
      expect(nextCampaignSlot(`${id}-999`)?.id).toBe(`${id}-1000`)
      expect(nextCampaignSlot(`${id}-10000`)?.id).toBe(`${id}-10001`)
      expect(parseCampaignId(`${id}-10001`)).toEqual(campaignSlot(id, 10001))
    }
    for (const invalid of ['master-000', 'master-26', 'king-026junk', 'practice-026', 'master-9007199254740992']) expect(parseCampaignId(invalid)).toBeUndefined()
    expect(() => campaignPage('master', -1)).toThrow()
    expect(() => campaignSlot('unknown', 26)).toThrow()
  })

  it('increases nonoverlapping rating bands every 25 new levels and stabilizes at expert', () => {
    const rank = { beginner: 0, easy: 1, advanced: 2, expert: 3 }
    for (const id of ['master', 'king', 'grandmaster']) {
      let previous = campaignProfile(id, 26)!
      for (let no = 51; no <= 226; no += 25) {
        const current = campaignProfile(id, no)!
        expect(rank[current.tier]).toBeGreaterThanOrEqual(rank[previous.tier])
        expect(current.minScore).toBeGreaterThanOrEqual(previous.minScore)
        if (!previous.plateau) expect(current.minScore).toBeGreaterThan(previous.maxScore)
        expect(current.stage).toBe(previous.stage + 1)
        previous = current
      }
      expect(campaignProfile(id, 10001)).toMatchObject({ tier: 'expert', minScore: 400, plateau: true })
    }
    expect(campaignProfile('master', 25)).toBeNull()
    expect(campaignProfile('master', 26)?.tier).toBe('easy')
    expect(campaignProfile('king', 26)?.tier).toBe('advanced')
    expect(campaignProfile('grandmaster', 26)?.tier).toBe('expert')
  })

  it.each(['master', 'king', 'grandmaster'])('%s generates unique, independently rated puzzles in every stage, including distant levels', async id => {
    const seen = new Set<string>()
    for (const levelNo of [26, 27, 50, 51, 75, 76, 101, 126, 151, 176, 1001, 10001]) {
      const level = await createCampaignLevel(id, levelNo)
      const rating = rateDifficulty(parseBoard(level.puzzle))
      expect(countSolutions(parseBoard(level.puzzle), 2)).toBe(1)
      expect(level.difficultyId).toBe(id)
      expect(level.levelNo).toBe(levelNo)
      expect(level.difficultyScore).toBe(rating.score)
      expect(level.tier).toBe(classifyDifficulty(rating))
      expect(matchesCampaignProfile(level)).toBe(true)
      expect(seen.has(level.puzzle)).toBe(false)
      expect(validGeneratedCampaignLevel(level)).toBe(true)
      seen.add(level.puzzle)
    }
  }, 20000)

  it('reproduces the same puzzle after cache eviction, reset and unrelated play', async () => {
    const first = await requestCampaignLevel('king-076')
    expect(campaignRepository.find(first.id)).toEqual(first)
    expect(await requestCampaignLevel(first.id)).toEqual(first)
    campaignRepository.clear()
    await requestCampaignLevel('master-10001')
    expect(await requestCampaignLevel(first.id)).toEqual(first)
    expect(await createCampaignLevel('king', 76)).toEqual(first)
  })

  it('ignores corrupt cache data, regenerates invalid rating metadata and bounds cache size', async () => {
    storage.set('sudoku:v1:campaign-cache', JSON.stringify({ data: { unexpected: true } }))
    expect(campaignRepository.load()).toEqual([])
    const level = await requestCampaignLevel('master-026')
    const corrupt = { ...level, difficultyScore: level.difficultyScore + 1 }
    expect(validGeneratedCampaignLevel(corrupt)).toBe(false)
    storage.set('sudoku:v1:campaign-cache', JSON.stringify({ data: [corrupt] }))
    expect(await requestCampaignLevel(level.id)).toEqual(level)
    // Storage only keeps recent generated puzzles; stable IDs support regeneration.
    storage.set('sudoku:v1:campaign-cache', JSON.stringify({ data: Array(150).fill(level) }))
    expect(campaignRepository.load()).toHaveLength(100)
  })

  it('cancels before using cache or publishing generated data and tolerates auxiliary-cache write failures', async () => {
    await expect(requestCampaignLevel('master-026', () => true)).rejects.toBeInstanceOf(GenerationCancelled)
    expect(campaignRepository.load()).toEqual([])
    let cancelled = false
    const pending = requestCampaignLevel('master-026', () => cancelled)
    cancelled = true
    await expect(pending).rejects.toBeInstanceOf(GenerationCancelled)
    expect(campaignRepository.load()).toEqual([])
    uni.setStorageSync = () => { throw new Error('quota') }
    expect((await requestCampaignLevel('master-026')).id).toBe('master-026')
  })

  it('recommends the first unfinished level without a 25-level ceiling and respects gaps', () => {
    const progress: Record<string, LevelProgress> = {}
    const add = (no: number) => {
      const slot = campaignSlot('master', no)
      progress[slot.id] = { levelId: slot.id, difficultyId: slot.difficultyId, levelNo: no, completed: true, baseScore: 2000, bestMedal: 'GOLD', bestTime: 1000, minMistakes: 0, minHints: 0, completionCount: 1, firstCompletedAt: 1, lastCompletedAt: 1 }
    }
    for (let no = 1; no <= 1001; no++) add(no)
    expect(suggestedCampaignLevel('master', progress)).toBe(1002)
    delete progress['master-028']
    expect(suggestedCampaignLevel('master', progress)).toBe(28)
    expect(suggestedCampaignLevel('king', progress)).toBe(1)
  })

  it('validates 300 consecutive generated levels across all tracks, including every rating band', async () => {
    const started = Date.now()
    const seen = new Set<string>()
    const evidence: Array<{ id: string; stage: number; tier: string; score: number; clues: number }> = []
    for (const id of ['master', 'king', 'grandmaster']) {
      for (let levelNo = 26; levelNo <= 125; levelNo++) {
        const level = await createCampaignLevel(id, levelNo)
        expect(validGeneratedCampaignLevel(level), level.id).toBe(true)
        expect(matchesCampaignProfile(level), level.id).toBe(true)
        expect(seen.has(level.puzzle), level.id).toBe(false)
        seen.add(level.puzzle)
        evidence.push({ id: level.id, stage: campaignProfile(id, levelNo)!.stage, tier: level.tier!, score: level.difficultyScore, clues: level.clueCount })
      }
    }
    const directory = resolve('docs/validation/results')
    mkdirSync(directory, { recursive: true })
    writeFileSync(resolve(directory, 'campaign-generation.json'), JSON.stringify({ sampleCount: evidence.length, duplicates: 0, invalid: 0, elapsedMs: Date.now() - started, levels: evidence }, null, 2) + '\n')
  }, 60000)
})

describe('revised campaign ladder', () => {
  it('ships distinct, uniquely solvable templates with verified chain counts', () => {
    const seen = new Set<string>()
    for (const band of CAMPAIGN_BANDS) {
      expect(CAMPAIGN_V2_BANK[band].length).toBeGreaterThanOrEqual(band === 'naked' ? 10 : 25)
      for (const puzzle of CAMPAIGN_V2_BANK[band]) {
        const board = parseBoard(puzzle.puzzle)
        const normalized = normalizeCampaignDigits(board)
        const key = serializeBoard(normalized)
        expect(seen.has(key), band).toBe(false)
        seen.add(key)
        expect(countSolutions(board, 2), band).toBe(1)
        expect(serializeBoard(solve(board)!), band).toBe(puzzle.solution)
        expect(rateCampaignPuzzle(board), band).toEqual({
          band, difficultyScore: puzzle.difficultyScore, techniques: puzzle.techniques, chainSteps: puzzle.chainSteps
        })
        if (puzzle.chainSteps > 1) expect(canSolveWithAtMostOneChain(normalized), band).toBe(false)
      }
    }
  }, 30000)

  it('raises the stage at the declared boundaries and keeps distant jumps in the top band', async () => {
    const expectations = [
      ['master', 1, 'naked', 0], ['master', 10, 'naked', 0], ['master', 11, 'singles', 0],
      ['master', 25, 'singles', 0], ['master', 26, 'fundamentals', 0],
      ['master', 50, 'fundamentals', 0], ['master', 51, 'patterns', 0], ['master', 10000, 'patterns', 0],
      ['king', 25, 'patterns', 0], ['king', 26, 'one-chain', 1], ['king', 50, 'one-chain', 1],
      ['king', 51, 'two-chains', 2], ['king', 75, 'two-chains', 2], ['king', 76, 'three-chains', 3],
      ['grandmaster', 25, 'two-chains', 2], ['grandmaster', 26, 'three-chains', 3], ['grandmaster', 50, 'three-chains', 3],
      ['grandmaster', 51, 'multi-chain', 4], ['grandmaster', 1000, 'multi-chain', 4], ['grandmaster', 10000, 'multi-chain', 4]
    ] as const
    const seen = new Set<string>()
    for (const [track, number, band, chainSteps] of expectations) {
      const slot = campaignSlot(track, number, CAMPAIGN_GENERATOR_VERSION)
      const level = await requestCampaignLevel(slot.id)
      const rating = rateCampaignPuzzle(parseBoard(level.puzzle))!
      expect(parseCampaignId(slot.id)).toEqual(slot)
      expect(ladderProfile(slot).band).toBe(band)
      expect(rating.band).toBe(band)
      expect(level.chainSteps).toBe(rating.chainSteps)
      if (band === 'multi-chain') {
        expect(level.chainSteps).toBeGreaterThanOrEqual(chainSteps)
        expect(level.techniques).toContain('AIC')
      } else expect(level.chainSteps).toBe(chainSteps)
      const template = serializeBoard(normalizeCampaignDigits(parseBoard(level.puzzle)))
      expect(seen.has(template)).toBe(false)
      seen.add(template)
      expect(validGeneratedCampaignLevel(level)).toBe(true)
    }
    expect(nextCampaignSlot('v2-grandmaster-10000')?.id).toBe('v2-grandmaster-10001')
    expect(nextCampaignSlot('grandmaster-10000')?.id).toBe('grandmaster-10001')
  })

  it('reproduces the same revised level without cache and rejects mismatched saves', async () => {
    const first = await requestCampaignLevel('v2-grandmaster-10000')
    await requestCampaignLevel('v2-king-001')
    campaignRepository.clear()
    expect(await requestCampaignLevel(first.id)).toEqual(first)
    expect(validGeneratedCampaignLevel({ ...first, chainSteps: 1 })).toBe(false)
    expect(validGeneratedCampaignLevel({ ...first, id: 'v2-grandmaster-10001', levelNo: 10001 })).toBe(false)
    expect(validGeneratedCampaignLevel({ ...first, id: 'grandmaster-10000', version: 1 })).toBe(false)
  })
})
