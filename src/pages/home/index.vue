<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { LEVELS } from '@/assets/puzzles'
import { useAppearance } from '@/composables/useAppearance'
import { useSafeArea } from '@/composables/useSafeArea'
import { openPage } from '@/composables/useNavigation'
import { useGameStore } from '@/stores/game.store'
import { useProgressStore } from '@/stores/progress.store'
import { useHistoryStore } from '@/stores/history.store'
import { localDate } from '@/services/puzzle.service'
import { streaks } from '@/services/daily.service'
import { shareApp } from '@/services/share.service'
import { gameTitle } from '@/utils/game-label'
import { formatDuration } from '@/utils/time'

const appearance = useAppearance()
const { topStyle } = useSafeArea()
const gameStore = useGameStore()
const progress = useProgressStore()
const history = useHistoryStore()
const today = ref(localDate())
const current = computed(() => gameStore.game && gameStore.game.status !== 'COMPLETED' ? gameStore.game : null)
const resume = computed(() => {
  const cells = current.value?.cells.filter(cell => cell.origin !== 'GIVEN') ?? []
  // Filled cells describe progress without revealing correctness when checking is off.
  const filled = cells.filter(cell => cell.value !== 0).length
  return { title: current.value ? gameTitle(current.value) : '', filled, total: cells.length, percent: cells.length ? Math.round(filled / cells.length * 100) : 0, time: formatDuration(gameStore.elapsed()) }
})
const dailyCompleted = computed(() => history.dailyDates.includes(today.value))
const streak = computed(() => streaks(history.dailyDates, today.value).current)
// Decoration always uses a bundled puzzle, never the player's paused board.
const illustration = [...LEVELS[0].puzzle].map(Number)
const features = computed(() => [
  { id: 'tutorial', icon: '▤', title: '技巧课堂', detail: '', url: '/pages/tutorial/index' },
  { id: 'statistics', icon: '☆', title: '成绩与成就', detail: progress.completedCount ? `已完成 ${progress.completedCount} 关` : '', url: '/pages/statistics/index' },
  { id: 'history', icon: '◷', title: '游戏历史', detail: '', url: '/pages/history/index' },
  { id: 'import', icon: '＋', title: '导入题目', detail: '', url: '/pages/import/index' }
])

function chooseGame() { openPage('/pages/levels/index') }
function play() {
  if (!current.value) return chooseGame()
  gameStore.resume()
  uni.navigateTo({ url: '/pages/game/index', fail: () => gameStore.pause() })
}
onShow(() => {
  today.value = localDate()
  progress.reload()
  history.refresh()
  if (!gameStore.game) gameStore.restoreGame()
  // The main menu is an intentional break, irrespective of the background preference.
  if (current.value) { gameStore.pause(); gameStore.flushSave() }
})
</script>

<template>
  <view class="safe-page home-page" :class="appearance" :style="topStyle">
    <view class="menu-content">
      <view class="menu-header">
        <view class="brand"><view class="brand-mark" aria-hidden="true"><text>1</text><text>2</text><text>3</text><text>4</text></view><text class="brand-name">数独</text></view>
        <button class="menu-control settings-button" @tap="openPage('/pages/settings/index')"><text class="settings-icon" aria-hidden="true">⚙</text><text>设置</text></button>
      </view>

      <view class="welcome-hero">
        <view class="hero-copy"><text class="eyebrow">经典数字谜题</text><view class="hero-title"><text>让思维，</text><text>玩一会儿。</text></view><text class="hero-subtitle">从一个空格，找到整个答案。</text></view>
        <view class="board-art" aria-hidden="true">
          <view class="mini-board"><view v-for="(digit, index) in illustration" :key="index" class="mini-cell" :class="{ 'box-right': index % 9 === 2 || index % 9 === 5, 'box-bottom': Math.floor(index / 9) === 2 || Math.floor(index / 9) === 5, related: Math.floor(index / 9) === 4 || index % 9 === 4, focused: index === 40 }"><text>{{ digit || '' }}</text></view></view>
          <view class="number-tile">9</view>
        </view>
      </view>

      <view class="play-area">
        <view v-if="current" class="resume-info"><text class="resume-title">{{ resume.title }}</text><text>已填 {{ resume.filled }}/{{ resume.total }} 格 · {{ resume.time }}</text></view>
        <view v-if="current" class="resume-track"><view class="resume-fill" :style="{ width: `${resume.percent}%` }"></view></view>
        <button class="menu-control play-button" @tap="play"><view class="play-copy"><text>{{ current ? '继续游戏' : '开始游戏' }}</text><text>{{ current ? '接着上次的思路，继续解题' : '无限闯关 · 难度逐步提升' }}</text></view><text class="play-arrow" aria-hidden="true">›</text></button>
        <button v-if="current" class="menu-control choose-button" @tap="chooseGame">选择其他关卡</button>
        <view v-if="current && gameStore.storageError" class="save-warning"><text>{{ gameStore.storageError }}</text><button class="menu-control" @tap="gameStore.flushSave()">重试保存</button></view>
      </view>

      <view class="mode-list">
        <button class="menu-control mode-card daily-card" hover-class="menu-hover" @tap="openPage('/pages/daily/index')">
          <view class="mode-icon" aria-hidden="true">▦</view>
          <view class="mode-copy"><view class="mode-heading"><text class="mode-title">每日挑战</text><text class="mode-tag" :class="{ completed: dailyCompleted }">{{ dailyCompleted ? '今日已完成' : '今日新题' }}</text></view><text class="mode-subtitle">{{ streak ? `已连续挑战 ${streak} 天` : '每天一道新题' }}</text></view>
          <text class="mode-arrow" aria-hidden="true">›</text>
        </button>
        <button class="menu-control mode-card practice-card" hover-class="menu-hover" @tap="openPage('/pages/levels/index?mode=practice')">
          <view class="mode-icon" aria-hidden="true">∞</view>
          <view class="mode-copy"><text class="mode-title">无限练习</text><text class="mode-subtitle">自由选择难度，专注解题</text></view>
          <text class="mode-arrow" aria-hidden="true">›</text>
        </button>
      </view>

      <view class="feature-nav">
        <button v-for="item in features" :key="item.id" class="menu-control feature-card" :class="`feature-${item.id}`" hover-class="menu-hover" @tap="openPage(item.url)"><text class="feature-icon" aria-hidden="true">{{ item.icon }}</text><text class="feature-title">{{ item.title }}</text><text v-if="item.detail" class="feature-detail">{{ item.detail }}</text></button>
      </view>
      <view class="menu-footer"><text class="offline-label"><text class="offline-dot"></text>离线畅玩，随时继续</text><button class="menu-control share-button" hover-class="menu-hover" @tap="shareApp">分享 App ↗</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.home-page { --menu-ink: #162c47; --menu-muted: #43546a; --menu-nav-icon: #23588a; --menu-daily-icon: #9a530c; --menu-practice-icon: #244d85; --menu-icon-text: #ffffff; --menu-daily-tag: #834507; --menu-completed: #12653d; background: linear-gradient(170deg, var(--primary-soft) 0%, var(--page-bg) 48%); }
.home-page.theme-dark { --menu-ink: #f3f6fb; --menu-muted: #bbc7d5; --menu-nav-icon: #8ec8ff; --menu-daily-icon: #f3c17a; --menu-practice-icon: #91b9ff; --menu-icon-text: #17243c; --menu-daily-tag: #f3c17a; --menu-completed: #8ad5ab; }
.menu-content { max-width: 900rpx; margin: 0 auto; padding: 20rpx 32rpx 12rpx; }
// Reset by class: H5 renders uni-button, so a global button::after rule misses it.
.menu-control { margin: 0; border: 0; box-sizing: border-box; }
.menu-control::after { display: none; border: 0; }
.menu-hover { opacity: .7; }
.menu-header, .brand { display: flex; align-items: center; }
.menu-header { justify-content: space-between; min-height: 96rpx; }
.brand { gap: 16rpx; }
.brand-mark { width: 64rpx; height: 64rpx; display: grid; grid-template-columns: repeat(2, 1fr); gap: 3rpx; background: var(--primary); padding: 5rpx; border-radius: 13rpx; transform: rotate(-6deg); }
.brand-mark text { display: flex; align-items: center; justify-content: center; background: var(--cell-bg); border-radius: 3rpx; color: var(--primary); font-size: 18rpx; font-weight: 700; }
.brand-name { font-size: 40rpx; font-weight: 800; letter-spacing: 3rpx; }
.settings-button { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-height: 48px; min-width: 48px; padding: 0 12rpx; background: transparent; color: var(--text-secondary); font-size: 26rpx; }
.settings-icon { font-size: 34rpx; }
.welcome-hero { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; min-height: 304rpx; margin: 20rpx 0 28rpx; animation: welcome-in .35s ease-out; }
.hero-copy { min-width: 0; flex: 1; }
.eyebrow { display: block; font-size: 24rpx; letter-spacing: 3rpx; color: var(--primary); margin-bottom: 14rpx; }
.hero-title { display: flex; flex-direction: column; font-size: 52rpx; line-height: 1.35; font-weight: 800; letter-spacing: 2rpx; }
.hero-subtitle { display: block; margin-top: 20rpx; font-size: 24rpx; line-height: 1.6; color: var(--text-secondary); }
.board-art { position: relative; width: 268rpx; height: 282rpx; flex-shrink: 0; display: flex; align-items: center; padding-right: 16rpx; }
.mini-board { width: 250rpx; height: 250rpx; display: grid; grid-template-columns: repeat(9, 1fr); grid-template-rows: repeat(9, 1fr); border: 3rpx solid var(--primary); background: var(--cell-bg); border-radius: 14rpx; overflow: hidden; transform: rotate(-8deg); box-shadow: 0 22rpx 50rpx rgba(8,100,207,.16); }
.mini-cell { min-width: 0; display: flex; align-items: center; justify-content: center; border-right: 1rpx solid var(--divider); border-bottom: 1rpx solid var(--divider); font-size: 16rpx; color: var(--text-primary); }
.mini-cell.box-right { border-right: 2rpx solid var(--primary); }
.mini-cell.box-bottom { border-bottom: 2rpx solid var(--primary); }
.mini-cell.related { background: var(--cell-related); }
.mini-cell.focused { background: var(--primary); }
.number-tile { position: absolute; right: 0; bottom: 0; width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; border: 5rpx solid var(--page-bg); border-radius: 18rpx; background: var(--primary); color: var(--page-bg); font-size: 43rpx; font-weight: 700; transform: rotate(8deg); }
.resume-info { display: flex; flex-direction: column; gap: 8rpx; margin-bottom: 14rpx; font-size: 24rpx; color: var(--text-secondary); }
.resume-title { font-weight: 650; font-size: 27rpx; color: var(--text-primary); }
.resume-track { height: 8rpx; border-radius: 99rpx; background: var(--primary-soft); overflow: hidden; margin-bottom: 18rpx; }
.resume-fill { height: 100%; background: var(--primary); border-radius: inherit; }
.play-button { width: 100%; min-height: max(120rpx, 48px); padding: 22rpx 32rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: space-between; text-align: left; background: var(--primary); color: var(--page-bg); box-shadow: 0 12rpx 28rpx rgba(8,100,207,.16); }
.play-copy { display: flex; flex-direction: column; gap: 7rpx; }
.play-copy text:first-child { font-size: 36rpx; font-weight: 750; }
.play-copy text:last-child { font-size: 24rpx; opacity: .88; }
.play-arrow { font-size: 56rpx; font-weight: 300; }
.choose-button { width: 100%; min-height: 48px; margin-top: 10rpx; background: transparent; color: var(--primary); font-size: 26rpx; }
.save-warning { display: flex; align-items: center; gap: 12rpx; font-size: 24rpx; color: var(--error); margin-top: 12rpx; }
.save-warning text { flex: 1; }
.save-warning button { min-height: 48px; padding: 0 14rpx; background: var(--surface); color: var(--primary); font-size: 24rpx; }
.mode-list { display: flex; flex-direction: column; gap: 8rpx; margin-top: 26rpx; }
.mode-card { width: 100%; min-width: 0; min-height: max(124rpx, 56px); padding: 16rpx 0; display: flex; flex-direction: row; align-items: center; gap: 22rpx; text-align: left; line-height: 1.4; background: transparent; color: var(--menu-ink); border-radius: 0; }
.mode-icon { flex-shrink: 0; width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 39rpx; line-height: 1; color: var(--menu-icon-text); }
.daily-card .mode-icon { background: var(--menu-daily-icon); }
.practice-card .mode-icon { background: var(--menu-practice-icon); }
.mode-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.mode-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 14rpx; }
.mode-title { font-size: 31rpx; font-weight: 750; color: var(--menu-ink); }
.mode-tag { font-size: 22rpx; font-weight: 600; color: var(--menu-daily-tag); }
.mode-tag.completed { color: var(--menu-completed); }
.mode-subtitle { font-size: 24rpx; line-height: 1.5; color: var(--menu-muted); }
.mode-arrow { flex-shrink: 0; width: 30rpx; font-size: 44rpx; text-align: right; color: var(--menu-ink); }
.feature-nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8rpx; margin-top: 32rpx; }
.feature-card { width: 100%; min-width: 0; min-height: max(132rpx, 64px); padding: 12rpx 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 10rpx; text-align: center; line-height: 1.4; border-radius: 0; background: transparent; color: var(--menu-ink); }
.feature-icon { height: 54rpx; display: flex; align-items: center; justify-content: center; color: var(--menu-nav-icon); font-size: 43rpx; line-height: 1; }
.feature-title { font-size: 24rpx; font-weight: 650; color: var(--menu-ink); }
.feature-detail { font-size: 20rpx; line-height: 1.4; color: var(--menu-muted); }
.menu-footer { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 18rpx; margin-top: 22rpx; }
.offline-label { display: flex; align-items: center; gap: 8rpx; color: var(--menu-muted); font-size: 22rpx; }
.offline-dot { width: 9rpx; height: 9rpx; border-radius: 50%; background: var(--primary); }
.share-button { min-height: 48px; padding: 0 10rpx; display: flex; align-items: center; line-height: 1.4; background: transparent; color: var(--menu-nav-icon); font-size: 24rpx; }
@keyframes welcome-in { from { opacity: 0; transform: translateY(10rpx); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .welcome-hero { animation: none; } }
@media (max-width: 360px) { .menu-content { padding-left: 26rpx; padding-right: 26rpx; } .board-art { width: 232rpx; height: 254rpx; } .mini-board { width: 218rpx; height: 218rpx; } .hero-title { font-size: 47rpx; } .feature-nav { gap: 4rpx; } .feature-title { font-size: 23rpx; } }
@media (max-height: 700px) { .welcome-hero { min-height: 260rpx; margin-top: 12rpx; margin-bottom: 20rpx; } .board-art { height: 250rpx; } .mode-list { margin-top: 20rpx; } .feature-nav { margin-top: 22rpx; } }
</style>
