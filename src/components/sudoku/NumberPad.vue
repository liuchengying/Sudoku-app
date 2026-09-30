<script setup lang="ts">
import { computed } from 'vue'
import type { SudokuCell } from '@/core/sudoku'

const props = withDefaults(defineProps<{
  cells: SudokuCell[]
  disabled?: boolean
  disableCompletedDigit?: boolean
  noteMode?: boolean
}>(), { disabled: false, disableCompletedDigit: true, noteMode: false })

const emit = defineEmits<{
  (event: 'answer', digit: number): void
  (event: 'note', digit: number): void
}>()

const digits = Array.from({ length: 9 }, (_, index) => index + 1)
const remaining = computed(() => digits.map((digit) => {
  const correctPlaced = props.cells.filter((cell) => cell.value === digit && !cell.error).length
  return Math.max(0, 9 - correctPlaced)
}))

function blocked(digit: number): boolean {
  return props.disabled || Boolean(props.disableCompletedDigit && remaining.value[digit - 1] === 0)
}
</script>

<template>
  <view class="number-pad" :class="{ disabled }">
    <view class="candidate-row">
      <view
        v-for="digit in digits"
        :key="`n-${digit}`"
        class="candidate-key"
        :class="{ completed: blocked(digit) }"
        @tap="!blocked(digit) && emit('note', digit)"
      >
        <text class="remaining-dots">{{ '•'.repeat(Math.min(remaining[digit - 1], 9)) }}</text>
        <text class="candidate-digit">{{ digit }}</text>
      </view>
    </view>

    <view class="answer-row" :class="{ 'note-mode': noteMode }">
      <view
        v-for="digit in digits"
        :key="`a-${digit}`"
        class="answer-key"
        :class="{ completed: blocked(digit) }"
        @tap="!blocked(digit) && emit('answer', digit)"
      >{{ digit }}</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.number-pad { padding: 6rpx 30rpx 16rpx; user-select: none; }
.candidate-row, .answer-row { display: grid; grid-template-columns: repeat(9, 1fr); align-items: end; }
.candidate-row { min-height: 102rpx; }
.candidate-key { min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
.remaining-dots { height: 24rpx; max-width: 62rpx; overflow: hidden; color: var(--primary); font-size: 17rpx; line-height: 20rpx; letter-spacing: -1rpx; white-space: nowrap; opacity: .85; }
.candidate-digit { margin-top: 2rpx; color: var(--primary); font-size: 58rpx; font-weight: 620; line-height: 1.1; }
.answer-row { margin-top: 10rpx; align-items: center; }
.answer-key { height: 86rpx; display: flex; align-items: center; justify-content: center; color: #65676b; font-size: 58rpx; font-weight: 520; border-radius: 14rpx; }
.answer-row.note-mode .answer-key { color: var(--primary); background: rgba(10,124,255,.055); }
.candidate-key.completed, .answer-key.completed { opacity: .20; }
.number-pad.disabled { opacity: .45; pointer-events: none; }
</style>
