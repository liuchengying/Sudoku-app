<script setup lang="ts">
import { useAppearance } from '@/composables/useAppearance'
import { back, openPage } from '@/composables/useNavigation'
import { computed, onBeforeUnmount, ref } from 'vue'
import { onBackPress, onShow, onHide } from '@dcloudio/uni-app'
import SudokuBoard from '@/components/sudoku/SudokuBoard.vue'
import NumberPad from '@/components/sudoku/NumberPad.vue'
import GameToolbar from '@/components/sudoku/GameToolbar.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import MoreSheet from '@/components/common/MoreSheet.vue'
import { useGameStore } from '@/stores/game.store'
import { useSettingsStore } from '@/stores/settings.store'
import HintSheet from '@/components/sudoku/HintSheet.vue'
import { gameTitle } from '@/utils/game-label'
import { tierName } from '@/config/practice'
import { campaignProfile } from '@/config/campaign'
import { getLevelById } from '@/assets/puzzles'
import { formatDuration } from '@/utils/time'
import { shareApp } from '@/services/share.service'

const appearance = useAppearance()

const gameStore = useGameStore()
const settingsStore = useSettingsStore()
const now = ref(Date.now())
const moreVisible = ref(false)
const hintVisible = ref(false)
const onboardingVisible = ref(false)
let wasPlayingBeforeMenu = false
let menuActionChosen = false
let timer: ReturnType<typeof setInterval> | null = null

const game = computed(() => gameStore.game)
const title = computed(() => game.value ? gameTitle(game.value) : '数独')
const level = computed(() => game.value ? game.value.level ?? getLevelById(game.value.levelId) : null)
const profile = computed(() => game.value && (game.value.mode ?? 'CAMPAIGN') === 'CAMPAIGN' && level.value ? campaignProfile(level.value.difficultyId, level.value.levelNo) : null)
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
  if (gameStore.requestHint()) hintVisible.value = true
  else uni.showToast({ title: '当前棋盘暂无可用提示', icon: 'none' })
}
function closeMore(value: boolean) {
  moreVisible.value = value
  if (!value) setTimeout(() => { if (!menuActionChosen && wasPlayingBeforeMenu) gameStore.resume() }, 0)
}
function finishOnboarding() {
  settingsStore.setSetting('onboardingSeen', true)
  onboardingVisible.value = false
  gameStore.resume()
}
function openStatistics() { gameStore.pause(); openPage('/pages/statistics/index') }

function openMore() {
  wasPlayingBeforeMenu = game.value?.status === 'PLAYING'
  menuActionChosen = false
  if (wasPlayingBeforeMenu) gameStore.pause()
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
    success: ({ confirm }) => { if (confirm) gameStore.restartCurrent(); else if (wasPlayingBeforeMenu) gameStore.resume() }
  })
}

function moreAction(action: string) {
  menuActionChosen = true
  if (['check', 'bookmark', 'restore-bookmark'].includes(action)) {
    gameStore.resume()
    if (action === 'check') uni.showToast({ title: gameStore.checkBoard() ? '已标出错误填写' : '当前填写没有错误', icon: 'none' })
    if (action === 'bookmark') { gameStore.saveBookmark(); uni.showToast({ title: gameStore.storageError || '棋盘书签已保存', icon: 'none' }) }
    if (action === 'restore-bookmark') {
      if (!game.value?.bookmark) uni.showToast({ title: '本局还没有书签', icon: 'none' })
      else uni.showModal({ title: '恢复书签', content: '将恢复书签棋盘，计时、错误和提示次数保留；可以撤销恢复。', success: ({ confirm }) => { if (confirm) gameStore.restoreBookmark() } })
    }
    return
  }
  if (action === 'exit') return exitAndSave()
  if (action === 'restart') return restart()
  if (action === 'fill-candidates') {
    if (game.value?.status === 'PAUSED') gameStore.resume()
    gameStore.autoCandidatesAll()
    return
  }
  if (action === 'share') { if (wasPlayingBeforeMenu) gameStore.resume(); return shareApp() }

  const routes: Record<string, string> = {
    history: '/pages/history/index',
    statistics: '/pages/statistics/index',
    basic: '/pages/tutorial/index?section=basic',
    advanced: '/pages/tutorial/index?section=advanced',
    rules: '/pages/tutorial/index?section=rules',
    settings: '/pages/settings/index',
    daily: '/pages/daily/index',
    import: '/pages/import/index'
  }
  const url = routes[action]
  if (url) uni.navigateTo({ url })
}


onShow(() => {
  if (!game.value && !gameStore.restoreGame()) {
    uni.reLaunch({ url: '/pages/home/index' })
    return
  }
  ensureTimer()
  now.value = Date.now()
  if (!settingsStore.settings.onboardingSeen) { gameStore.pause(); onboardingVisible.value = true }
})
onHide(() => { gameStore.pause(true); gameStore.flushSave(); if (timer) clearInterval(timer); timer = null; moreVisible.value = false; hintVisible.value = false })

onBackPress(() => {
  if (hintVisible.value) { hintVisible.value = false; return true }
  if (moreVisible.value) {
    closeMore(false)
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
  <view v-if="game" class="safe-page game-page" :class="appearance">
    <AppHeader title="数独">
      <template #left><text class="pause-button" @tap="togglePause">{{ game.status === 'PAUSED' ? '▶' : 'Ⅱ' }}</text></template>
      <template #right>
        <text class="stats-button" @tap="openStatistics">▥</text>
        <view class="more-button" @tap="openMore">•••</view>
      </template>
    </AppHeader>

    <view class="game-context"><text>{{ title }}</text><text>{{ tierName(level?.tier) }}</text></view>
    <text v-if="profile" class="input-help">第 {{ profile.stage }} 阶段 · {{ profile.label }}</text>
    <view class="meta">
      <text>{{ game.inputMode === 'NOTE' ? '草稿模式' : settingsStore.settings.inputStyle === 'number-first' ? '先选数字' : '填数模式' }}</text>
      <text>{{ elapsedText }}</text>
      <text>{{ settingsStore.settings.immediateErrorCheck ? '错误:' : '检查:' }} <text class="blue">{{ settingsStore.settings.immediateErrorCheck ? game.mistakeCount : '手动' }}</text></text>
    </view>

    <view v-if="gameStore.storageError || gameStore.needsSettlement" class="save-error"><text>{{ gameStore.storageError || '棋盘已完成，请保存完成结果。' }}</text><button @tap="gameStore.needsSettlement ? gameStore.completeGame() : gameStore.flushSave()">{{ gameStore.needsSettlement ? '重试结算' : '重试保存' }}</button></view>
    <view v-if="onboardingVisible" class="onboarding"><text>行、列和每个九宫格内，1–9 都只能出现一次。先选空格，再点数字；草稿用于记录候选。需要帮助时点解法，逐步查看推导。</text><button class="primary-action" @tap="finishOnboarding">开始尝试</button></view>
    <text class="input-help">{{ settingsStore.settings.inputStyle === 'number-first' ? (gameStore.activeDigit ? `已选 ${gameStore.activeDigit}，点击空格填写；再次点数字取消` : '先点下方数字，再点棋盘空格') : '先点棋盘空格，再点下方数字' }}</text>
    <view class="board-shell">
      <view class="board-wrap" :class="{ paused: game.status === 'PAUSED' }">
        <SudokuBoard
          :cells="game.cells"
          :selected-index="game.selectedIndex"
          :active-digit="settingsStore.settings.inputStyle === 'number-first' ? gameStore.activeDigit : null"
          :focus-indexes="hintVisible ? gameStore.pendingHint?.focusIndexes : []"
          :interactive="game.status === 'PLAYING'"
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
      :disabled="game.status !== 'PLAYING'"
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
      :show-remaining="settingsStore.settings.immediateErrorCheck"
      :note-mode="game.inputMode === 'NOTE'"
      :active-digit="gameStore.activeDigit"
      @answer="gameStore.chooseDigit"
    />

    <MoreSheet :model-value="moreVisible" game-mode @update:model-value="closeMore" @action="moreAction" />
    <HintSheet v-model="hintVisible" :hint="gameStore.pendingHint" @apply="gameStore.applyHint" />
  </view>
</template>

<style scoped lang="scss">
.input-help { display: block; padding: 6rpx 24rpx; font-size: 22rpx; color: var(--text-secondary); }
.save-error, .onboarding { margin: 12rpx 24rpx; padding: 22rpx; background: var(--primary-soft); border-radius: 18rpx; font-size: 26rpx; line-height: 1.6; }
.save-error button { min-height: 48px; color: var(--primary); }
.game-page { background: var(--page-bg); color: var(--text-primary); overflow: visible; }
.pause-button { color: var(--primary); font-size: 48rpx; font-weight: 700; min-width: 48px; min-height: 48px; display: flex; align-items: center; }
.stats-button { color: var(--primary); font-size: 46rpx; line-height: 1; min-width: 48px; min-height: 48px; display: flex; align-items: center; justify-content: center; }
.more-button { width: 48px; height: 48px; border: 4rpx solid var(--primary); color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 27rpx; font-weight: 800; }
.game-context { margin-top: 4rpx; padding: 0 22rpx; display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 20rpx; }
.meta { padding: 6rpx 22rpx 10rpx; display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 28rpx; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.meta > text:nth-child(2) { text-align: center; }
.meta > text:nth-child(3) { text-align: right; }
.blue { color: var(--primary); }
.board-shell { width: 100%; padding: 0 12rpx; display: flex; justify-content: center; }
.board-wrap { position: relative; width: 100%; max-width: 760rpx; max-width: min(760rpx, max(280px, calc(100dvh - 360px))); }
.board-wrap.paused :deep(.board) { filter: blur(5px); opacity: .18; }
.pause-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18rpx; background: var(--surface); color: var(--text-secondary); opacity: .94; font-size: 28rpx; z-index: 10; }
.play { width: 94rpx; height: 94rpx; border-radius: 50%; background: var(--cell-bg); display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 43rpx; padding-left: 7rpx; box-shadow: 0 5rpx 18rpx rgba(0,0,0,.08); }
@media (max-height: 700px) {
  .game-context { margin-top: 0; }
  .meta { padding-bottom: 4rpx; }
  :deep(.toolbar-wrap) { padding-top: 10rpx; }
}
</style>
