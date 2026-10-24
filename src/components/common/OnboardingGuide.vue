<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useSafeArea } from '@/composables/useSafeArea'

const props = withDefaults(defineProps<{ context?: 'home' | 'game' | 'settings' }>(), { context: 'home' })
const emit = defineEmits<{ (event: 'finish', action: 'done' | 'skip' | 'practice'): void }>()
const settings = useSettingsStore()
const { statusBarHeight, bottomSafeArea } = useSafeArea()
const safeAreaStyle = computed(() => ({ '--guide-status-bar': `${statusBarHeight.value}px`, '--guide-bottom': `${bottomSafeArea.value}px` }))
const step = ref(0)
const rule = ref<'row' | 'column' | 'box'>('row')
const digits = Array.from({ length: 9 }, (_, index) => index + 1)
// A valid completed board illustrates rules without touching a player's puzzle.
const board = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 9)
  return (row * 3 + Math.floor(row / 3) + index % 9) % 9 + 1
})
const ruleCopy = computed(() => ({ row: '每一行：1 到 9 各出现一次。', column: '每一列：1 到 9 各出现一次。', box: '每个粗线围住的 3×3 宫：1 到 9 各出现一次。' })[rule.value])
const selected = ref(false)
const value = ref(0)
const noteMode = ref(false)
const note = ref(false)
const activeDigit = ref<number | null>(null)
const feedback = ref('')
const numberFirst = computed(() => settings.settings.inputStyle === 'number-first')
const instruction = computed(() => numberFirst.value ? '先点数字 9，再点示例中的空格。' : '先点示例中的空格，再点数字 9。')

function highlighted(index: number) {
  const row = Math.floor(index / 9), column = index % 9
  return rule.value === 'row' ? row === 4 : rule.value === 'column' ? column === 4 : row >= 3 && row < 6 && column >= 3 && column < 6
}

function applyDigit(digit: number) {
  if (!selected.value) { feedback.value = '先点空格，再选择数字。'; return }
  if (digit !== 9) { feedback.value = `这个宫已经有 ${digit}，试试还没有出现的 9。`; return }
  if (noteMode.value) {
    if (value.value) { feedback.value = '先擦除答案，再试着记录草稿。'; return }
    note.value = !note.value
    feedback.value = note.value ? '小数字是候选笔记，还不是答案。关闭草稿后可以正式填数。' : '已移除这条候选笔记。'
  } else {
    value.value = digit
    note.value = false
    feedback.value = '填对了！这个宫中的 1 到 9 都齐了。'
  }
}

function selectCell() {
  selected.value = true
  if (numberFirst.value && activeDigit.value !== null) applyDigit(activeDigit.value)
  else feedback.value = numberFirst.value ? '先选择下方的数字 9，再点这个空格。' : '空格已选中，试着填入 9。'
}

function chooseDigit(digit: number) {
  if (numberFirst.value) {
    activeDigit.value = activeDigit.value === digit ? null : digit
    feedback.value = activeDigit.value === null ? '已取消选择数字。' : `已选 ${digit}，现在点示例中的空格。`
  } else applyDigit(digit)
}

function toggleNotes() {
  noteMode.value = !noteMode.value
  feedback.value = noteMode.value ? '草稿已开启，输入的小数字用来记录可能性。' : '草稿已关闭，现在输入的是答案。'
}

function erase() {
  if (!selected.value) { feedback.value = '先选中示例空格，再擦除。'; return }
  value.value = 0; note.value = false
  feedback.value = '已擦除，可以再试一次。'
}

function finish(action: 'done' | 'skip' | 'practice') {
  settings.dismissOnboarding()
  emit('finish', action)
}

defineExpose({ dismiss: () => finish('skip') })
</script>

<template>
  <view class="onboarding-guide" :style="safeAreaStyle" role="dialog" aria-modal="true" aria-label="数独新手引导" @touchmove.stop>
    <view class="guide-header">
      <view class="guide-brand"><text class="guide-eyebrow">数独 · 新手引导</text><text class="guide-progress" aria-live="polite">{{ step + 1 }} / 3</text></view>
      <button class="guide-button guide-skip" @tap="finish('skip')">跳过</button>
    </view>
    <scroll-view :key="step" scroll-y class="guide-scroll">
      <view class="guide-body">
        <template v-if="step === 0">
          <text class="guide-title">从一个空格开始</text>
          <text class="guide-description">把空格填满。每行、每列、每个宫中的 1 到 9 都不能重复，不用做算术。</text>
          <view class="rule-tabs">
            <button class="guide-button" :class="{ chosen: rule === 'row' }" :aria-pressed="rule === 'row'" @tap="rule = 'row'">看行</button>
            <button class="guide-button" :class="{ chosen: rule === 'column' }" :aria-pressed="rule === 'column'" @tap="rule = 'column'">看列</button>
            <button class="guide-button" :class="{ chosen: rule === 'box' }" :aria-pressed="rule === 'box'" @tap="rule = 'box'">看宫</button>
          </view>
          <view class="rule-board-frame">
            <view class="rule-board-square">
              <view class="rule-board" aria-hidden="true">
                <view v-for="(digit, index) in board" :key="index" class="rule-cell" :class="{ highlighted: highlighted(index), 'box-right': index % 9 === 2 || index % 9 === 5, 'box-bottom': Math.floor(index / 9) === 2 || Math.floor(index / 9) === 5 }">{{ digit }}</view>
              </view>
            </view>
          </view>
          <text class="rule-caption" aria-live="polite">{{ ruleCopy }}</text>
          <text class="guide-tip">题目给定的数字不能修改，从空格寻找突破口。</text>
        </template>

        <template v-else-if="step === 1">
          <text class="guide-title">试着填入一个数字</text>
          <text class="guide-description">这是棋盘中的一个 3×3 宫，已经有 1 到 8，空格该填什么？</text>
          <text class="demo-instruction">{{ instruction }}</text>
          <view class="demo-board">
            <button v-for="digit in digits.slice(0, 8)" :key="digit" class="guide-button demo-given" :aria-label="`给定数字 ${digit}，不可修改`" @tap="feedback = '这是题目给定的数字，不能修改。'">{{ digit }}</button>
            <button class="guide-button demo-empty" :class="{ selected, filled: value }" :aria-pressed="selected" :aria-label="`示例空格${value ? '，已填 9' : note ? '，候选 9' : '，尚未填写'}`" @tap="selectCell">
              <text v-if="value" class="demo-value">{{ value }}</text>
              <text v-else-if="note" class="demo-note">9</text>
              <text v-else class="demo-placeholder">空格</text>
            </button>
          </view>
          <view class="demo-tools">
            <button class="guide-button demo-notes" :class="{ chosen: noteMode }" :aria-pressed="noteMode" @tap="toggleNotes">{{ noteMode ? '草稿已开启' : '草稿' }}</button>
            <button class="guide-button demo-erase" @tap="erase">擦除</button>
          </view>
          <view class="demo-pad">
            <button v-for="digit in digits" :key="digit" class="guide-button demo-digit" :class="{ chosen: activeDigit === digit }" :aria-label="`示例${noteMode ? '候选' : '数字'} ${digit}`" @tap="chooseDigit(digit)">{{ digit }}</button>
          </view>
          <text class="demo-feedback" role="status" aria-live="polite">{{ feedback || '可以试着填数，也可以直接进入下一步。' }}</text>
          <text class="guide-tip">这里只是演示，不计时、不计分，也不会修改你的游戏。</text>
        </template>

        <template v-else>
          <text class="guide-title">按自己的节奏来</text>
          <text class="guide-description">第一次玩，推荐从「无限练习」的入门难度开始。</text>
          <view class="guide-modes">
            <view class="guide-mode"><text class="mode-symbol" aria-hidden="true">∞</text><view><text class="mode-name">无限练习</text><text class="mode-description">自由选难度，从入门到专家。</text></view></view>
            <view class="guide-mode"><text class="mode-symbol" aria-hidden="true">↗</text><view><text class="mode-name">无限闯关</text><text class="mode-description">按关卡前进，难度逐步提升。</text></view></view>
            <view class="guide-mode"><text class="mode-symbol" aria-hidden="true">▦</text><view><text class="mode-name">每日挑战</text><text class="mode-description">每天一道题，离线也能玩。</text></view></view>
          </view>
          <view class="guide-help"><text class="help-title">遇到卡点，慢慢推理</text><text>用草稿记录可能的数字，点「解法」逐步查看推导。使用解法会计入本局提示次数。</text></view>
          <text class="guide-tip">游戏会自动保存进度；首页「技巧课堂」可查看完整教程，设置中可重新查看这份引导。</text>
          <button v-if="context === 'home'" class="guide-button guide-practice" @tap="finish('practice')">去选择入门练习 ›</button>
        </template>
      </view>
    </scroll-view>
    <view class="guide-footer">
      <view class="guide-dots" aria-hidden="true"><view v-for="index in 3" :key="index" :class="{ active: step === index - 1 }"></view></view>
      <view class="guide-actions">
        <button v-if="step > 0" class="guide-button guide-previous" @tap="step--">上一步</button>
        <button v-if="step < 2" class="guide-button guide-next" @tap="step++">下一步</button>
        <button v-else class="guide-button guide-done" @tap="finish('done')">{{ props.context === 'game' ? '回到棋盘' : props.context === 'settings' ? '完成引导' : '准备好了' }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.onboarding-guide { position: fixed; inset: 0; z-index: 1200; height: 100vh; height: 100dvh; display: flex; flex-direction: column; padding-top: max(var(--guide-status-bar), env(safe-area-inset-top)); background: var(--surface); color: var(--text-primary); }
.guide-header, .guide-body, .guide-footer { width: 100%; max-width: 760px; margin: 0 auto; padding-left: 16px; padding-right: 16px; }
.onboarding-guide { padding-left: max(var(--safe-left, 0px), env(safe-area-inset-left)); padding-right: max(var(--safe-right, 0px), env(safe-area-inset-right)); }
.guide-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding-top: 14rpx; padding-bottom: 10rpx; }
.guide-brand { display: flex; flex-direction: column; gap: 8rpx; }
.guide-eyebrow { font-size: clamp(10.2px, 24rpx, 12px); color: var(--primary); font-weight: 650; }
.guide-progress { font-size: clamp(9.35px, 22rpx, 11px); color: var(--text-secondary); }
.guide-button { margin: 0; border: 0; min-height: 48px; border-radius: 16rpx; line-height: 1.4; display: flex; align-items: center; justify-content: center; font-size: clamp(11.48px, 27rpx, 13.5px); background: var(--cell-bg); color: var(--text-primary); }
.guide-button::after { display: none; border: 0; }
.guide-skip { min-width: 64px; padding: 8rpx 12rpx; background: transparent; color: var(--text-secondary); }
.guide-scroll { flex: 1; height: 0; min-height: 0; }
.guide-body { padding-top: 24rpx; padding-bottom: 24rpx; }
.guide-title { display: block; font-size: clamp(17.85px, 42rpx, 21px); line-height: 1.4; font-weight: 750; margin-bottom: 18rpx; }
.guide-description { display: block; font-size: clamp(11.9px, 28rpx, 14px); line-height: 1.7; color: var(--text-secondary); }
.guide-tip { display: block; margin-top: 22rpx; font-size: clamp(10.2px, 24rpx, 12px); line-height: 1.7; color: var(--text-secondary); }
.rule-tabs { display: flex; gap: 14rpx; margin: 26rpx 0; }
.rule-tabs button { flex: 1; }
.guide-button.chosen { background: var(--primary-soft); color: var(--primary); box-shadow: inset 0 0 0 2rpx var(--primary); }
.rule-board-frame { width: 100%; max-width: 540rpx; margin: 0 auto; }
.rule-board-square { width: 100%; }
.rule-board { width: 100%; aspect-ratio: 1; display: grid; grid-template-columns: repeat(9, 1fr); grid-template-rows: repeat(9, 1fr); border: 3rpx solid var(--board-line-strong, var(--line-strong)); background: var(--board-bg, var(--cell-bg)); }
@supports not (aspect-ratio: 1 / 1) {
  .rule-board-square { position: relative; padding-top: 100%; }
  .rule-board { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
  .demo-board button { min-height: 44px; }
}
.rule-cell { display: flex; align-items: center; justify-content: center; font-size: clamp(11.05px, 26rpx, 13px); color: var(--board-given, var(--given-number)); border-right: 1rpx solid var(--board-line, var(--line)); border-bottom: 1rpx solid var(--board-line, var(--line)); }
.rule-cell:nth-child(9n) { border-right: 0; }
.rule-cell:nth-child(n+73) { border-bottom: 0; }
.rule-cell.box-right { border-right: 3rpx solid var(--board-line-strong, var(--line-strong)); }
.rule-cell.box-bottom { border-bottom: 3rpx solid var(--board-line-strong, var(--line-strong)); }
.rule-cell.highlighted { background: var(--board-selected, var(--cell-selected)); font-weight: 750; }
.rule-caption { display: block; margin-top: 20rpx; text-align: center; font-size: clamp(11.05px, 26rpx, 13px); line-height: 1.6; color: var(--primary); }
.demo-instruction { display: block; margin: 20rpx 0; color: var(--primary); font-size: clamp(11.05px, 26rpx, 13px); line-height: 1.6; }
.demo-board { display: grid; grid-template-columns: repeat(3, 1fr); width: 70%; min-width: 168px; max-width: 400rpx; margin: 0 auto; border: 3rpx solid var(--board-line-strong, var(--line-strong)); }
.demo-board button { position: relative; border-radius: 0; aspect-ratio: 1; color: var(--board-given, var(--given-number)); background: var(--board-bg, var(--cell-bg)); border-right: 1rpx solid var(--board-line, var(--line)); border-bottom: 1rpx solid var(--board-line, var(--line)); font-size: var(--digit-font-size); }
.demo-board button:nth-child(3n) { border-right: 0; }
.demo-board button:nth-child(n+7) { border-bottom: 0; }
.demo-board .demo-empty { background: var(--board-related, var(--cell-related)); color: var(--board-accent, var(--primary)); }
.demo-board .demo-empty.selected { background: var(--board-selected, var(--cell-selected)); box-shadow: inset 0 0 0 3rpx var(--board-accent, var(--primary)); }
.demo-placeholder { font-size: clamp(9.78px, 23rpx, 11.5px); }
.demo-note { position: absolute; right: 12%; bottom: 8%; font-size: var(--note-font-size); }
.demo-tools { display: flex; gap: 14rpx; margin: 20rpx 0 14rpx; }
.demo-tools button { flex: 1; }
.demo-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; }
.demo-digit { font-size: clamp(14.45px, 34rpx, 17px); }
.demo-feedback { display: block; min-height: 76rpx; margin-top: 16rpx; font-size: clamp(10.63px, 25rpx, 12.5px); line-height: 1.6; color: var(--primary); }
.guide-modes { margin-top: 28rpx; border-radius: 24rpx; padding: 8rpx 24rpx; background: var(--cell-bg); }
.guide-mode { display: flex; align-items: center; gap: 24rpx; padding: 22rpx 0; border-bottom: 1rpx solid var(--divider); }
.guide-mode:last-child { border-bottom: 0; }
.mode-symbol { width: 44rpx; flex-shrink: 0; text-align: center; color: var(--primary); font-size: clamp(16.15px, 38rpx, 19px); }
.mode-name { display: block; font-size: clamp(12.33px, 29rpx, 14.5px); font-weight: 650; }
.mode-description { display: block; margin-top: 6rpx; font-size: clamp(10.2px, 24rpx, 12px); line-height: 1.6; color: var(--text-secondary); }
.guide-help { margin-top: 22rpx; padding: 24rpx; border-radius: 22rpx; background: var(--primary-soft); color: var(--text-secondary); font-size: clamp(10.63px, 25rpx, 12.5px); line-height: 1.7; }
.help-title { display: block; margin-bottom: 8rpx; color: var(--text-primary); font-weight: 650; }
.guide-practice { margin-top: 22rpx; width: 100%; color: var(--primary); background: var(--primary-soft); }
.guide-footer { flex-shrink: 0; padding-top: 16rpx; padding-bottom: calc(20rpx + max(var(--guide-bottom), env(safe-area-inset-bottom))); border-top: 1rpx solid var(--divider); }
.guide-dots { display: flex; justify-content: center; gap: 10rpx; margin-bottom: 16rpx; }
.guide-dots view { width: 12rpx; height: 12rpx; border-radius: 50%; background: var(--divider); }
.guide-dots .active { width: 32rpx; border-radius: 8rpx; background: var(--primary); }
.guide-actions { display: flex; gap: 16rpx; }
.guide-previous { flex: 1; }
.guide-next, .guide-done { flex: 2; background: var(--primary); color: var(--page-bg); }
</style>
