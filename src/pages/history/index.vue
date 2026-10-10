<script setup lang="ts">
import { useAppearance } from '@/composables/useAppearance'
import { back, openPage } from '@/composables/useNavigation'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import MedalBadge from '@/components/common/MedalBadge.vue'
import { useHistoryStore } from '@/stores/history.store'
import { recordTitle } from '@/utils/game-label'
import { formatDate, formatDuration } from '@/utils/time'

const { appearance, pageStyle } = useAppearance()

const historyStore = useHistoryStore()
const limit = ref(20)
const records = computed(() => historyStore.records.slice(0, limit.value))

function done() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) })
}

onShow(() => historyStore.refresh())
</script>

<template>
  <view class="safe-page history-page" :class="appearance" :style="pageStyle">
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
        @tap="openPage(`/pages/history/detail?id=${record.id}`)"
      >
        <view class="topline">
          <text class="serial">{{ record.serialNo || records.length - index }}</text>
          <MedalBadge :medal="record.medal" />
        </view>
        <view class="meta">
          <view>
            <text>{{ formatDate(record.completedAt) }}</text>
            <text>{{ recordTitle(record) }} · {{ record.scoreAwarded }} 分</text>
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
      <button v-if="limit < historyStore.records.length" class="load-more" @tap="limit += 20">加载更多记录</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.history-page { background: var(--surface); }
.back { color: var(--primary); font-size: clamp(24.65px, 58rpx, 29px); line-height: 1; }
.done { color: var(--primary); font-size: clamp(13.6px, 32rpx, 16px); font-weight: 650; }
.load-more { min-height: 48px; background: var(--primary-soft); color: var(--primary); border-radius: 16rpx; }
.records { width: 100%; max-width: 960px; margin: 0 auto; padding: 16px; }
.empty { padding-top: 210rpx; display: flex; flex-direction: column; align-items: center; color: var(--text-secondary); }
.empty-icon { font-size: clamp(30.6px, 72rpx, 36px); }
.empty-title { margin-top: 26rpx; color: var(--text-primary); font-size: clamp(12.75px, 30rpx, 15px); font-weight: 650; }
.empty-sub { margin-top: 10rpx; font-size: clamp(9.78px, 23rpx, 11.5px); }
.record-card { background: var(--cell-bg); border-radius: 30rpx; padding: 34rpx 40rpx 40rpx; margin-bottom: 28rpx; box-shadow: 0 9rpx 30rpx rgba(0,0,0,.035); }
.topline { min-height: 80rpx; display: flex; align-items: center; justify-content: space-between; }
.serial { font-size: clamp(29.75px, 70rpx, 35px); line-height: 1; font-weight: 850; }
.meta { display: flex; justify-content: space-between; align-items: flex-end; font-size: clamp(11.05px, 26rpx, 13px); margin: 20rpx 0 24rpx; }
.meta view { display: flex; flex-direction: column; gap: 8rpx; }
.duration { font-size: clamp(11.9px, 28rpx, 14px); font-weight: 600; font-variant-numeric: tabular-nums; }
.mini-board { display: grid; grid-template-columns: repeat(9, 1fr); border: 3rpx solid var(--line-strong); }
.mini-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-right: 1rpx solid var(--line); border-bottom: 1rpx solid var(--line); font-size: clamp(11.9px, 28rpx, 14px); font-weight: 620; }
.mini-cell.user { color: var(--primary); }
.mini-cell.strong-right { border-right: 3rpx solid var(--line-strong); }
.mini-cell.strong-bottom { border-bottom: 3rpx solid var(--line-strong); }
.mini-cell.last-col { border-right: 0; }
.mini-cell.last-row { border-bottom: 0; }
@media (min-width: 640px) {
  .records { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .record-card { min-width: 0; padding: 16px; margin-bottom: 0; }
  .meta { flex-wrap: wrap; gap: 8px; }
  .load-more { grid-column: 1 / -1; }
}
</style>
