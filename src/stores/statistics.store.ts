import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useProgressStore } from './progress.store'
import { useHistoryStore } from './history.store'
import { LEVELS } from '@/assets/puzzles'
import { DIFFICULTIES } from '@/config/difficulty'
import { campaignProfile, CAMPAIGN_PAGE_SIZE, parseCampaignId, suggestedCampaignLevel } from '@/config/campaign'

export const useStatisticsStore = defineStore('statistics', () => {
  const progressStore = useProgressStore()
  const historyStore = useHistoryStore()

  const summary = computed(() => {
    const completedProgress = Object.values(progressStore.progressMap).filter((item) => item.completed)
    const totals = historyStore.totals
    return {
      totalScore: progressStore.totalScore,
      completedLevels: completedProgress.length,
      legacyCompletedLevels: LEVELS.filter(level => progressStore.progressMap[level.id]?.completed).length,
      legacyTotal: LEVELS.length,
      gold: completedProgress.filter((item) => item.bestMedal === 'GOLD').length,
      silver: completedProgress.filter((item) => item.bestMedal === 'SILVER').length,
      bronze: completedProgress.filter((item) => item.bestMedal === 'BRONZE').length,
      totalPlayTime: totals.totalPlayTime,
      mistakes: totals.mistakes,
      hints: totals.hints,
      totalCompletions: totals.totalCompletions,
      byMode: totals.byMode,
      medals: totals.medals
    }
  })

  const byDifficulty = computed(() => DIFFICULTIES.map((difficulty) => {
    const progress = Object.values(progressStore.progressMap).filter((item) => item.difficultyId === difficulty.id && item.completed)
    const bestTimes = progress.map((item) => item.bestTime).filter((value): value is number => value != null)
    const nextLevelNo = suggestedCampaignLevel(difficulty.id, progressStore.progressMap)
    const stageStart = Math.floor((nextLevelNo - 1) / CAMPAIGN_PAGE_SIZE) * CAMPAIGN_PAGE_SIZE + 1
    const profile = campaignProfile(difficulty.id, nextLevelNo)
    return {
      ...difficulty,
      completed: progress.length,
      highestCompleted: progress.reduce((highest, item) => Math.max(highest, parseCampaignId(item.levelId)?.levelNo ?? 0), 0),
      nextLevelNo,
      stageStart,
      stageEnd: stageStart + CAMPAIGN_PAGE_SIZE - 1,
      stageCompleted: progress.filter(item => item.levelNo >= stageStart && item.levelNo < stageStart + CAMPAIGN_PAGE_SIZE).length,
      stageSize: CAMPAIGN_PAGE_SIZE,
      stageLabel: profile?.label ?? '保留题库',
      gold: progress.filter((item) => item.bestMedal === 'GOLD').length,
      bestTime: bestTimes.length ? Math.min(...bestTimes) : null,
      attempts: historyStore.totals.byDifficulty[difficulty.id] ?? 0
    }
  }))

  return { summary, byDifficulty }
})
