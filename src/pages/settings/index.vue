<script setup lang="ts">
import AppHeader from '@/components/common/AppHeader.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useProgressStore } from '@/stores/progress.store'
import { useHistoryStore } from '@/stores/history.store'
import { useGameStore } from '@/stores/game.store'
import type { AppSettings } from '@/types/settings'

const store = useSettingsStore()
const progressStore = useProgressStore()
const historyStore = useHistoryStore()
const gameStore = useGameStore()

const items: { key: keyof AppSettings; label: string; desc: string }[] = [
  { key: 'highlightRelated', label: '高亮同行列宫', desc: '选中格时突出显示相关区域' },
  { key: 'highlightSameDigit', label: '高亮相同数字', desc: '突出显示与选中数字相同的数字' },
  { key: 'autoRemoveCandidates', label: '自动删除候选', desc: '正确填入后清除同行、同列和同宫中的同数字候选' },
  { key: 'smartNotes', label: '智能草稿', desc: '阻止添加已经被行、列或宫排除的候选数' },
  { key: 'immediateErrorCheck', label: '错误即时提示', desc: '错误数字立即标红并计入错误次数' },
  { key: 'autoPauseOnBackground', label: '后台自动暂停', desc: '切到后台时停止计时，回到游戏后手动继续' },
  { key: 'disableCompletedDigit', label: '完成数字禁用', desc: '某数字正确填满 9 个后禁用对应数字键' },
  { key: 'sound', label: '音效', desc: '数字输入、错误和完成时播放轻量音效' },
  { key: 'haptics', label: '震动反馈', desc: '操作和错误时触发轻触感' }
]

function update(key: keyof AppSettings, event: { detail: { value: boolean } }) {
  store.setSetting(key, Boolean(event.detail.value))
}

function resetProgress() {
  uni.showModal({
    title: '重置所有游戏进度',
    content: '将删除关卡成绩、历史记录与当前游戏。设置不会被清除，此操作不可恢复。',
    confirmText: '重置',
    confirmColor: '#ff3b30',
    success: ({ confirm }) => {
      if (!confirm) return
      progressStore.reset()
      historyStore.clear()
      gameStore.discard()
      uni.showToast({ title: '游戏进度已重置', icon: 'none' })
    }
  })
}

function resetSettings() {
  store.reset()
  uni.showToast({ title: '设置已恢复默认', icon: 'none' })
}
</script>

<template>
  <view class="safe-page settings-page">
    <AppHeader title="设置">
      <template #left><text class="back" @tap="uni.navigateBack()">‹</text></template>
    </AppHeader>
    <view class="content">
      <view class="section">
        <view v-for="item in items" :key="item.key" class="setting-row">
          <view class="text"><text class="label">{{ item.label }}</text><text class="desc">{{ item.desc }}</text></view>
          <switch :checked="store.settings[item.key]" color="#0a7cff" @change="update(item.key, $event)" />
        </view>
      </view>

      <view class="section action-section">
        <view class="action-row" @tap="resetSettings"><text>恢复默认设置</text><text>›</text></view>
        <view class="action-row danger" @tap="resetProgress"><text>重置游戏进度</text><text>›</text></view>
      </view>
      <text class="version">数独 · V1.0.0 · 数据仅保存在本机</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.settings-page { background: #f5f5f7; }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.content { padding: 16rpx 24rpx 40rpx; }
.section { background: #fff; border-radius: 24rpx; overflow: hidden; }
.setting-row { min-height: 116rpx; padding: 18rpx 24rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid #ececef; gap: 20rpx; }
.setting-row:last-child { border-bottom: 0; }
.text { display: flex; flex-direction: column; gap: 5rpx; flex: 1; }
.label { font-size: 29rpx; font-weight: 560; }
.desc { color: #999; font-size: 21rpx; line-height: 1.42; padding-right: 6rpx; }
.action-section { margin-top: 28rpx; }
.action-row { height: 94rpx; padding: 0 26rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid #ececef; font-size: 29rpx; }
.action-row:last-child { border-bottom: 0; }
.action-row text:last-child { color: #bbb; font-size: 44rpx; }
.action-row.danger text:first-child { color: #ff3b30; }
.version { display: block; text-align: center; color: #b1b1b5; font-size: 20rpx; margin-top: 28rpx; }
</style>
