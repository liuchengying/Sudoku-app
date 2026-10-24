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
import OnboardingGuide from '@/components/common/OnboardingGuide.vue'
import { useGameStore } from '@/stores/game.store'
import { useSettingsStore } from '@/stores/settings.store'
import HintSheet from '@/components/sudoku/HintSheet.vue'
import { gameTitle } from '@/utils/game-label'
import { tierName } from '@/config/practice'
import { campaignProfile } from '@/config/campaign'
import { getLevelById } from '@/assets/puzzles'
import { formatDuration } from '@/utils/time'
import { shareApp } from '@/services/share.service'
import { useWindowMetrics } from '@/composables/useWindowMetrics'
import { gameWindowLayout } from '@/utils/window-layout'

const { appearance, pageStyle } = useAppearance()
const { metrics } = useWindowMetrics()
const layout = computed(() => gameWindowLayout(metrics))

const gameStore = useGameStore()
const settingsStore = useSettingsStore()
const now = ref(Date.now())
const moreVisible = ref(false)
const hintVisible = ref(false)
const hintRevealed = ref(false)
const onboardingVisible = ref(false)
const guide = ref<InstanceType<typeof OnboardingGuide> | null>(null)
let wasPlayingBeforeOnboarding = false
let wasPlayingBeforeMenu = false
let menuActionChosen = false
let timer: ReturnType<typeof setInterval> | null = null
let closeMenuTimer: ReturnType<typeof setTimeout> | null = null
let menuSession = 0
let menuGameId = ''
let pageVisible = true

const game = computed(() => gameStore.game)
const title = computed(() => game.value ? gameTitle(game.value) : '数独')
const level = computed(() => game.value ? game.value.level ?? getLevelById(game.value.levelId) : null)
const profile = computed(() => game.value && (game.value.mode ?? 'CAMPAIGN') === 'CAMPAIGN' && level.value ? campaignProfile(level.value.difficultyId, level.value.levelNo) : null)
const elapsedText = computed(() => formatDuration(gameStore.elapsed(now.value)))
const instantChecking = computed(() => settingsStore.settings.immediateErrorCheck && !settingsStore.settings.independentMode)
const windowStyle = computed(() => ({
  '--controls-width': `${layout.value.controlsWidth}px`,
  '--rail-width': `${layout.value.controlsWidth}px`,
  '--digit-font-size': `${Math.min(settingsStore.settings.largeDigits ? 72 : 64, layout.value.boardSize / 9 * (settingsStore.settings.largeDigits ? .72 : .64))}px`,
  '--note-font-size': `${Math.min(settingsStore.settings.largeDigits ? 22 : 20, layout.value.boardSize / 9 * (settingsStore.settings.largeDigits ? .25 : .23))}px`,
  paddingLeft: `${metrics.safeLeft}px`, paddingRight: `${metrics.safeRight}px`,
  paddingBottom: `${16 + metrics.safeBottom}px`
}))

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
  if (game.value?.status !== 'PLAYING') return
  hintRevealed.value = false
  hintVisible.value = true
}
function revealHint() {
  if (gameStore.requestHint()) hintRevealed.value = true
  else { hintVisible.value = false; uni.showToast({ title: '当前棋盘暂无可用提示', icon: 'none' }) }
}
function restoreMenuState(session = menuSession) {
  if (session !== menuSession || !pageVisible || game.value?.id !== menuGameId) return
  if (wasPlayingBeforeMenu) gameStore.resume()
  wasPlayingBeforeMenu = false
}
function closeMore(value: boolean) {
  moreVisible.value = value
  if (closeMenuTimer) clearTimeout(closeMenuTimer)
  if (!value) {
    const session = menuSession
    closeMenuTimer = setTimeout(() => { closeMenuTimer = null; if (!menuActionChosen) restoreMenuState(session) }, 0)
  }
}
function finishOnboarding() {
  onboardingVisible.value = false
  if (wasPlayingBeforeOnboarding) gameStore.resume()
  wasPlayingBeforeOnboarding = false
}
function openStatistics() { gameStore.pause(); openPage('/pages/statistics/index') }

function openMore() {
  menuSession++
  menuGameId = game.value?.id ?? ''
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
  const session = menuSession
  uni.showModal({
    title: '重新开始本关',
    content: '当前填写、候选和计时都会清除，确定重新开始吗？',
    cancelText: '取消',
    confirmText: '重新开始',
    confirmColor: '#ff3b30',
    success: ({ confirm }) => {
      if (session !== menuSession || !pageVisible || game.value?.id !== menuGameId) return
      if (confirm) {
        const playing = wasPlayingBeforeMenu
        gameStore.restartCurrent()
        if (!playing) gameStore.pause()
        wasPlayingBeforeMenu = false
      } else restoreMenuState(session)
    }
  })
}

function moreAction(action: string) {
  menuActionChosen = true
  if (['check', 'bookmark', 'restore-bookmark'].includes(action)) {
    if (action === 'check') uni.showToast({ title: gameStore.checkBoard(true) ? '已标出错误填写' : '当前填写没有错误', icon: 'none' })
    if (action === 'bookmark') { gameStore.saveBookmark(true); uni.showToast({ title: gameStore.storageError || '棋盘书签已保存', icon: 'none' }) }
    if (action === 'restore-bookmark') {
      if (!game.value?.bookmark) { uni.showToast({ title: '本局还没有书签', icon: 'none' }); restoreMenuState() }
      else {
        const session = menuSession
        uni.showModal({ title: '恢复书签', content: '将恢复书签棋盘，计时、错误和提示次数保留；可以撤销恢复。', cancelText: '取消', success: ({ confirm }) => {
          if (session !== menuSession || !pageVisible || game.value?.id !== menuGameId) return
          if (confirm) gameStore.restoreBookmark(true)
          restoreMenuState(session)
        } })
      }
    } else {
      restoreMenuState()
    }
    return
  }
  if (action === 'exit') return exitAndSave()
  if (action === 'home') { gameStore.pause(); gameStore.flushSave(); uni.reLaunch({ url: '/pages/home/index' }); return }
  if (action === 'restart') return restart()
  if (action === 'fill-candidates') {
    gameStore.autoCandidatesAll(true)
    restoreMenuState()
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
  pageVisible = true
  if (!game.value && !gameStore.restoreGame()) {
    uni.reLaunch({ url: '/pages/home/index' })
    return
  }
  ensureTimer()
  now.value = Date.now()
  if (settingsStore.shouldShowOnboarding && game.value?.status !== 'COMPLETED' && !onboardingVisible.value) {
    wasPlayingBeforeOnboarding = game.value?.status === 'PLAYING'
    gameStore.pause()
    onboardingVisible.value = true
  }
})
onHide(() => {
  pageVisible = false; menuSession++; wasPlayingBeforeMenu = false; wasPlayingBeforeOnboarding = false
  if (closeMenuTimer) clearTimeout(closeMenuTimer)
  closeMenuTimer = null
  gameStore.pause(true); gameStore.flushSave(); if (timer) clearInterval(timer); timer = null
  moreVisible.value = false; hintVisible.value = false
})

onBackPress(() => {
  if (onboardingVisible.value) { guide.value?.dismiss(); return true }
  if (hintVisible.value) { hintVisible.value = false; return true }
  if (moreVisible.value) {
    closeMore(false)
    return true
  }
  uni.showModal({
    title: '退出本局？',
    content: '当前进度会自动保存，下次可以继续。',
    cancelText: '取消',
    confirmText: '退出',
    success: ({ confirm }) => confirm && exitAndSave()
  })
  return true
})

onBeforeUnmount(() => {
  pageVisible = false; menuSession++
  if (closeMenuTimer) clearTimeout(closeMenuTimer)
  if (timer) clearInterval(timer)
  timer = null
  gameStore.flushSave()
})
</script>

<template>
  <view v-if="game" class="safe-page game-page" :class="appearance" :style="[pageStyle, windowStyle]">
    <template v-if="!onboardingVisible">
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
      <text>{{ instantChecking ? '错误:' : '检查:' }} <text class="blue">{{ instantChecking ? game.mistakeCount : '手动' }}</text></text>
    </view>

    <view v-if="gameStore.storageError || gameStore.needsSettlement" class="save-error"><text>{{ gameStore.storageError || '棋盘已完成，请保存完成结果。' }}</text><button @tap="gameStore.needsSettlement ? gameStore.completeGame() : gameStore.flushSave()">{{ gameStore.needsSettlement ? '重试结算' : '重试保存' }}</button></view>
    <text class="input-help">{{ settingsStore.settings.inputStyle === 'number-first' ? (gameStore.activeDigit ? `已选 ${gameStore.activeDigit}，点击空格填写；再次点数字取消` : '先点下方数字，再点棋盘空格') : '先点棋盘空格，再点下方数字' }}</text>
    <view class="game-layout" :class="{ split: layout.split, rail: layout.rail }">
    <view class="board-shell">
      <view class="board-wrap" :class="{ paused: game.status === 'PAUSED' }" :style="{ width: `${layout.boardSize}px` }">
        <SudokuBoard
          :cells="game.cells"
          :selected-index="game.selectedIndex"
          :active-digit="settingsStore.settings.inputStyle === 'number-first' ? gameStore.activeDigit : null"
          :focus-indexes="hintVisible && hintRevealed ? gameStore.pendingHint?.focusIndexes : []"
          :show-errors="!settingsStore.settings.independentMode || gameStore.manualCheckVisible"
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

    <view class="game-controls">
    <GameToolbar
      :disabled="game.status !== 'PLAYING'"
      :note-mode="game.inputMode === 'NOTE'"
      :can-undo="game.undoStack.length > 0"
      :can-redo="game.redoStack.length > 0"
      :all-candidates="gameStore.allCandidatesShown"
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
      :show-remaining="instantChecking"
      :answer-aware="!settingsStore.settings.independentMode"
      :note-mode="game.inputMode === 'NOTE'"
      :active-digit="gameStore.activeDigit"
      @answer="gameStore.chooseDigit"
    />
    </view>
    </view>

    <MoreSheet :model-value="moreVisible" game-mode @update:model-value="closeMore" @action="moreAction" />
    <HintSheet v-model="hintVisible" :hint="gameStore.pendingHint" @reveal="revealHint" @apply="gameStore.applyHint" />
    </template>
    <OnboardingGuide v-if="onboardingVisible" ref="guide" context="game" @finish="finishOnboarding" />
  </view>
</template>

<style scoped lang="scss">
.input-help { display: block; padding: 6rpx 24rpx; font-size: clamp(9.35px, 22rpx, 11px); color: var(--text-secondary); }
.save-error { margin: 12rpx 24rpx; padding: 22rpx; background: var(--primary-soft); border-radius: 18rpx; font-size: clamp(11.05px, 26rpx, 13px); line-height: 1.6; }
.save-error button { min-height: 48px; color: var(--primary); }
.game-page { background: var(--page-bg); color: var(--text-primary); overflow: visible; }
.pause-button { color: var(--primary); font-size: clamp(20.4px, 48rpx, 24px); font-weight: 700; min-width: 48px; min-height: 48px; display: flex; align-items: center; }
.stats-button { color: var(--primary); font-size: clamp(19.55px, 46rpx, 23px); line-height: 1; min-width: 48px; min-height: 48px; display: flex; align-items: center; justify-content: center; }
.more-button { width: 48px; height: 48px; border: 4rpx solid var(--primary); color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: clamp(11.48px, 27rpx, 13.5px); font-weight: 800; }
.game-context { margin-top: 4rpx; padding: 0 22rpx; display: flex; justify-content: space-between; color: var(--text-secondary); font-size: clamp(8.5px, 20rpx, 10px); }
.meta { padding: 6rpx 22rpx 10rpx; display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: clamp(11.9px, 28rpx, 14px); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.meta > text:nth-child(2) { text-align: center; }
.meta > text:nth-child(3) { text-align: right; }
.blue { color: var(--primary); }
.game-layout { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 12px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
.game-layout.split { grid-template-columns: minmax(0, 1fr) minmax(0, var(--controls-width)); gap: 28px; }
.game-controls { min-width: 0; width: 100%; max-width: 520px; margin: 0 auto; }
/* Wide split panes: keep the control column compact and airy so the board can grow. */
.game-layout.split :deep(.toolbar-wrap) { padding-top: 8rpx; }
.game-layout.split :deep(.toolbar) { gap: 6px; }
.game-layout.split :deep(.tool) { min-height: 44px; gap: 8rpx; }
.game-layout.split :deep(.icon-circle) { width: 34px; height: 34px; }
.game-layout.split :deep(.glyph) { font-size: 21px; }
.game-layout.split :deep(.flag) { font-size: 23px; }
.game-layout.split :deep(.pencil) { font-size: 22px; }
.game-layout.split :deep(.label) { font-size: 12.5px; }
.game-layout.split :deep(.dot) { font-size: 10px; }
.game-layout.split :deep(.undo-row) { min-height: 40px; margin-top: 4rpx; font-size: 11px; }
.game-layout.split :deep(.number-pad) { gap: 10px; padding: 6px 0 10px; }
.game-layout.split :deep(.answer-key) { min-height: 44px; padding: 4px; gap: 5px; }
.game-layout.split :deep(.digit) { font-size: 20px; }
.game-layout.split :deep(.remaining) { font-size: 10px; }
/* Rail arrangement on unfolded inner screens: maximal board, a slim toolbar
   pinned to the right edge and one bottom row of digits under the board. */
.game-layout.rail { max-width: none; padding-right: 0; grid-template-columns: minmax(0, 1fr) var(--rail-width); grid-template-rows: minmax(0, 1fr) auto; grid-template-areas: 'board rail' 'digits rail'; gap: 28px; align-items: stretch; }
.game-layout.rail .board-shell { grid-area: board; }
.game-layout.rail .game-controls { display: contents; max-width: none; }
.game-layout.rail :deep(.toolbar-wrap) { grid-area: rail; display: flex; flex-direction: column; justify-content: flex-start; gap: 26px; padding: 16px 0 calc(16px + max(var(--safe-bottom, 0px), env(safe-area-inset-bottom))); background: var(--surface); border-radius: 20rpx 0 0 20rpx; }
.game-layout.rail :deep(.toolbar) { grid-template-columns: minmax(0, 1fr); gap: 18px; }
.game-layout.rail :deep(.tool) { min-height: 44px; gap: 6rpx; }
.game-layout.rail :deep(.icon-circle) { width: 36px; height: 36px; }
.game-layout.rail :deep(.glyph) { font-size: 22px; }
.game-layout.rail :deep(.flag) { font-size: 24px; }
.game-layout.rail :deep(.pencil) { font-size: 23px; }
.game-layout.rail :deep(.label) { font-size: 12px; }
.game-layout.rail :deep(.undo-row) { flex-direction: column; gap: 4rpx; min-height: auto; font-size: 11px; }
.game-layout.rail :deep(.number-pad) { grid-area: digits; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 8px; padding: 2px 0 0; }
.game-layout.rail :deep(.answer-key) { min-height: 52px; padding: 4px 6px; gap: 8px; }
.game-layout.rail :deep(.digit) { font-size: 22px; }
.game-layout.rail :deep(.remaining) { font-size: 11px; }
.board-shell { width: 100%; min-width: 0; display: flex; justify-content: center; }
.board-wrap { position: relative; max-width: 100%; }
.board-wrap.paused :deep(.board) { filter: blur(5px); opacity: .18; }
.pause-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18rpx; background: var(--surface); color: var(--text-secondary); opacity: .94; font-size: clamp(11.9px, 28rpx, 14px); z-index: 10; }
.play { width: 94rpx; height: 94rpx; border-radius: 50%; background: var(--cell-bg); display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: clamp(18.27px, 43rpx, 21.5px); padding-left: 7rpx; box-shadow: 0 5rpx 18rpx rgba(0,0,0,.08); }
@media (max-height: 700px) {
  .game-context { margin-top: 0; }
  .meta { padding-bottom: 4rpx; }
  :deep(.toolbar-wrap) { padding-top: 10rpx; }
}
</style>
