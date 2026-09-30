<script setup lang="ts">
import { computed } from 'vue'
import { onBackPress, onShow } from '@dcloudio/uni-app'
import { useGameStore } from '@/stores/game.store'
import { getDifficulty } from '@/config/difficulty'
import { getLevelById, getNextLevel } from '@/assets/puzzles'
import { formatDuration } from '@/utils/time'
import MedalBadge from '@/components/common/MedalBadge.vue'

const gameStore = useGameStore()
const game = computed(() => gameStore.game)
const difficulty = computed(() => game.value ? getDifficulty(game.value.difficultyId) : null)
const level = computed(() => game.value ? getLevelById(game.value.levelId) : null)
const completion = computed(() => game.value?.completion ?? null)
const next = computed(() => game.value ? getNextLevel(game.value.levelId) : undefined)

function home() {
  gameStore.discard()
  uni.reLaunch({ url: '/pages/home/index' })
}

function replay() {
  if (!gameStore.restartCurrent()) return home()
  uni.redirectTo({ url: '/pages/game/index' })
}

function nextLevel() {
  if (!next.value) return home()
  gameStore.startGame(next.value)
  uni.redirectTo({ url: '/pages/game/index' })
}

onShow(() => {
  if (!game.value || game.value.status !== 'COMPLETED') home()
})

onBackPress(() => {
  home()
  return true
})
</script>

<template>
  <view v-if="game && completion" class="safe-page result-page">
    <view class="medal-large"><MedalBadge :medal="completion.medal" /></view>
    <text class="title">完成</text>
    <text class="subtitle">{{ difficulty?.name }} · 第 {{ level?.levelNo }} 关</text>

    <view class="score-card">
      <text class="score-label">{{ completion.firstCompletion ? '获得积分' : '本关积分已获得' }}</text>
      <text class="score">{{ completion.firstCompletion ? `+${completion.scoreAwarded}` : completion.baseScore }}</text>
      <text class="score-sub">{{ difficulty?.name }}基础分 {{ completion.baseScore }}</text>
    </view>

    <view class="stats-card">
      <view><text>用时</text><text>{{ formatDuration(game.accumulatedTime) }}</text></view>
      <view><text>错误</text><text>{{ game.mistakeCount }}</text></view>
      <view><text>提示</text><text>{{ game.hintCount }}</text></view>
    </view>

    <button v-if="next" class="primary" @tap="nextLevel">下一关</button>
    <button class="secondary" @tap="replay">再玩一次</button>
    <text class="home-link" @tap="home">返回关卡</text>
  </view>
</template>

<style scoped lang="scss">
.result-page { display: flex; flex-direction: column; align-items: center; padding: calc(118rpx + env(safe-area-inset-top)) 42rpx 30rpx; background: var(--page-bg); }
.medal-large { transform: scale(1.75); margin: 40rpx 0 42rpx; }
.title { font-size: 58rpx; font-weight: 750; }
.subtitle { color: var(--text-secondary); margin-top: 10rpx; font-size: 28rpx; }
.score-card { width: 100%; margin-top: 42rpx; padding: 28rpx; border-radius: 26rpx; background: #e8f3ff; display: flex; flex-direction: column; align-items: center; }
.score-label { color: #6c8aa9; font-size: 24rpx; }
.score { color: var(--primary); font-size: 58rpx; font-weight: 800; margin: 3rpx 0; }
.score-sub { color: #9ba8b4; font-size: 21rpx; }
.stats-card { width: 100%; background: var(--surface); border-radius: 24rpx; margin-top: 24rpx; padding: 10rpx 28rpx; }
.stats-card view { height: 80rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid var(--divider); font-size: 29rpx; }
.stats-card view:last-child { border-bottom: 0; }
.stats-card view text:last-child { font-weight: 650; font-variant-numeric: tabular-nums; }
.primary, .secondary { width: 100%; height: 100rpx; border-radius: 24rpx; font-size: 34rpx; font-weight: 650; display: flex; align-items: center; justify-content: center; }
.primary { margin-top: 44rpx; background: var(--primary); color: #fff; }
.secondary { margin-top: 16rpx; background: #edf5ff; color: var(--primary); }
.home-link { margin-top: 30rpx; color: var(--primary); font-size: 29rpx; font-weight: 600; }
</style>
