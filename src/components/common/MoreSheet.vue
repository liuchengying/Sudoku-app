<script setup lang="ts">
import BottomSheet from './BottomSheet.vue'

withDefaults(defineProps<{
  modelValue: boolean
  gameMode?: boolean
}>(), { gameMode: false })

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'action', action: string): void
}>()

const mainGroups = [
  [
    { id: 'history', icon: '◷', label: '历史记录' },
    { id: 'statistics', icon: '▥', label: '统计与成就' },
    { id: 'daily', icon: '▦', label: '每日挑战' },
    { id: 'import', icon: '+', label: '导入题目' }
  ],
  [
    { id: 'basic', icon: '▤', label: '基础技巧' },
    { id: 'advanced', icon: '▤', label: '高级技巧' },
    { id: 'rules', icon: '▣', label: '玩法' },
    { id: 'settings', icon: '⚙', label: '设置' }
  ],
  [
    { id: 'share', icon: '⇧', label: '分享 App' }
  ]
]

function action(id: string) {
  emit('update:modelValue', false)
  emit('action', id)
}
</script>

<template>
  <BottomSheet :model-value="modelValue" title="更多" @update:model-value="emit('update:modelValue', $event)">
    <view v-if="gameMode" class="group game-actions">
      <view class="row" @tap="action('check')"><text class="icon">✓</text><text class="label">检查当前棋盘</text><text class="arrow">›</text></view>
      <view class="row" @tap="action('bookmark')"><text class="icon">⚑</text><text class="label">保存棋盘书签</text><text class="arrow">›</text></view>
      <view class="row" @tap="action('restore-bookmark')"><text class="icon">↶</text><text class="label">恢复棋盘书签</text><text class="arrow">›</text></view>
      <view class="row" @tap="action('fill-candidates')"><text class="icon">⋯</text><text class="label">填充全部候选</text><text class="arrow">›</text></view>
      <view class="row" @tap="action('restart')"><text class="icon">↻</text><text class="label">重新开始本关</text><text class="arrow">›</text></view>
      <view class="row" @tap="action('exit')"><text class="icon">←</text><text class="label">退出并保存</text><text class="arrow">›</text></view>
    </view>

    <view v-for="(group, groupIndex) in mainGroups" :key="groupIndex" class="group">
      <view v-for="item in group" :key="item.id" class="row" @tap="action(item.id)">
        <text class="icon">{{ item.icon }}</text>
        <text class="label">{{ item.label }}</text>
        <text class="arrow">›</text>
      </view>
    </view>
  </BottomSheet>
</template>

<style scoped lang="scss">
.group { margin: 20rpx 32rpx; background: var(--cell-bg); border-radius: 22rpx; overflow: hidden; }
.group:first-child { margin-top: 8rpx; }
.row { min-height: max(94rpx, 48px); padding: 0 28rpx; display: flex; align-items: center; border-bottom: 1rpx solid var(--divider); }
.row:last-child { border-bottom: 0; }
.icon { width: 68rpx; font-size: 38rpx; text-align: left; color: var(--text-primary); }
.label { flex: 1; font-size: 31rpx; font-weight: 560; color: var(--text-primary); }
.arrow { color: #b8b8bc; font-size: 52rpx; font-weight: 300; }
.game-actions .row:last-child .label { color: #d84a43; }
</style>
