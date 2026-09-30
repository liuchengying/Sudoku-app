import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useProgressStore } from './progress.store'
import { useHistoryStore } from './history.store'
import { DIFFICULTIES } from '@/config/difficulty'

export const useStatisticsStore = defineStore('statistics', () => {
  const progressStore = useProgressStore()
  const historyStore = useHistoryStore()

  const summary = computed(() => {
    const completedProgress = Object.values(progressStore.progressMap).filter((item) => item.completed)
    const history = historyStore.records
    return {
      totalScore: progressStore.totalScore,
      completedLevels: completedProgress.length,
      gold: completedProgress.filter((item) => item.bestMedal === 'GOLD').length,
      silver: completedProgress.filter((item) => item.bestMedal === 'SILVER').length,
      bronze: completedProgress.filter((item) => item.bestMedal === 'BRONZE').length,
      totalPlayTime: history.reduce((sum, item) => sum + item.elapsedTime, 0),
      mistakes: history.reduce((sum, item) => sum + item.mistakeCount, 0),
      hints: history.reduce((sum, item) => sum + item.hintCount, 0),
      totalCompletions: history.length
    }
  })

  const byDifficulty = computed(() => DIFFICULTIES.map((difficulty) => {
    const progress = Object.values(progressStore.progressMap).filter((item) => item.difficultyId === difficulty.id && item.completed)
    const history = historyStore.records.filter((item) => item.difficultyId === difficulty.id)
    const bestTimes = progress.map((item) => item.bestTime).filter((value): value is number => value != null)
    return {
      ...difficulty,
      completed: progress.length,
      gold: progress.filter((item) => item.bestMedal === 'GOLD').length,
      bestTime: bestTimes.length ? Math.min(...bestTimes) : null,
      attempts: history.length
    }
  }))

  return { summary, byDifficulty }
})
