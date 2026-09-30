<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '@/components/common/AppHeader.vue'
import { useAppearance } from '@/composables/useAppearance'
import { back, openPage } from '@/composables/useNavigation'
import { importPuzzle } from '@/services/puzzle.service'
import { tierName } from '@/config/practice'
import { useGameStore } from '@/stores/game.store'
import type { SudokuLevel } from '@/core/sudoku'

const appearance = useAppearance()
const game = useGameStore()
const input = ref('')
const error = ref('')
const checked = ref<SudokuLevel | null>(null)
function validate() {
  try { checked.value = importPuzzle(input.value); error.value = '' }
  catch (e) { checked.value = null; error.value = e instanceof Error ? e.message : '题目校验失败' }
}
function start() {
  validate()
  if (!checked.value) return
  const launch = () => { game.startGame(checked.value!, 'CUSTOM'); openPage('/pages/game/index') }
  if (game.game && game.game.status !== 'COMPLETED') uni.showModal({ title: '开始自定义题目', content: '当前未完成游戏会被替换，是否继续？', success: ({ confirm }) => { if (confirm) launch() } })
  else launch()
}
</script>
<template>
  <view class="safe-page import-page" :class="appearance">
    <AppHeader title="导入题目"><template #left><text class="back" @tap="back">‹</text></template></AppHeader>
    <view class="content">
      <text class="secondary-copy">按行粘贴 81 个数字，空格用 0 或 . 表示。可以包含换行、空白或逗号。</text>
      <textarea v-model="input" maxlength="1000" class="puzzle-input" placeholder="每行 9 个数字，共 9 行" @input="checked = null; error = ''" />
      <text v-if="error" class="error">{{ error }}</text>
      <text v-if="checked" class="valid">题目有唯一解 · {{ tierName(checked.tier) }} · {{ checked.clueCount }} 个已知数</text>
      <button class="secondary-action" @tap="validate">检查题目</button>
      <button class="primary-action" @tap="start">开始自定义游戏</button>
      <text class="secondary-copy note">自定义游戏支持存档、提示和复盘，计入游戏统计，不增加闯关积分。</text>
    </view>
  </view>
</template>
<style scoped>
.import-page { background: var(--page-bg); }
.back { font-size: 58rpx; color: var(--primary); }
.content { padding: 24rpx; max-width: 900rpx; margin: auto; }
.puzzle-input { width: 100%; height: 460rpx; padding: 24rpx; margin: 20rpx 0; background: var(--surface); border-radius: 18rpx; color: var(--text-primary); font-size: 32rpx; letter-spacing: 3rpx; line-height: 1.5; font-family: monospace; }
.error, .valid { display: block; font-size: 26rpx; line-height: 1.6; }
.error { color: var(--error); }
.valid { color: var(--primary); }
.note { display: block; margin-top: 24rpx; }
</style>
