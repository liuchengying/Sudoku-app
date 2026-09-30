<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import MedalBadge from '@/components/common/MedalBadge.vue'
import { useHistoryStore } from '@/stores/history.store'
import { getDifficulty } from '@/config/difficulty'
import { formatDate, formatDuration } from '@/utils/time'

const historyStore = useHistoryStore()
const records = computed(() => historyStore.records)

function done() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) })
}

onShow(() => historyStore.refresh())
</script>

<template>
  <view class="safe-page history-page">
    <AppHeader title="历史记录">
      <template #left><text class="back" @tap="done">‹</text></template>
      <template #right><text class="done" @tap="done">完成</text></template>
    </AppHeader>

    <view v-if="records.length === 0" class="empty">
      <text class="empty-icon">◷</text>
      <text class="empty-title">还没有历史记录</text>
      <text class="empty-sub">完成一局数独后会自动保存在这里</text>
    </view>

    <view v-else class="records">
      <view
        v-for="(record, index) in records"
        :key="record.id"
        class="record-card"
        @tap="uni.navigateTo({ url: `/pages/history/detail?id=${record.id}` })"
      >
        <view class="topline">
          <text class="serial">{{ record.serialNo || records.length - index }}</text>
          <MedalBadge :medal="record.medal" />
        </view>
        <view class="meta">
          <view>
            <text>{{ formatDate(record.completedAt) }}</text>
            <text>{{ getDifficulty(record.difficultyId).name }} · 第 {{ record.levelNo }} 关 · {{ record.baseScore }} 分</text>
          </view>
          <text class="duration">{{ formatDuration(record.elapsedTime) }}</text>
        </view>
        <view class="mini-board">
          <view
            v-for="(value, cellIndex) in record.finalValues"
            :key="cellIndex"
            class="mini-cell"
            :class="{
              user: record.origins[cellIndex] !== 'GIVEN',
              'strong-right': cellIndex % 9 === 2 || cellIndex % 9 === 5,
              'strong-bottom': Math.floor(cellIndex / 9) === 2 || Math.floor(cellIndex / 9) === 5,
              'last-col': cellIndex % 9 === 8,
              'last-row': Math.floor(cellIndex / 9) === 8
            }"
          >{{ value }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.history-page { background: #f5f5f7; }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.done { color: var(--primary); font-size: 32rpx; font-weight: 650; }
.records { padding: 20rpx 30rpx 40rpx; }
.empty { padding-top: 210rpx; display: flex; flex-direction: column; align-items: center; color: #9a9ba0; }
.empty-icon { font-size: 72rpx; }
.empty-title { margin-top: 26rpx; color: #555; font-size: 30rpx; font-weight: 650; }
.empty-sub { margin-top: 10rpx; font-size: 23rpx; }
.record-card { background: #fff; border-radius: 30rpx; padding: 34rpx 40rpx 40rpx; margin-bottom: 28rpx; box-shadow: 0 9rpx 30rpx rgba(0,0,0,.035); }
.topline { min-height: 80rpx; display: flex; align-items: center; justify-content: space-between; }
.serial { font-size: 70rpx; line-height: 1; font-weight: 850; }
.meta { display: flex; justify-content: space-between; align-items: flex-end; font-size: 26rpx; margin: 20rpx 0 24rpx; }
.meta view { display: flex; flex-direction: column; gap: 8rpx; }
.duration { font-size: 28rpx; font-weight: 600; font-variant-numeric: tabular-nums; }
.mini-board { display: grid; grid-template-columns: repeat(9, 1fr); border: 3rpx solid #111; }
.mini-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-right: 1rpx solid #b9bbc0; border-bottom: 1rpx solid #b9bbc0; font-size: 28rpx; font-weight: 620; }
.mini-cell.user { color: #1768b6; }
.mini-cell.strong-right { border-right: 3rpx solid #111; }
.mini-cell.strong-bottom { border-bottom: 3rpx solid #111; }
.mini-cell.last-col { border-right: 0; }
.mini-cell.last-row { border-bottom: 0; }
</style>
