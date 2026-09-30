<script setup lang="ts">
import type { SudokuLevel } from '@/core/sudoku'
import type { LevelProgress } from '@/types/progress'
import MedalBadge from '@/components/common/MedalBadge.vue'

withDefaults(defineProps<{
  levels: SudokuLevel[]
  selectedLevelId: string | null
  currentLevelId?: string | null
  progressMap: Record<string, LevelProgress>
}>(), { currentLevelId: null })

defineEmits<{ (event: 'select', level: SudokuLevel): void }>()
</script>

<template>
  <view class="level-grid">
    <view
      v-for="level in levels"
      :key="level.id"
      class="level"
      :class="{
        selected: level.id === selectedLevelId,
        completed: progressMap[level.id]?.completed,
        playing: level.id === currentLevelId
      }"
      @tap="$emit('select', level)"
    >
      <MedalBadge v-if="progressMap[level.id]?.bestMedal" :medal="progressMap[level.id].bestMedal!" size="small" />
      <text v-else class="number">{{ level.levelNo }}</text>
      <view v-if="level.id === currentLevelId" class="playing-dot"></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.level-grid { padding: 18rpx 18rpx 20rpx; display: grid; grid-template-columns: repeat(5, 1fr); gap: 20rpx 24rpx; border: 3rpx solid #e0efff; background: rgba(255,255,255,.65); }
.level { position: relative; height: 126rpx; border-radius: 10rpx; background: #e6e7e9; display: flex; align-items: center; justify-content: center; color: #b9babd; font-size: 44rpx; transition: .1s; }
.level.selected { background: #cee4fb; color: var(--primary); box-shadow: inset 0 0 0 5rpx var(--primary); }
.level.completed { background: #d8e9fb; }
.number { font-weight: 500; }
.playing-dot { position: absolute; right: 10rpx; top: 10rpx; width: 14rpx; height: 14rpx; border-radius: 50%; background: var(--primary); box-shadow: 0 0 0 4rpx rgba(10,124,255,.15); }
</style>
