import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { progressRepository } from '@/repositories/progress.repository'
import type { LevelProgress, MedalType } from '@/types/progress'

function medalRank(medal: MedalType | null): number {
  if (medal === 'GOLD') return 3
  if (medal === 'SILVER') return 2
  if (medal === 'BRONZE') return 1
  return 0
}

export const useProgressStore = defineStore('progress', () => {
  const progressMap = ref<Record<string, LevelProgress>>(progressRepository.load())

  const completedCount = computed(() => Object.values(progressMap.value).filter((item) => item.completed).length)
  const totalScore = computed(() => Object.values(progressMap.value)
    .filter((item) => item.completed)
    .reduce((sum, item) => sum + (item.baseScore ?? 0), 0))

  function get(levelId: string): LevelProgress | undefined {
    return progressMap.value[levelId]
  }

  function markCompleted(input: {
    levelId: string
    difficultyId: string
    levelNo: number
    baseScore: number
    medal: MedalType
    elapsedTime: number
    mistakes: number
    hints: number
    completedAt: number
  }) {
    const existing = progressMap.value[input.levelId]
    const firstCompletion = !existing?.completed
    const next: LevelProgress = {
      levelId: input.levelId,
      difficultyId: input.difficultyId,
      levelNo: input.levelNo,
      completed: true,
      baseScore: input.baseScore,
      bestMedal:
        medalRank(input.medal) > medalRank(existing?.bestMedal ?? null)
          ? input.medal
          : (existing?.bestMedal ?? input.medal),
      bestTime: existing?.bestTime == null ? input.elapsedTime : Math.min(existing.bestTime, input.elapsedTime),
      minMistakes: existing?.minMistakes == null ? input.mistakes : Math.min(existing.minMistakes, input.mistakes),
      minHints: existing?.minHints == null ? input.hints : Math.min(existing.minHints, input.hints),
      completionCount: (existing?.completionCount ?? 0) + 1,
      firstCompletedAt: existing?.firstCompletedAt ?? input.completedAt,
      lastCompletedAt: input.completedAt
    }

    const updated = { ...progressMap.value, [input.levelId]: next }
    progressRepository.save(updated)
    progressMap.value = updated
    return { firstCompletion, progress: next, scoreAwarded: firstCompletion ? input.baseScore : 0 }
  }

  function reload() {
    progressMap.value = progressRepository.load()
  }

  function reset() {
    progressRepository.clear()
    progressMap.value = {}
  }

  return { progressMap, completedCount, totalScore, get, markCompleted, reload, reset }
})
