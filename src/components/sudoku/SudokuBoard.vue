<script setup lang="ts">
import { computed } from 'vue'
import { boxOf, colOf, rowOf, type SudokuCell } from '@/core/sudoku'
import SudokuCellView from './SudokuCell.vue'

const props = withDefaults(defineProps<{
  cells: SudokuCell[]
  selectedIndex: number | null
  highlightRelated?: boolean
  highlightSameDigit?: boolean
  interactive?: boolean
  activeDigit?: number | null
  focusIndexes?: number[]
  showErrors?: boolean
  inverse?: Array<{ index: number; mask: number }>
}>(), { highlightRelated: true, highlightSameDigit: true, interactive: true, showErrors: true, inverse: () => [] })

const emit = defineEmits<{ (event: 'select', index: number): void }>()

const selectedValue = computed(() => props.activeDigit ?? (props.selectedIndex == null ? 0 : (props.cells[props.selectedIndex]?.value ?? 0)))
const highlightDigit = computed(() => props.inverse.length ? 0 : (props.highlightSameDigit ? selectedValue.value : 0))
const inverseMap = computed(() => new Map(props.inverse.map(item => [item.index, item.mask])))

function related(index: number): boolean {
  if (!props.highlightRelated || props.selectedIndex == null || index === props.selectedIndex) return false
  return rowOf(index) === rowOf(props.selectedIndex)
    || colOf(index) === colOf(props.selectedIndex)
    || boxOf(index) === boxOf(props.selectedIndex)
}

function sameValue(cell: SudokuCell): boolean {
  return Boolean(!props.inverse.length && props.highlightSameDigit && selectedValue.value && cell.value === selectedValue.value)
}

function inverse(cell: SudokuCell): boolean {
  return inverseMap.value.has(cell.index)
}

function inverseMask(cell: SudokuCell): number {
  return inverseMap.value.get(cell.index) ?? 0
}

function select(index: number) {
  if (props.interactive) emit('select', index)
}
</script>

<template>
  <view class="board-frame">
    <view class="board">
      <SudokuCellView
        v-for="cell in cells"
        :key="cell.index"
        :cell="cell"
        :show-errors="showErrors"
        :selected="cell.index === selectedIndex"
        :related="related(cell.index)"
        :same-value="sameValue(cell)"
        :inverse="inverse(cell)"
        :inverse-mask="inverseMask(cell)"
        :highlight-digit="highlightDigit"
        :focus="focusIndexes?.includes(cell.index) ?? false"
        @select="select"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.board-frame { width: 100%; }
.board { width: 100%; aspect-ratio: 1 / 1; display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); grid-template-rows: repeat(9, minmax(0, 1fr)); border: 2px solid var(--board-line-strong, var(--line-strong)); background: var(--board-bg, var(--cell-bg)); overflow: hidden; }
@supports not (aspect-ratio: 1 / 1) {
  .board-frame { position: relative; padding-top: 100%; }
  .board { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
}
</style>
