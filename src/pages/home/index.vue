<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { DIFFICULTIES } from '@/config/difficulty'
import { getLevelsByDifficulty, getLevelById } from '@/assets/puzzles'
import type { SudokuLevel } from '@/core/sudoku'
import LevelGrid from '@/components/home/LevelGrid.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import MoreSheet from '@/components/common/MoreSheet.vue'
import { useProgressStore } from '@/stores/progress.store'
import { useGameStore } from '@/stores/game.store'
import { shareApp } from '@/services/share.service'

const difficultyIndex = ref(1)
const selectedLevel = ref<SudokuLevel | null>(null)
const moreVisible = ref(false)
const progressStore = useProgressStore()
const gameStore = useGameStore()

const difficulty = computed(() => DIFFICULTIES[difficultyIndex.value])
const levels = computed(() => getLevelsByDifficulty(difficulty.value.id))
const currentLevelId = computed(() => gameStore.game && gameStore.game.status !== 'COMPLETED' ? gameStore.game.levelId : null)
const selectedIsCurrent = computed(() => Boolean(selectedLevel.value && currentLevelId.value === selectedLevel.value.id))
const hasOtherResume = computed(() => Boolean(currentLevelId.value && !selectedIsCurrent.value))
const currentDifficulty = computed(() => gameStore.game ? DIFFICULTIES.find((item) => item.id === gameStore.game?.difficultyId) : null)
const currentLevel = computed(() => gameStore.game ? getLevelById(gameStore.game.levelId) : null)

function syncSelected(preferCurrent = false) {
  if (preferCurrent && gameStore.game?.difficultyId === difficulty.value.id) {
    selectedLevel.value = getLevelById(gameStore.game.levelId) ?? levels.value[0] ?? null
    return
  }
  const stillVisible = levels.value.find((level) => level.id === selectedLevel.value?.id)
  selectedLevel.value = stillVisible ?? levels.value[0] ?? null
}

function onDifficultyChange(event: { detail: { current: number } }) {
  difficultyIndex.value = Number(event.detail.current)
  syncSelected(true)
}

function selectLevel(level: SudokuLevel) {
  selectedLevel.value = level
}

function goGame() {
  uni.navigateTo({ url: '/pages/game/index' })
}

function startSelected() {
  if (!selectedLevel.value) return
  if (selectedIsCurrent.value) {
    goGame()
    return
  }

  const launch = () => {
    gameStore.startGame(selectedLevel.value!)
    goGame()
  }

  if (currentLevelId.value) {
    uni.showModal({
      title: '开始新关卡',
      content: '当前未完成进度会被替换，确定开始新关卡吗？',
      confirmText: '开始',
      success: ({ confirm }) => confirm && launch()
    })
  } else {
    launch()
  }
}

function resumeCurrent() {
  if (gameStore.game) goGame()
}

function openMore() {
  moreVisible.value = true
}

function moreAction(action: string) {
  const routes: Record<string, string> = {
    history: '/pages/history/index',
    statistics: '/pages/statistics/index',
    basic: '/pages/tutorial/index?section=basic',
    advanced: '/pages/tutorial/index?section=advanced',
    rules: '/pages/tutorial/index?section=rules',
    settings: '/pages/settings/index'
  }
  if (action === 'share') {
    shareApp()
    return
  }
  const url = routes[action]
  if (url) uni.navigateTo({ url })
}

onShow(() => {
  progressStore.reload()
  if (!gameStore.game) gameStore.restoreGame()
  if (gameStore.game && gameStore.game.status === 'COMPLETED') gameStore.discard()

  if (gameStore.game) {
    const index = DIFFICULTIES.findIndex((item) => item.id === gameStore.game?.difficultyId)
    if (index >= 0) difficultyIndex.value = index
  }
  syncSelected(true)
})
</script>

<template>
  <view class="safe-page home-page">
    <AppHeader title="数独">
      <template #left><text class="header-link" @tap="uni.navigateTo({ url: '/pages/tutorial/index?section=rules' })">玩法</text></template>
      <template #right><view class="more-button" @tap="openMore">•••</view></template>
    </AppHeader>

    <swiper class="difficulty-swiper" :current="difficultyIndex" :duration="220" @change="onDifficultyChange">
      <swiper-item v-for="item in DIFFICULTIES" :key="item.id">
        <view class="swiper-body">
          <LevelGrid
            :levels="getLevelsByDifficulty(item.id)"
            :selected-level-id="selectedLevel?.id ?? null"
            :current-level-id="currentLevelId"
            :progress-map="progressStore.progressMap"
            @select="selectLevel"
          />
        </view>
      </swiper-item>
    </swiper>

    <view class="dots">
      <view v-for="(_, index) in DIFFICULTIES" :key="index" class="dot" :class="{ active: index === difficultyIndex }"></view>
    </view>

    <text class="rank-caption">{{ difficulty.name }}</text>
    <view class="difficulty-info">
      <text class="difficulty-name">{{ difficulty.name }}</text>
      <text class="difficulty-score">{{ difficulty.score }} 分</text>
      <text class="difficulty-subtitle">{{ difficulty.subtitle }}</text>
    </view>

    <view v-if="hasOtherResume" class="resume-card" @tap="resumeCurrent">
      <view><text class="resume-title">继续当前游戏</text><text class="resume-sub">{{ currentDifficulty?.name }} · 第 {{ currentLevel?.levelNo }} 关</text></view>
      <text class="resume-arrow">›</text>
    </view>

    <button class="primary-button" @tap="startSelected">{{ selectedIsCurrent ? '继续' : '开始' }}</button>
    <text class="level-caption">第 {{ selectedLevel?.levelNo ?? '-' }} 关 · {{ selectedLevel?.clueCount ?? '-' }} 个已知数</text>

    <MoreSheet v-model="moreVisible" @action="moreAction" />
  </view>
</template>

<style scoped lang="scss">
.home-page { background: var(--page-bg); color: var(--text-primary); overflow: hidden; }
.header-link { color: var(--primary); font-size: 34rpx; font-weight: 650; }
.more-button { width: 66rpx; height: 66rpx; border: 4rpx solid var(--primary); color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28rpx; font-weight: 800; letter-spacing: 1rpx; }
.difficulty-swiper { height: 820rpx; margin-top: 90rpx; }
.swiper-body { padding: 0 14rpx; }
.dots { height: 30rpx; display: flex; justify-content: center; align-items: center; gap: 14rpx; }
.dot { width: 18rpx; height: 18rpx; border-radius: 50%; background: #d9dade; }
.dot.active { background: var(--primary); }
.rank-caption { display: block; text-align: center; color: #c7c7ca; font-size: 30rpx; font-weight: 600; margin-top: 5rpx; }
.difficulty-info { margin: 26rpx auto 24rpx; width: 62%; border-radius: 18rpx; background: #e5f1ff; display: flex; flex-direction: column; align-items: center; padding: 17rpx 12rpx 15rpx; }
.difficulty-name { color: var(--primary); font-size: 42rpx; font-weight: 700; line-height: 1.2; }
.difficulty-score { color: #9da1a7; font-size: 28rpx; margin-top: 2rpx; }
.difficulty-subtitle { color: #afb2b8; font-size: 21rpx; margin-top: 3rpx; }
.resume-card { width: 68%; margin: 0 auto 18rpx; min-height: 88rpx; padding: 12rpx 22rpx; border-radius: 20rpx; background: #f0f6fd; display: flex; align-items: center; justify-content: space-between; }
.resume-card > view { display: flex; flex-direction: column; }
.resume-title { color: var(--primary); font-size: 27rpx; font-weight: 650; }
.resume-sub { color: #8e949c; font-size: 20rpx; margin-top: 5rpx; }
.resume-arrow { color: var(--primary); font-size: 45rpx; }
.primary-button { width: 68%; height: 106rpx; margin: 0 auto; border-radius: 28rpx; background: var(--primary); color: #fff; font-size: 42rpx; font-weight: 650; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 22rpx rgba(10,124,255,.16); }
.level-caption { display: block; text-align: center; color: #b0b2b6; font-size: 22rpx; margin-top: 14rpx; }
@media (max-height: 700px) {
  .difficulty-swiper { height: 720rpx; margin-top: 25rpx; }
  .difficulty-info { margin-top: 14rpx; }
}
</style>
