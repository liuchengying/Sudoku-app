<script setup lang="ts">
import { computed } from 'vue'
import { hasDigit } from '@/core/sudoku'
import type { SudokuCell } from '@/core/sudoku'

const props = withDefaults(defineProps<{
  cell: SudokuCell
  selected: boolean
  related: boolean
  sameValue: boolean
  inverse?: boolean
  inverseMask?: number
  highlightDigit?: number
  focus?: boolean
  showErrors?: boolean
}>(), { showErrors: true, inverse: false, inverseMask: 0 })

defineEmits<{ (event: 'select', index: number): void }>()

const row = computed(() => Math.floor(props.cell.index / 9))
const col = computed(() => props.cell.index % 9)
const noteDigits = computed(() => Array.from({ length: 9 }, (_, i) => i + 1))
const visibleError = computed(() => props.showErrors && props.cell.error)
// Inverse mode renders the cell's own full candidates inside the lit cell.
const displayMask = computed(() => props.inverseMask || props.cell.notesMask)
</script>

<template>
  <view
    class="cell"
    :class="{
      selected,
      related,
      same: sameValue,
      inverse,
      error: visibleError,
      given: cell.origin === 'GIVEN',
      user: cell.origin === 'USER',
      hint: cell.origin === 'HINT',
      focus,
      'strong-right': col === 2 || col === 5,
      'strong-bottom': row === 2 || row === 5,
      'last-col': col === 8,
      'last-row': row === 8
    }"
    :aria-label="`第 ${row + 1} 行第 ${col + 1} 列，${cell.origin === 'GIVEN' ? '题目数字' : cell.origin === 'HINT' ? '提示数字' : '可编辑'}，${cell.value || '空格'}${visibleError ? '，填写有误' : ''}${cell.notesMask ? '，候选 ' + noteDigits.filter(d => hasDigit(cell.notesMask, d)).join('、') : ''}`"
    @tap="$emit('select', cell.index)"
  >
    <text v-if="cell.value" class="value">{{ cell.value }}</text>
    <view v-else-if="displayMask" class="notes">
      <text v-for="digit in noteDigits" :key="digit" class="note" :class="{ 'note-highlight': highlightDigit === digit && hasDigit(displayMask, digit) }">{{ hasDigit(displayMask, digit) ? digit : '' }}</text>
    </view>
    <text v-if="visibleError" class="error-mark">!</text>
    <view v-if="cell.origin === 'HINT'" class="hint-dot"></view>
  </view>
</template>

<style scoped lang="scss">
.cell { position: relative; min-width: 0; min-height: 0; background: var(--board-bg, var(--cell-bg)); display: flex; align-items: center; justify-content: center; border-right: 1px solid var(--board-line, var(--line)); border-bottom: 1px solid var(--board-line, var(--line)); transition: background .08s ease; overflow: hidden; }
.cell.related { background: var(--board-related, var(--cell-related)); }
.cell.same { background: var(--board-same, var(--cell-same)); }
.cell.inverse { background: var(--board-inverse, var(--board-same, var(--cell-same))); }
.cell.selected { background: var(--board-selected, var(--cell-selected)); box-shadow: inset 0 0 0 2px var(--board-accent, var(--primary)); z-index: 2; }
.cell.strong-right { border-right: 2px solid var(--board-line-strong, var(--line-strong)); }
.cell.strong-bottom { border-bottom: 2px solid var(--board-line-strong, var(--line-strong)); }
.cell.last-col { border-right: 0; }
.cell.last-row { border-bottom: 0; }
.value { font-size: var(--digit-font-size); line-height: 1; font-weight: 450; color: var(--board-accent, var(--primary)); font-variant-numeric: tabular-nums; }
.cell.given .value { color: var(--board-given, var(--given-number)); font-weight: 450; }
.cell.hint .value { color: var(--board-hint, var(--hint)); }
.cell.error .value { color: var(--board-error, var(--error)); }
.notes { position: absolute; inset: 2px; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
.note { display: flex; align-items: center; justify-content: center; font-size: var(--note-font-size); line-height: 1; color: var(--board-accent, var(--primary)); font-weight: 560; }
.note-highlight { background: var(--board-hit-bg, var(--hit-bg)); color: var(--board-hit-fg, var(--hit-fg)); font-weight: 700; border-radius: 6rpx; box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, .25); animation: note-hit-pulse 1.1s ease-in-out infinite; }
@keyframes note-hit-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.14); } }
@media (prefers-reduced-motion: reduce) { .note-highlight { animation: none; } }
.cell.focus { box-shadow: inset 0 0 0 2px var(--board-hint, var(--hint)); }
.error-mark { position: absolute; right: 2rpx; bottom: 2rpx; color: var(--board-error, var(--error)); font-size: clamp(8.5px, 20rpx, 10px); font-weight: 800; }
.hint-dot { position: absolute; right: 7rpx; top: 7rpx; width: 8rpx; height: 8rpx; border-radius: 50%; background: var(--board-hint, var(--hint)); opacity: .65; }
</style>
