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
}>(), { highlightRelated: true, highlightSameDigit: true, interactive: true })

const emit = defineEmits<{ (event: 'select', index: number): void }>()

const selectedValue = computed(() => props.selectedIndex == null ? 0 : (props.cells[props.selectedIndex]?.value ?? 0))

function related(index: number): boolean {
  if (!props.highlightRelated || props.selectedIndex == null || index === props.selectedIndex) return false
  return rowOf(index) === rowOf(props.selectedIndex)
    || colOf(index) === colOf(props.selectedIndex)
    || boxOf(index) === boxOf(props.selectedIndex)
}

function sameValue(cell: SudokuCell): boolean {
  return Boolean(props.highlightSameDigit && selectedValue.value && cell.value === selectedValue.value)
}

function select(index: number) {
  if (props.interactive) emit('select', index)
}
</script>

<template>
  <view class="board">
    <SudokuCellView
      v-for="cell in cells"
      :key="cell.index"
      :cell="cell"
      :selected="cell.index === selectedIndex"
      :related="related(cell.index)"
      :same-value="sameValue(cell)"
      @select="select"
    />
  </view>
</template>

<style scoped lang="scss">
.board { width: 100%; aspect-ratio: 1 / 1; display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); grid-template-rows: repeat(9, minmax(0, 1fr)); border: 4rpx solid var(--line-strong); background: var(--cell-bg); overflow: hidden; }
</style>
