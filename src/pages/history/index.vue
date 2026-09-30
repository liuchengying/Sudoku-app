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

const appearance = useAppearance()

const historyStore = useHistoryStore()
const limit = ref(20)
const records = computed(() => historyStore.records.slice(0, limit.value))

function done() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) })
}

onShow(() => historyStore.refresh())
</script>

<template>
  <view class="safe-page history-page" :class="appearance">
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
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.done { color: var(--primary); font-size: 32rpx; font-weight: 650; }
.load-more { min-height: 48px; background: var(--primary-soft); color: var(--primary); border-radius: 16rpx; }
.records { padding: 20rpx 30rpx 40rpx; }
.empty { padding-top: 210rpx; display: flex; flex-direction: column; align-items: center; color: var(--text-secondary); }
.empty-icon { font-size: 72rpx; }
.empty-title { margin-top: 26rpx; color: var(--text-primary); font-size: 30rpx; font-weight: 650; }
.empty-sub { margin-top: 10rpx; font-size: 23rpx; }
.record-card { background: var(--cell-bg); border-radius: 30rpx; padding: 34rpx 40rpx 40rpx; margin-bottom: 28rpx; box-shadow: 0 9rpx 30rpx rgba(0,0,0,.035); }
.topline { min-height: 80rpx; display: flex; align-items: center; justify-content: space-between; }
.serial { font-size: 70rpx; line-height: 1; font-weight: 850; }
.meta { display: flex; justify-content: space-between; align-items: flex-end; font-size: 26rpx; margin: 20rpx 0 24rpx; }
.meta view { display: flex; flex-direction: column; gap: 8rpx; }
.duration { font-size: 28rpx; font-weight: 600; font-variant-numeric: tabular-nums; }
.mini-board { display: grid; grid-template-columns: repeat(9, 1fr); border: 3rpx solid var(--line-strong); }
.mini-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-right: 1rpx solid var(--line); border-bottom: 1rpx solid var(--line); font-size: 28rpx; font-weight: 620; }
.mini-cell.user { color: var(--primary); }
.mini-cell.strong-right { border-right: 3rpx solid var(--line-strong); }
.mini-cell.strong-bottom { border-bottom: 3rpx solid var(--line-strong); }
.mini-cell.last-col { border-right: 0; }
.mini-cell.last-row { border-bottom: 0; }
</style>
