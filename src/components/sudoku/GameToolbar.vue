<script setup lang="ts">
withDefaults(defineProps<{
  noteMode: boolean
  canUndo: boolean
  canRedo: boolean
  disabled?: boolean
  allCandidates?: boolean
  inverse?: boolean
}>(), { noteMode: false, canUndo: false, canRedo: false, allCandidates: false, inverse: false })

const emit = defineEmits<{
  (event: 'candidates'): void
  (event: 'candidates-all'): void
  (event: 'inverse'): void
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
      <view class="tool" :class="{ active: allCandidates }" aria-label="全部候选" @tap="emit('candidates-all')">
        <view class="icon-circle"><text class="glyph grid">▦</text></view><text class="label">全候选</text>
      </view>
      <view class="tool" :class="{ active: inverse }" aria-label="反向候选" @tap="emit('inverse')">
        <view class="icon-circle"><text class="glyph swap">⇄</text></view><text class="label">反候选</text>
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
.toolbar { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; padding: 0; }
.tool { min-height: 48px; display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.icon-circle { width: 40px; height: 40px; border-radius: 50%; background: var(--surface); display: flex; align-items: center; justify-content: center; transition: .12s; }
.glyph { color: var(--primary); font-size: clamp(20.4px, 48rpx, 24px); line-height: 1; }
.flag { font-size: clamp(23.8px, 56rpx, 28px); }
.pencil { font-size: clamp(23.38px, 55rpx, 27.5px); }
.grid { font-size: clamp(21.25px, 50rpx, 25px); }
.swap { font-size: clamp(22.1px, 52rpx, 26px); font-weight: 700; }
.label { font-size: clamp(11.05px, 26rpx, 13px); color: var(--text-primary); font-weight: 600; white-space: nowrap; }
.dot { color: #f7bb2c; font-size: clamp(9.35px, 22rpx, 11px); margin-right: 5rpx; }
.tool.active .icon-circle { background: var(--hit-bg, var(--primary)); box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, .2); }
.tool.active .glyph { color: var(--hit-fg, #ffffff); }
.tool.active .label { color: var(--primary); font-weight: 700; }
.undo-row { min-height: 48px; margin-top: 6rpx; display: flex; align-items: center; justify-content: center; gap: 22rpx; color: var(--primary); font-size: clamp(9.78px, 23rpx, 11.5px); }
.undo.off { color: #c6c7ca; }
.divider { color: #d4d4d6; }
</style>
