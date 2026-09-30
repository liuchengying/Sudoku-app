<script setup lang="ts">
withDefaults(defineProps<{
  noteMode: boolean
  canUndo: boolean
  canRedo: boolean
  disabled?: boolean
}>(), { noteMode: false, canUndo: false, canRedo: false })

const emit = defineEmits<{
  (event: 'candidates'): void
  (event: 'candidates-all'): void
  (event: 'hint'): void
  (event: 'erase'): void
  (event: 'note'): void
  (event: 'undo'): void
  (event: 'redo'): void
}>()
</script>

<template>
  <view class="toolbar-wrap" :class="{ disabled }">
    <view class="toolbar">
      <view class="tool" @tap="emit('candidates')" @longpress="emit('candidates-all')">
        <view class="icon-circle"><text class="glyph flag">⚑</text></view><text class="label"><text class="dot">●</text>候选</text>
      </view>
      <view class="tool" @tap="emit('hint')">
        <view class="icon-circle"><text class="glyph">✣</text></view><text class="label"><text class="dot">●</text>解法</text>
      </view>
      <view class="tool" @tap="emit('erase')">
        <view class="icon-circle"><text class="glyph">◇</text></view><text class="label">擦除</text>
      </view>
      <view class="tool" :class="{ active: noteMode }" @tap="emit('note')">
        <view class="icon-circle"><text class="glyph pencil">✎</text></view><text class="label">草稿</text>
      </view>
    </view>
    <view class="undo-row">
      <text class="undo" :class="{ off: !canUndo }" @tap="canUndo && emit('undo')">↶ 撤销</text>
      <text class="divider">·</text>
      <text class="undo" :class="{ off: !canRedo }" @tap="canRedo && emit('redo')">重做 ↷</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.toolbar-wrap { padding-top: 12rpx; }
.toolbar-wrap.disabled { opacity: .45; pointer-events: none; }
.toolbar { display: grid; grid-template-columns: repeat(4, 1fr); padding: 0 54rpx; }
.tool { min-height: 48px; display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.icon-circle { width: 80rpx; height: 80rpx; border-radius: 50%; background: var(--surface); display: flex; align-items: center; justify-content: center; transition: .12s; }
.glyph { color: var(--primary); font-size: 52rpx; line-height: 1; }
.flag { font-size: 56rpx; }
.pencil { font-size: 55rpx; }
.label { font-size: 28rpx; color: var(--text-primary); font-weight: 600; }
.dot { color: #f7bb2c; font-size: 22rpx; margin-right: 5rpx; }
.tool.active .icon-circle { background: var(--primary-soft); box-shadow: inset 0 0 0 3rpx var(--primary); }
.tool.active .label { color: var(--primary); }
.undo-row { min-height: 48px; margin-top: 6rpx; display: flex; align-items: center; justify-content: center; gap: 22rpx; color: var(--primary); font-size: 23rpx; }
.undo.off { color: #c6c7ca; }
.divider { color: #d4d4d6; }
</style>
