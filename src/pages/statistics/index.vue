<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import { useProgressStore } from '@/stores/progress.store'
import { useHistoryStore } from '@/stores/history.store'
import { useStatisticsStore } from '@/stores/statistics.store'
import { formatDuration, formatLongDuration } from '@/utils/time'

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
  <view class="safe-page stats-page">
    <AppHeader title="总分">
      <template #left><text class="back" @tap="uni.navigateBack()">‹</text></template>
    </AppHeader>

    <view class="content">
      <view class="hero">
        <text class="score">{{ stats.totalScore }}</text>
        <text class="label">总积分</text>
        <text class="sub">完成固定关卡首次获得积分</text>
      </view>

      <view class="grid">
        <view><text>{{ stats.completedLevels }}</text><text>完成关卡</text></view>
        <view><text>{{ stats.totalCompletions }}</text><text>完成局数</text></view>
        <view><text>{{ stats.gold }}</text><text>金牌</text></view>
        <view><text>{{ stats.silver }}</text><text>银牌</text></view>
        <view><text>{{ stats.bronze }}</text><text>铜牌</text></view>
        <view><text>{{ formatLongDuration(stats.totalPlayTime) }}</text><text>总游戏时长</text></view>
        <view><text>{{ stats.mistakes }}</text><text>累计错误</text></view>
        <view><text>{{ stats.hints }}</text><text>使用提示</text></view>
      </view>

      <text class="section-title">难度进度</text>
      <view v-for="item in byDifficulty" :key="item.id" class="difficulty-card">
        <view class="difficulty-top"><text class="name">{{ item.name }}</text><text>{{ item.completed }} / 25</text></view>
        <view class="progress-track"><view class="progress-fill" :style="{ width: `${item.completed / 25 * 100}%` }"></view></view>
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
.stats-page { background: #f5f5f7; }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.content { padding: 16rpx 28rpx 40rpx; }
.hero { background: #fff; border-radius: 28rpx; padding: 42rpx; display: flex; flex-direction: column; align-items: center; }
.score { font-size: 76rpx; font-weight: 850; color: var(--primary); font-variant-numeric: tabular-nums; }
.label { color: #555; margin-top: 3rpx; font-size: 28rpx; font-weight: 650; }
.sub { color: #aaa; font-size: 20rpx; margin-top: 8rpx; }
.grid { margin-top: 24rpx; background: #fff; border-radius: 28rpx; padding: 14rpx; display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rpx; overflow: hidden; }
.grid view { min-height: 118rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fafafa; }
.grid view text:first-child { font-size: 31rpx; font-weight: 720; text-align: center; }
.grid view text:last-child { color: #8e8e93; font-size: 22rpx; margin-top: 7rpx; }
.section-title { display: block; margin: 34rpx 10rpx 12rpx; color: #7e7f84; font-size: 25rpx; }
.difficulty-card { margin-bottom: 18rpx; background: #fff; border-radius: 22rpx; padding: 24rpx 28rpx; }
.difficulty-top { display: flex; align-items: center; justify-content: space-between; font-size: 26rpx; }
.name { font-size: 31rpx; font-weight: 700; }
.progress-track { height: 12rpx; border-radius: 999rpx; background: #e8e9ec; overflow: hidden; margin-top: 19rpx; }
.progress-fill { height: 100%; background: var(--primary); border-radius: inherit; }
.difficulty-meta { margin-top: 16rpx; display: flex; justify-content: space-between; color: #8e8e93; font-size: 21rpx; }
</style>
