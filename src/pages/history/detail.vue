<script setup lang="ts">
import { useAppearance } from '@/composables/useAppearance'
import { back } from '@/composables/useNavigation'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import SudokuBoard from '@/components/sudoku/SudokuBoard.vue'
import { replayCells, type SudokuCell } from '@/core/sudoku'
import { useHistoryStore } from '@/stores/history.store'
import type { GameRecord } from '@/types/progress'
import { recordTitle } from '@/utils/game-label'
import { formatDate, formatDuration } from '@/utils/time'

const appearance = useAppearance()

const historyStore = useHistoryStore()
const record = ref<GameRecord | null>(null)
const replayIndex = ref(0)

onLoad((query) => {
  historyStore.refresh()
  if (query?.id) {
    record.value = historyStore.find(String(query.id))
    replayIndex.value = record.value?.timeline.length ?? 0
  }
})

const title = computed(() => record.value ? recordTitle(record.value) : '历史详情')
const displayCells = computed<SudokuCell[]>(() => record.value ? replayCells(record.value, replayIndex.value) : [])

function changeReplay(event: { detail: { value: number } }) {
  replayIndex.value = Math.max(0, Math.min(record.value?.timeline.length ?? 0, Number(event.detail.value) || 0))
}

function step(delta: number) {
  if (!record.value) return
  replayIndex.value = Math.max(0, Math.min(record.value.timeline.length, replayIndex.value + delta))
}
</script>

<template>
  <view class="safe-page detail-page" :class="appearance">
    <AppHeader :title="title">
      <template #left><text class="back" @tap="back">‹</text></template>
    </AppHeader>

    <view v-if="record" class="content">
      <view class="summary">
        <text>{{ formatDate(record.completedAt) }}</text>
        <text>{{ formatDuration(record.elapsedTime) }}</text>
        <text>错误 {{ record.mistakeCount }}</text>
        <text>提示 {{ record.hintCount }}</text>
      </view>

      <view class="board-shell"><SudokuBoard :cells="displayCells" :selected-index="null" :interactive="false" :highlight-related="false" :highlight-same-digit="false" /></view>

      <view class="replay-card">
        <view class="replay-title"><text>复盘</text><text>{{ replayIndex }} / {{ record.timeline.length }}</text></view>
        <text v-if="record.timelineTruncated && record.timeline.length > 0" class="replay-empty">复盘从保留的起点开始，较早操作已归档。</text>
        <text v-if="record.timeline.length === 0" class="replay-empty">本条记录仅保留最终棋盘。</text>
        <slider
          v-if="record.timeline.length > 0"
          :value="replayIndex"
          :min="0"
          :max="record.timeline.length"
          :step="1"
          active-color="#0a7cff"
          background-color="#d9dde3"
          block-color="#0a7cff"
          block-size="18"
          @changing="changeReplay"
          @change="changeReplay"
        />
        <view v-if="record.timeline.length > 0" class="replay-actions">
          <button :disabled="replayIndex <= 0" @tap="step(-1)">上一步</button>
          <button :disabled="replayIndex >= record.timeline.length" @tap="step(1)">下一步</button>
          <button @tap="replayIndex = record.timeline.length">最终棋盘</button>
        </view>
      </view>

      <view class="legend">
        <view class="legend-item"><view class="legend-dot black"></view><text>题目数字</text></view>
        <view class="legend-item"><view class="legend-dot blue"></view><text>玩家/提示数字</text></view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.detail-page { background: var(--page-bg); }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.content { padding: 10rpx 20rpx 40rpx; }
.summary { display: flex; justify-content: space-around; color: var(--text-secondary); font-size: 23rpx; margin: 12rpx 0 25rpx; }
.board-shell { width: 100%; }
.replay-card { margin-top: 30rpx; padding: 24rpx 20rpx 20rpx; background: var(--surface); border-radius: 22rpx; }
.replay-title { display: flex; justify-content: space-between; padding: 0 12rpx 6rpx; font-size: 25rpx; color: var(--text-secondary); }
.replay-title text:first-child { color: var(--text-primary); font-size: 28rpx; font-weight: 650; }
.replay-empty { display: block; padding: 18rpx 12rpx 10rpx; color: var(--text-secondary); font-size: 22rpx; line-height: 1.5; }
.replay-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; margin-top: 8rpx; }
.replay-actions button { height: 72rpx; border-radius: 15rpx; background: var(--cell-bg); color: var(--primary); font-size: 24rpx; display: flex; align-items: center; justify-content: center; }
.replay-actions button[disabled] { color: #b8bbc0; opacity: .6; }
.legend { margin-top: 24rpx; display: flex; justify-content: center; gap: 36rpx; color: var(--text-secondary); font-size: 23rpx; }
.legend-item { display: flex; align-items: center; gap: 9rpx; }
.legend-dot { width: 14rpx; height: 14rpx; border-radius: 50%; }
.legend-dot.black { background: #111; }
.legend-dot.blue { background: #1768b6; }
</style>
