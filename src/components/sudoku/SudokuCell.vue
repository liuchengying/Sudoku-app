<script setup lang="ts">
import { computed } from 'vue'
import { hasDigit } from '@/core/sudoku'
import type { SudokuCell } from '@/core/sudoku'

const props = defineProps<{
  cell: SudokuCell
  selected: boolean
  related: boolean
  sameValue: boolean
  highlightDigit?: number
  focus?: boolean
}>()

defineEmits<{ (event: 'select', index: number): void }>()

const row = computed(() => Math.floor(props.cell.index / 9))
const col = computed(() => props.cell.index % 9)
const noteDigits = computed(() => Array.from({ length: 9 }, (_, i) => i + 1))
</script>

<template>
  <view
    class="cell"
    :class="{
      selected,
      related,
      same: sameValue,
      error: cell.error,
      given: cell.origin === 'GIVEN',
      user: cell.origin === 'USER',
      hint: cell.origin === 'HINT',
      focus,
      'strong-right': col === 2 || col === 5,
      'strong-bottom': row === 2 || row === 5,
      'last-col': col === 8,
      'last-row': row === 8
    }"
    :aria-label="`第 ${row + 1} 行第 ${col + 1} 列，${cell.origin === 'GIVEN' ? '题目数字' : cell.origin === 'HINT' ? '提示数字' : '可编辑'}，${cell.value || '空格'}${cell.error ? '，填写有误' : ''}${cell.notesMask ? '，候选 ' + noteDigits.filter(d => hasDigit(cell.notesMask, d)).join('、') : ''}`"
    @tap="$emit('select', cell.index)"
  >
    <text v-if="cell.value" class="value">{{ cell.value }}</text>
    <view v-else-if="cell.notesMask" class="notes">
      <text v-for="digit in noteDigits" :key="digit" class="note" :class="{ 'note-highlight': highlightDigit === digit && hasDigit(cell.notesMask, digit) }">{{ hasDigit(cell.notesMask, digit) ? digit : '' }}</text>
    </view>
    <text v-if="cell.error" class="error-mark">!</text>
    <view v-if="cell.origin === 'HINT'" class="hint-dot"></view>
  </view>
</template>

<style scoped lang="scss">
.cell { position: relative; min-width: 0; min-height: 0; background: var(--cell-bg); display: flex; align-items: center; justify-content: center; border-right: 1rpx solid var(--line); border-bottom: 1rpx solid var(--line); transition: background .08s ease; overflow: hidden; }
.cell.related { background: var(--cell-related); }
.cell.same { background: var(--cell-same); }
.cell.selected { background: var(--cell-selected); box-shadow: inset 0 0 0 4rpx var(--primary); z-index: 2; }
.cell.strong-right { border-right: 4rpx solid var(--line-strong); }
.cell.strong-bottom { border-bottom: 4rpx solid var(--line-strong); }
.cell.last-col { border-right: 0; }
.cell.last-row { border-bottom: 0; }
.value { font-size: var(--digit-font-size); line-height: 1; font-weight: 600; color: var(--primary); font-variant-numeric: tabular-nums; }
.cell.given .value { color: var(--given-number); font-weight: 650; }
.cell.hint .value { color: var(--hint); }
.cell.error .value { color: var(--error); }
.notes { position: absolute; inset: 4rpx; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
.note { display: flex; align-items: center; justify-content: center; font-size: var(--note-font-size); line-height: 1; color: var(--primary); font-weight: 560; }
.note-highlight { background: var(--primary-soft); font-weight: 800; border-radius: 4rpx; }
.cell.focus { box-shadow: inset 0 0 0 3rpx var(--hint); }
.error-mark { position: absolute; right: 2rpx; bottom: 2rpx; color: var(--error); font-size: 20rpx; font-weight: 800; }
.hint-dot { position: absolute; right: 7rpx; top: 7rpx; width: 8rpx; height: 8rpx; border-radius: 50%; background: var(--hint); opacity: .65; }
</style>
