<script setup lang="ts">
import { computed } from 'vue'
import type { SudokuCell } from '@/core/sudoku'
const props = withDefaults(defineProps<{ cells: SudokuCell[]; disabled?: boolean; disableCompletedDigit?: boolean; noteMode?: boolean; activeDigit?: number | null; showRemaining?: boolean }>(), { disabled: false, disableCompletedDigit: true, noteMode: false, activeDigit: null, showRemaining: true })
const emit = defineEmits<{ (event: 'answer', digit: number): void }>()
const digits = Array.from({ length: 9 }, (_, i) => i + 1)
const remaining = computed(() => digits.map(d => Math.max(0, 9 - props.cells.filter(c => c.value === d && c.value === c.solution).length)))
function blocked(d: number) { return props.disabled || Boolean(!props.noteMode && props.disableCompletedDigit && remaining.value[d - 1] === 0) }
</script>
<template>
  <view class="number-pad" :class="{ disabled, 'note-mode': noteMode }">
    <button v-for="digit in digits" :key="digit" class="answer-key" :class="{ completed: blocked(digit), active: digit === activeDigit }" :disabled="blocked(digit)" :aria-label="`${noteMode ? '候选' : '数字'} ${digit}${showRemaining ? '，还剩 ' + remaining[digit - 1] + ' 个' : ''}`" @tap="!blocked(digit) && emit('answer', digit)">
      <text class="digit">{{ digit }}</text><text class="remaining">{{ noteMode ? '草稿' : showRemaining ? `余 ${remaining[digit - 1]}` : '填写' }}</text>
    </button>
  </view>
</template>
<style scoped>
.number-pad { padding: 10rpx 24rpx 16rpx; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10rpx; }
.answer-key { min-height: 48px; height: 90rpx; display: flex; align-items: center; justify-content: center; gap: 16rpx; background: var(--surface); color: var(--text-primary); border-radius: 14rpx; }
.digit { font-size: 46rpx; font-weight: 650; }
.remaining { font-size: 20rpx; color: var(--text-secondary); }
.note-mode .answer-key, .answer-key.active { background: var(--primary-soft); color: var(--primary); }
.answer-key.active { box-shadow: inset 0 0 0 3rpx var(--primary); }
.answer-key.completed { opacity: .3; }
.number-pad.disabled { opacity: .5; }
</style>
