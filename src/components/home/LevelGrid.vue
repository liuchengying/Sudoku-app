<script setup lang="ts">
import type { CampaignSlot } from '@/config/campaign'
import type { LevelProgress } from '@/types/progress'
import MedalBadge from '@/components/common/MedalBadge.vue'

withDefaults(defineProps<{
  levels: CampaignSlot[]
  selectedLevelId: string | null
  currentLevelId?: string | null
  progressMap: Record<string, LevelProgress>
  disabled?: boolean
}>(), { currentLevelId: null, disabled: false })

defineEmits<{ (event: 'select', level: CampaignSlot): void }>()
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
      @tap="!disabled && $emit('select', level)"
    >
      <MedalBadge v-if="progressMap[level.id]?.bestMedal" :medal="progressMap[level.id].bestMedal!" size="small" />
      <text v-else class="number" :class="{ 'long-number': level.levelNo > 9999 }">{{ level.levelNo }}</text>
      <view v-if="level.id === currentLevelId" class="playing-dot"></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.level-grid { margin-top: 18rpx; padding: 12rpx; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12rpx; background: var(--surface); border-radius: 20rpx; }
.level { position: relative; aspect-ratio: 1; min-height: 48px; border-radius: 10rpx; background: var(--cell-bg); display: flex; align-items: center; justify-content: center; color: var(--text-primary); font-size: 36rpx; }
.level.selected { background: var(--cell-selected); color: var(--primary); box-shadow: inset 0 0 0 3rpx var(--primary); }
.level.completed { background: var(--primary-soft); }

.number { font-weight: 500; }
.number.long-number { font-size: 24rpx; overflow-wrap: anywhere; text-align: center; }
.playing-dot { position: absolute; right: 10rpx; top: 10rpx; width: 14rpx; height: 14rpx; border-radius: 50%; background: var(--primary); box-shadow: 0 0 0 4rpx rgba(10,124,255,.15); }
@media (max-width: 360px) { .level-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
