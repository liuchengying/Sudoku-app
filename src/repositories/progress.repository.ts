import type { LevelProgress } from '@/types/progress'
import { resultsRepository } from './results.repository'

export const progressRepository = {
  load(): Record<string, LevelProgress> {
    return resultsRepository.load().progress
  },
  save(progress: Record<string, LevelProgress>): void {
    resultsRepository.saveProgress(progress)
  },
  clear(): void {
    resultsRepository.clearProgress()
  }
}
