<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onBackPress, onShow } from '@dcloudio/uni-app'
import SudokuBoard from '@/components/sudoku/SudokuBoard.vue'
import NumberPad from '@/components/sudoku/NumberPad.vue'
import GameToolbar from '@/components/sudoku/GameToolbar.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import MoreSheet from '@/components/common/MoreSheet.vue'
import { useGameStore } from '@/stores/game.store'
import { useSettingsStore } from '@/stores/settings.store'
import { getDifficulty } from '@/config/difficulty'
import { getLevelById } from '@/assets/puzzles'
import { formatDuration } from '@/utils/time'
import { shareApp } from '@/services/share.service'
import { techniqueName } from '@/core/sudoku'

const gameStore = useGameStore()
const settingsStore = useSettingsStore()
const now = ref(Date.now())
const moreVisible = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const game = computed(() => gameStore.game)
const difficulty = computed(() => game.value ? getDifficulty(game.value.difficultyId) : null)
const level = computed(() => game.value ? getLevelById(game.value.levelId) : null)
const elapsedText = computed(() => formatDuration(gameStore.elapsed(now.value)))

function ensureTimer() {
  if (timer) return
  timer = setInterval(() => { now.value = Date.now() }, 250)
}

function togglePause() {
  if (!game.value) return
  if (game.value.status === 'PAUSED') gameStore.resume()
  else gameStore.pause()
}

function hint() {
  const result = gameStore.requestHint()
  if (!result) {
    uni.showToast({ title: '当前棋盘暂无可用提示', icon: 'none' })
    return
  }
  uni.showModal({
    title: `解法 · ${techniqueName(result.technique)}`,
    content: result.message,
    confirmText: '填入',
    cancelText: '只看提示',
    success: ({ confirm }) => confirm && gameStore.applyHint()
  })
}

function openMore() {
  if (game.value?.status === 'PLAYING') gameStore.pause()
  moreVisible.value = true
}

function exitAndSave() {
  gameStore.pause()
  gameStore.flushSave()
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) })
}

function restart() {
  uni.showModal({
    title: '重新开始本关',
    content: '当前填写、候选和计时都会清除，确定重新开始吗？',
    confirmText: '重新开始',
    confirmColor: '#ff3b30',
    success: ({ confirm }) => confirm && gameStore.restartCurrent()
  })
}

function moreAction(action: string) {
  if (action === 'exit') return exitAndSave()
  if (action === 'restart') return restart()
  if (action === 'fill-candidates') {
    if (game.value?.status === 'PAUSED') gameStore.resume()
    gameStore.autoCandidatesAll()
    return
  }
  if (action === 'share') return shareApp()

  const routes: Record<string, string> = {
    history: '/pages/history/index',
    statistics: '/pages/statistics/index',
    basic: '/pages/tutorial/index?section=basic',
    advanced: '/pages/tutorial/index?section=advanced',
    rules: '/pages/tutorial/index?section=rules',
    settings: '/pages/settings/index'
  }
  const url = routes[action]
  if (url) uni.navigateTo({ url })
}

function onAnswer(digit: number) {
  if (game.value?.inputMode === 'NOTE') gameStore.inputNoteDigit(digit)
  else gameStore.inputNormalDigit(digit)
}

onShow(() => {
  if (!game.value && !gameStore.restoreGame()) {
    uni.reLaunch({ url: '/pages/home/index' })
    return
  }
  ensureTimer()
})

onBackPress(() => {
  if (moreVisible.value) {
    moreVisible.value = false
    return true
  }
  uni.showModal({
    title: '退出本局？',
    content: '当前进度会自动保存，下次可以继续。',
    confirmText: '退出',
    success: ({ confirm }) => confirm && exitAndSave()
  })
  return true
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  timer = null
  gameStore.flushSave()
})
</script>

<template>
  <view v-if="game" class="safe-page game-page">
    <AppHeader title="数独">
      <template #left><text class="pause-button" @tap="togglePause">{{ game.status === 'PAUSED' ? '▶' : 'Ⅱ' }}</text></template>
      <template #right>
        <text class="stats-button" @tap="gameStore.pause(); uni.navigateTo({ url: '/pages/statistics/index' })">▥</text>
        <view class="more-button" @tap="openMore">•••</view>
      </template>
    </AppHeader>

    <view class="game-context"><text>{{ difficulty?.name }}</text><text>第 {{ level?.levelNo }} 关</text></view>
    <view class="meta">
      <text>{{ difficulty?.score ?? 0 }} 分</text>
      <text>{{ elapsedText }}</text>
      <text>错误: <text class="blue">{{ game.mistakeCount }}</text></text>
    </view>

    <view class="board-shell">
      <view class="board-wrap" :class="{ paused: game.status === 'PAUSED' }">
        <SudokuBoard
          :cells="game.cells"
          :selected-index="game.selectedIndex"
          :highlight-related="settingsStore.settings.highlightRelated"
          :highlight-same-digit="settingsStore.settings.highlightSameDigit"
          @select="gameStore.selectCell"
        />
        <view v-if="game.status === 'PAUSED'" class="pause-overlay" @tap="gameStore.resume">
          <view class="play">▶</view>
          <text>点击继续</text>
        </view>
      </view>
    </view>

    <GameToolbar
      :note-mode="game.inputMode === 'NOTE'"
      :can-undo="game.undoStack.length > 0"
      :can-redo="game.redoStack.length > 0"
      @candidates="gameStore.autoCandidates"
      @candidates-all="gameStore.autoCandidatesAll"
      @hint="hint"
      @erase="gameStore.erase"
      @note="gameStore.toggleNoteMode"
      @undo="gameStore.undo"
      @redo="gameStore.redo"
    />

    <NumberPad
      :cells="game.cells"
      :disabled="game.status !== 'PLAYING'"
      :disable-completed-digit="settingsStore.settings.disableCompletedDigit"
      :note-mode="game.inputMode === 'NOTE'"
      @answer="onAnswer"
      @note="gameStore.inputNoteDigit"
    />

    <MoreSheet v-model="moreVisible" game-mode @action="moreAction" />
  </view>
</template>

<style scoped lang="scss">
.game-page { background: var(--page-bg); color: var(--text-primary); overflow: hidden; }
.pause-button { color: var(--primary); font-size: 48rpx; font-weight: 700; min-width: 60rpx; }
.stats-button { color: var(--primary); font-size: 46rpx; line-height: 1; }
.more-button { width: 64rpx; height: 64rpx; border: 4rpx solid var(--primary); color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 27rpx; font-weight: 800; }
.game-context { margin-top: 26rpx; padding: 0 22rpx; display: flex; justify-content: space-between; color: #b0b2b6; font-size: 20rpx; }
.meta { padding: 6rpx 22rpx 10rpx; display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 28rpx; color: #8e8e93; font-variant-numeric: tabular-nums; }
.meta > text:nth-child(2) { text-align: center; }
.meta > text:nth-child(3) { text-align: right; }
.blue { color: var(--primary); }
.board-shell { width: 100%; padding: 0 12rpx; display: flex; justify-content: center; }
.board-wrap { position: relative; width: 100%; max-width: 760rpx; }
.board-wrap.paused :deep(.board) { filter: blur(5px); opacity: .18; }
.pause-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18rpx; background: rgba(235,235,235,.68); color: #666; font-size: 28rpx; z-index: 10; }
.play { width: 94rpx; height: 94rpx; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 43rpx; padding-left: 7rpx; box-shadow: 0 5rpx 18rpx rgba(0,0,0,.08); }
@media (max-height: 700px) {
  .game-context { margin-top: 0; }
  .meta { padding-bottom: 4rpx; }
  :deep(.toolbar-wrap) { padding-top: 10rpx; }
}
</style>
