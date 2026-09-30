<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import { useAppearance } from '@/composables/useAppearance'
import { back, openPage } from '@/composables/useNavigation'
import { createDailyLevel, localDate } from '@/services/puzzle.service'
import { streaks } from '@/services/daily.service'
import { useGameStore } from '@/stores/game.store'
import { useHistoryStore } from '@/stores/history.store'
import { tierName } from '@/config/practice'

const appearance = useAppearance()
const history = useHistoryStore()
const game = useGameStore()
const today = ref(localDate())
const selected = ref(today.value)
const month = ref(today.value.slice(0, 7))
const completed = computed(() => new Set(history.dailyDates))
const streak = computed(() => streaks(history.dailyDates, today.value))
const level = computed(() => createDailyLevel(selected.value))
const days = computed(() => {
  const [year, m] = month.value.split('-').map(Number)
  const start = (new Date(year, m - 1, 1, 12).getDay() + 6) % 7
  const count = new Date(year, m, 0, 12).getDate()
  return [...Array(start).fill(''), ...Array.from({ length: count }, (_, i) => `${month.value}-${String(i + 1).padStart(2, '0')}`)] as string[]
})
function changeMonth(delta: number) {
  const [year, m] = month.value.split('-').map(Number)
  month.value = localDate(new Date(year, m - 1 + delta, 1, 12)).slice(0, 7)
}
function start() {
  if (game.game?.levelId === level.value.id && game.game.status !== 'COMPLETED') return openPage('/pages/game/index')
  const launch = () => { game.startGame(level.value, 'DAILY', selected.value); openPage('/pages/game/index') }
  if (game.game && game.game.status !== 'COMPLETED') uni.showModal({ title: '开始每日挑战', content: '当前未完成游戏会被替换，是否继续？', success: ({ confirm }) => { if (confirm) launch() } })
  else launch()
}
onShow(() => { today.value = localDate(); history.refresh() })
</script>
<template>
  <view class="safe-page daily-page" :class="appearance">
    <AppHeader title="每日挑战"><template #left><text class="back" @tap="back">‹</text></template></AppHeader>
    <view class="content">
      <view class="streak-card"><text>连续 {{ streak.current }} 天</text><text>最长 {{ streak.best }} 天 · 共完成 {{ history.dailyDates.length }} 天</text></view>
      <view class="calendar-head"><button @tap="changeMonth(-1)">‹</button><text>{{ month }}</text><button :disabled="month >= today.slice(0, 7)" @tap="changeMonth(1)">›</button></view>
      <view class="calendar">
        <text v-for="week in ['一','二','三','四','五','六','日']" :key="week" class="weekday">{{ week }}</text>
        <button v-for="(date, index) in days" :key="index" :disabled="!date || date > today" :class="{ selected: selected === date, completed: completed.has(date), today: date === today }" @tap="selected = date"><text>{{ date ? Number(date.slice(-2)) : '' }}</text><text v-if="completed.has(date)" class="check">✓</text></button>
      </view>
      <text class="date-title">{{ selected }} · {{ tierName(level.tier) }}</text>
      <text class="secondary-copy">同一天的题目在本机离线生成；可以补玩以前的挑战。每日完成只计一次天数，重复练习计入局数，不增加关卡积分。</text>
      <button class="primary-action" @tap="start">{{ completed.has(selected) ? '再玩这一天' : '开始挑战' }}</button>
    </view>
  </view>
</template>
<style scoped>
.daily-page { background: var(--page-bg); }
.back { font-size: 58rpx; color: var(--primary); }
.content { padding: 16rpx 24rpx 40rpx; max-width: 900rpx; margin: auto; }
.streak-card { padding: 28rpx; background: var(--primary-soft); border-radius: 20rpx; display: flex; flex-direction: column; gap: 12rpx; color: var(--primary); font-size: 38rpx; }
.streak-card text:last-child { font-size: 26rpx; }
.calendar-head { display: flex; align-items: center; justify-content: space-between; margin: 24rpx 0; font-size: 32rpx; }
.calendar-head button { min-width: 48px; min-height: 48px; color: var(--primary); background: var(--surface); }
.calendar { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6rpx; }
.calendar button { position: relative; min-height: 44px; aspect-ratio: 1; background: var(--surface); color: var(--text-primary); font-size: 27rpx; border-radius: 12rpx; display: flex; align-items: center; justify-content: center; }
.calendar button[disabled] { opacity: .35; }
.calendar .selected { box-shadow: inset 0 0 0 3rpx var(--primary); }
.calendar .completed { background: var(--primary-soft); color: var(--primary); }
.calendar .today { font-weight: 800; }
.weekday { text-align: center; font-size: 24rpx; color: var(--text-secondary); padding: 10rpx 0; }
.check { position: absolute; right: 3rpx; bottom: 2rpx; font-size: 20rpx; }
.date-title { display: block; font-size: 31rpx; margin: 28rpx 0 14rpx; }
</style>
