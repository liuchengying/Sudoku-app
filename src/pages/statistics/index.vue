<script setup lang="ts">
import { useAppearance } from '@/composables/useAppearance'
import { back } from '@/composables/useNavigation'
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import { useProgressStore } from '@/stores/progress.store'
import { useHistoryStore } from '@/stores/history.store'
import { useStatisticsStore } from '@/stores/statistics.store'
import { formatDuration, formatLongDuration } from '@/utils/time'

const appearance = useAppearance()

const progressStore = useProgressStore()
const historyStore = useHistoryStore()
const statisticsStore = useStatisticsStore()
const stats = computed(() => statisticsStore.summary)
const byDifficulty = computed(() => statisticsStore.byDifficulty)

onShow(() => {
  progressStore.reload()
  historyStore.refresh()
})
</script>

<template>
  <view class="safe-page stats-page" :class="appearance">
    <AppHeader title="统计与成就">
      <template #left><text class="back" @tap="back">‹</text></template>
    </AppHeader>

    <view class="content">
      <view class="hero">
        <text class="score">{{ stats.totalScore }}</text>
        <text class="label">总积分</text>
        <text class="sub">每个闯关关卡首次完成获得积分</text>
      </view>

      <view class="grid">
        <view><text>{{ stats.completedLevels }}</text><text>完成关卡</text></view>
        <view><text>{{ stats.totalCompletions }}</text><text>完成局数</text></view>
        <view><text>{{ stats.gold }}</text><text>关卡金牌</text></view>
        <view><text>{{ stats.silver }}</text><text>关卡银牌</text></view>
        <view><text>{{ stats.bronze }}</text><text>关卡铜牌</text></view>
        <view><text>{{ formatLongDuration(stats.totalPlayTime) }}</text><text>完成局总时长</text></view>
        <view><text>{{ stats.mistakes }}</text><text>完成局累计错误</text></view>
        <view><text>{{ stats.hints }}</text><text>完成局累计提示</text></view>
      </view>

      <view class="grid">
        <view><text>{{ stats.byMode.PRACTICE }}</text><text>无限练习完成</text></view>
        <view><text>{{ historyStore.dailyDates.length }}</text><text>每日挑战完成天数</text></view>
      </view>
      <text class="section-title">本地成就</text>
      <view class="achievements"><text :class="{ unlocked: stats.totalCompletions >= 1 }">初次完成</text><text :class="{ unlocked: stats.medals.GOLD >= 1 }">首枚金牌</text><text :class="{ unlocked: stats.totalCompletions >= 100 }">完成 100 局</text><text :class="{ unlocked: stats.legacyCompletedLevels >= stats.legacyTotal }">初始题库通关</text><text :class="{ unlocked: historyStore.dailyDates.length >= 7 }">挑战 7 天</text></view>
      <text class="section-title">无限闯关进度</text>
      <view v-for="item in byDifficulty" :key="item.id" class="difficulty-card">
        <view class="difficulty-top"><text class="name">{{ item.name }}</text><text>已完成 {{ item.completed }} 关 · ∞</text></view>
        <text class="stage-copy">{{ item.stageLabel }} · {{ item.stageStart }}–{{ item.stageEnd }} 关 · 本阶段 {{ item.stageCompleted }}/{{ item.stageSize }}</text>
        <view class="progress-track"><view class="progress-fill" :style="{ width: `${item.stageCompleted / item.stageSize * 100}%` }"></view></view>
        <text class="stage-copy">最高完成第 {{ item.highestCompleted }} 关 · 推荐第 {{ item.nextLevelNo }} 关</text>
        <view class="difficulty-meta">
          <text>金牌 {{ item.gold }}</text>
          <text>完成 {{ item.attempts }} 局</text>
          <text>最佳 {{ item.bestTime == null ? '--:--' : formatDuration(item.bestTime) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.achievements { display: flex; flex-wrap: wrap; gap: 12rpx; }
.achievements text { padding: 18rpx; background: var(--divider); color: var(--text-secondary); border-radius: 12rpx; font-size: 24rpx; }
.achievements .unlocked { background: var(--primary-soft); color: var(--primary); }
.stats-page { background: var(--surface); }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.content { padding: 16rpx 28rpx 40rpx; }
.hero { background: var(--cell-bg); border-radius: 28rpx; padding: 42rpx; display: flex; flex-direction: column; align-items: center; }
.score { font-size: 76rpx; font-weight: 850; color: var(--primary); font-variant-numeric: tabular-nums; }
.label { color: var(--text-primary); margin-top: 3rpx; font-size: 28rpx; font-weight: 650; }
.sub { color: var(--text-secondary); font-size: 20rpx; margin-top: 8rpx; }
.grid { margin-top: 24rpx; background: var(--cell-bg); border-radius: 28rpx; padding: 14rpx; display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rpx; overflow: hidden; }
.grid view { min-height: 118rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--surface); }
.grid view text:first-child { font-size: 31rpx; font-weight: 720; text-align: center; }
.grid view text:last-child { color: var(--text-secondary); font-size: 22rpx; margin-top: 7rpx; }
.section-title { display: block; margin: 34rpx 10rpx 12rpx; color: var(--text-secondary); font-size: 25rpx; }
.difficulty-card { margin-bottom: 18rpx; background: var(--cell-bg); border-radius: 22rpx; padding: 24rpx 28rpx; }
.difficulty-top { display: flex; align-items: center; justify-content: space-between; font-size: 26rpx; }
.name { font-size: 31rpx; font-weight: 700; }
.stage-copy { display: block; color: var(--text-secondary); font-size: 23rpx; margin-top: 12rpx; }
.progress-track { height: 12rpx; border-radius: 999rpx; background: var(--divider); overflow: hidden; margin-top: 19rpx; }
.progress-fill { height: 100%; background: var(--primary); border-radius: inherit; }
.difficulty-meta { margin-top: 16rpx; display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 21rpx; }
</style>
