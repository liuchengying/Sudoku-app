import { LEVELS } from '@/assets/puzzles'
import { countSolutions, generatePuzzle, parseBoard, rateDifficulty, serializeBoard, solve, validateBoard, type PuzzleTier, type SudokuLevel } from '@/core/sudoku'
import { classifyDifficulty, PRACTICE_TIERS } from '@/config/practice'
import { createId } from '@/utils/id'
import { practiceRepository } from '@/repositories/practice.repository'

export const GENERATOR_VERSION = 1
export function seedFromText(text: string): number {
  let seed = 2166136261
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619)
  return seed >>> 0
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function makeLevel(puzzle: number[], solution: number[], id: string, seed: number): SudokuLevel {
  const rating = rateDifficulty(puzzle)
  return { id, difficultyId: classifyDifficulty(rating), tier: classifyDifficulty(rating), levelNo: 0, puzzle: serializeBoard(puzzle), solution: serializeBoard(solution), difficultyScore: rating.score, techniques: rating.techniques, clueCount: puzzle.filter(Boolean).length, version: GENERATOR_VERSION, seed }
}
interface PracticeOptions { excluded?: ReadonlySet<string>; isCancelled?: () => boolean }
export class GenerationCancelled extends Error { constructor() { super('已取消生成') } }
export async function createPracticeLevel(tier: PuzzleTier, seed = seedFromText(createId('practice')), options: PracticeOptions = {}): Promise<SudokuLevel> {
  const config = PRACTICE_TIERS.find(t => t.id === tier)
  if (!config) throw new Error('请选择有效难度')
  const started = Date.now()
  const yieldAndCheck = async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    if (options.isCancelled?.()) throw new GenerationCancelled()
  }
  // Yield between attempts so Android can paint the loading indicator.
  for (let attempt = 0; attempt < 24; attempt++) {
    await yieldAndCheck()
    if (Date.now() - started > 1500) break
    const actualSeed = (seed + Math.imul(attempt, 2654435761)) >>> 0
    const generated = generatePuzzle({ seed: actualSeed, targetClues: config.clues, symmetry: attempt % 2 === 0 })
    const level = makeLevel(generated.puzzle, generated.solution, `practice-${seed}-${attempt}`, seed)
    if (level.tier === tier && !options.excluded?.has(level.puzzle)) return level
  }
  // A digit permutation preserves validity and uniqueness. Re-rate each variant
  // because the order of the logical solver can affect the measured technique set.
  const pool = LEVELS.filter(l => l.tier === tier)
  for (let attempt = 0; attempt < 200 && pool.length; attempt++) {
    await yieldAndCheck()
    const base = pool[(seed + attempt) % pool.length]
    let random = (seed + Math.imul(attempt, 2654435761)) >>> 0
    const shuffle = (values: number[]) => {
      for (let i = values.length - 1; i > 0; i--) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0
        const j = random % (i + 1); [values[i], values[j]] = [values[j], values[i]]
      }
      return values
    }
    const digits = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])]
    const units = () => shuffle([0, 1, 2]).flatMap(group => shuffle([0, 1, 2]).map(i => group * 3 + i))
    const rows = units(), cols = units()
    const transpose = random % 2 === 0
    const map = (board: string) => Array.from({ length: 81 }, (_, i) => digits[Number(board[transpose ? cols[i % 9] * 9 + rows[Math.floor(i / 9)] : rows[Math.floor(i / 9)] * 9 + cols[i % 9]])])
    const level = makeLevel(map(base.puzzle), map(base.solution), `practice-${seed}-variant-${attempt}`, seed)
    if (level.tier === tier && !options.excluded?.has(level.puzzle)) return level
  }
  throw new Error('暂未生成符合该难度的题目，请再试一次')
}
const warming = new Set<PuzzleTier>()
const warmTimers = new Map<PuzzleTier, ReturnType<typeof setTimeout>>()
let cacheEpoch = 0
export function resetPracticeCache() {
  cacheEpoch++
  warmTimers.forEach(timer => clearTimeout(timer))
  warmTimers.clear()
  warming.clear()
  practiceRepository.clear()
}
export async function requestPracticeLevel(tier: PuzzleTier, isCancelled?: () => boolean): Promise<SudokuLevel> {
  const state = practiceRepository.load()
  const cached = state.cache[tier]
  const useCache = cached && classifyDifficulty(rateDifficulty(parseBoard(cached.puzzle))) === tier && countSolutions(parseBoard(cached.puzzle), 2) === 1 && !state.recent.includes(cached.puzzle)
  const level = useCache ? cached : await createPracticeLevel(tier, undefined, { excluded: new Set(state.recent), isCancelled })
  if (isCancelled?.()) throw new GenerationCancelled()
  const latest = practiceRepository.load()
  latest.recent = [...latest.recent, level.puzzle].slice(-100)
  delete latest.cache[tier]
  try { practiceRepository.save(latest) } catch { /* Cache does not determine game persistence. */ }
  if (!warming.has(tier)) {
    warming.add(tier)
    const epoch = cacheEpoch
    const timer = setTimeout(async () => {
      warmTimers.delete(tier)
      try {
        const recent = practiceRepository.load().recent
        const next = await createPracticeLevel(tier, undefined, { excluded: new Set(recent), isCancelled: () => epoch !== cacheEpoch })
        if (epoch !== cacheEpoch) return
        const latest = practiceRepository.load()
        if (!latest.recent.includes(next.puzzle)) { latest.cache[tier] = next; practiceRepository.save(latest) }
      } catch { /* Next request can generate a fresh puzzle. */ }
      finally { if (epoch === cacheEpoch) warming.delete(tier) }
    }, 100)
    warmTimers.set(tier, timer)
  }
  return level
}
export function createDailyLevel(date = localDate()): SudokuLevel {
  const parts = date.split('-').map(Number)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || localDate(new Date(parts[0], parts[1] - 1, parts[2], 12)) !== date) throw new Error('请输入有效日期 YYYY-MM-DD')
  const seed = seedFromText(`sudoku-daily-v${GENERATOR_VERSION}:${date}`)
  const generated = generatePuzzle({ seed, targetClues: 30, symmetry: true })
  return makeLevel(generated.puzzle, generated.solution, `daily-v${GENERATOR_VERSION}-${date}`, seed)
}
export function importPuzzle(text: string): SudokuLevel {
  const puzzleText = text.replace(/[\s|,，]/g, '').replace(/\./g, '0')
  if (!/^[0-9]{81}$/.test(puzzleText)) throw new Error('请输入 81 个数字，空格用 0 或 . 表示')
  const puzzle = parseBoard(puzzleText)
  if (!puzzle.some(v => v === 0)) throw new Error('题目已经填满，请至少留一个空格')
  if (!validateBoard(puzzle)) throw new Error('题目数字在行、列或宫内存在重复')
  const count = countSolutions(puzzle, 2)
  if (count === 0) throw new Error('这道题没有解，请检查题目数字')
  if (count !== 1) throw new Error('这道题有多个解，请补充题目数字')
  return makeLevel(puzzle, solve(puzzle)!, `custom-${seedFromText(puzzleText)}`, seedFromText(puzzleText))
}
