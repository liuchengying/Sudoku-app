<script setup lang="ts">
import { useAppearance } from '@/composables/useAppearance'
import { openPage } from '@/composables/useNavigation'
import { computed, ref } from 'vue'
import { onBackPress, onShow, onHide } from '@dcloudio/uni-app'
import { useGameStore } from '@/stores/game.store'
import { gameTitle } from '@/utils/game-label'
import { requestPracticeLevel, GenerationCancelled } from '@/services/puzzle.service'
import type { PuzzleTier } from '@/core/sudoku'
import { nextCampaignSlot } from '@/config/campaign'
import { requestCampaignLevel } from '@/services/campaign.service'
import { formatDuration } from '@/utils/time'
import MedalBadge from '@/components/common/MedalBadge.vue'

const appearance = useAppearance()

const gameStore = useGameStore()
const game = computed(() => gameStore.game)
const title = computed(() => game.value ? gameTitle(game.value) : '')
const loading = ref(false)
let generationToken = 0
const campaign = computed(() => (game.value?.mode ?? 'CAMPAIGN') === 'CAMPAIGN')
const completion = computed(() => game.value?.completion ?? null)
const next = computed(() => game.value && campaign.value ? nextCampaignSlot(game.value.levelId) : undefined)

function home() {
  generationToken++
  try { gameStore.discard() } catch { /* Completed result is already durable. */ }
  uni.reLaunch({ url: '/pages/home/index' })
}

function replay() {
  if (!gameStore.restartCurrent()) return home()
  uni.redirectTo({ url: '/pages/game/index' })
}

async function nextLevel() {
  if (loading.value || !game.value) return
  const practice = game.value.mode === 'PRACTICE'
  if (!practice && !next.value) return home()
  const difficultyId = game.value.difficultyId
  const nextId = next.value?.id
  loading.value = true
  const token = ++generationToken
  try {
    const level = practice
      ? await requestPracticeLevel(difficultyId as PuzzleTier, () => token !== generationToken)
      : await requestCampaignLevel(nextId!, () => token !== generationToken)
    if (token !== generationToken) return
    gameStore.startGame(level, practice ? 'PRACTICE' : 'CAMPAIGN')
    uni.redirectTo({ url: '/pages/game/index' })
  }
  catch (e) { if (!(e instanceof GenerationCancelled)) uni.showToast({ title: e instanceof Error ? e.message : '生成失败', icon: 'none' }) }
  finally { if (token === generationToken) loading.value = false }
}

onShow(() => {
  if (!game.value || game.value.status !== 'COMPLETED') home()
})

onHide(() => { generationToken++; loading.value = false })

onBackPress(() => {
  home()
  return true
})
</script>

<template>
  <view v-if="game && completion" class="safe-page result-page" :class="appearance">
    <view class="medal-large"><MedalBadge :medal="completion.medal" /></view>
    <text class="title">完成</text>
    <text class="subtitle">{{ title }}</text>

    <view v-if="campaign" class="score-card">
      <text class="score-label">{{ completion.firstCompletion ? '获得积分' : '本关积分已获得' }}</text>
      <text class="score">{{ completion.firstCompletion ? `+${completion.scoreAwarded}` : completion.baseScore }}</text>
      <text class="score-sub">闯关基础分 {{ completion.baseScore }}</text>
    </view>

    <view class="stats-card">
      <view><text>用时</text><text>{{ formatDuration(game.accumulatedTime) }}</text></view>
      <view><text>错误</text><text>{{ game.mistakeCount }}</text></view>
      <view><text>提示</text><text>{{ game.hintCount }}</text></view>
    </view>

    <button v-if="next || game.mode === 'PRACTICE'" class="primary" :loading="loading" :disabled="loading" @tap="nextLevel">{{ game.mode === 'PRACTICE' ? '再来一道新题' : '下一关' }}</button>
    <text v-if="next" class="score-sub next-copy">下一关：第 {{ next.levelNo }} 关 · 关卡持续生成</text>
    <button v-if="loading" class="secondary" @tap="generationToken++; loading = false">取消生成</button>
    <button class="secondary" :disabled="loading" @tap="replay">再玩一次</button>
    <text v-if="game.mode === 'DAILY'" class="home-link" @tap="openPage('/pages/daily/index')">查看挑战日历</text>
    <text class="home-link" @tap="home">返回首页</text>
  </view>
</template>

<style scoped lang="scss">
.result-page { display: flex; flex-direction: column; align-items: center; padding: calc(118rpx + env(safe-area-inset-top)) 42rpx 30rpx; background: var(--page-bg); }
.medal-large { transform: scale(1.75); margin: 40rpx 0 42rpx; }
.title { font-size: 58rpx; font-weight: 750; }
.subtitle { color: var(--text-secondary); margin-top: 10rpx; font-size: 28rpx; }
.score-card { width: 100%; margin-top: 42rpx; padding: 28rpx; border-radius: 26rpx; background: var(--primary-soft); display: flex; flex-direction: column; align-items: center; }
.score-label { color: var(--text-secondary); font-size: 24rpx; }
.score { color: var(--primary); font-size: 58rpx; font-weight: 800; margin: 3rpx 0; }
.score-sub { color: var(--text-secondary); font-size: 21rpx; }
.next-copy { margin-top: 12rpx; }
.stats-card { width: 100%; background: var(--surface); border-radius: 24rpx; margin-top: 24rpx; padding: 10rpx 28rpx; }
.stats-card view { height: 80rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid var(--divider); font-size: 29rpx; }
.stats-card view:last-child { border-bottom: 0; }
.stats-card view text:last-child { font-weight: 650; font-variant-numeric: tabular-nums; }
.primary, .secondary { width: 100%; height: 100rpx; border-radius: 24rpx; font-size: 34rpx; font-weight: 650; display: flex; align-items: center; justify-content: center; }
.primary { margin-top: 44rpx; background: var(--primary); color: var(--page-bg); }
.secondary { margin-top: 16rpx; background: var(--primary-soft); color: var(--primary); }
.home-link { margin-top: 30rpx; color: var(--primary); font-size: 29rpx; font-weight: 600; }
</style>
