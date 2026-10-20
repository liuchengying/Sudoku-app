<script setup lang="ts">
import { ref } from 'vue'
import { onBackPress } from '@dcloudio/uni-app'
import { useAppearance } from '@/composables/useAppearance'
import { back } from '@/composables/useNavigation'
import AppHeader from '@/components/common/AppHeader.vue'
import OnboardingGuide from '@/components/common/OnboardingGuide.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useProgressStore } from '@/stores/progress.store'
import { useHistoryStore } from '@/stores/history.store'
import { useGameStore } from '@/stores/game.store'
import { resultsRepository } from '@/repositories/results.repository'
import { resetPracticeCache } from '@/services/puzzle.service'
import { applyBackup, buildBackupPayload, parseBackup, summarizeBackup, type BackupPayload } from '@/services/backup.service'
import { currentGameRepository } from '@/repositories/current-game.repository'
import { campaignRepository } from '@/repositories/campaign.repository'
import type { BooleanSetting } from '@/types/settings'

const { appearance, pageStyle } = useAppearance()

const store = useSettingsStore()
const progressStore = useProgressStore()
const historyStore = useHistoryStore()
const gameStore = useGameStore()
const onboardingVisible = ref(false)
const guide = ref<InstanceType<typeof OnboardingGuide> | null>(null)

function replayOnboarding() {
  gameStore.pause()
  gameStore.flushSave()
  onboardingVisible.value = true
}

onBackPress(() => {
  if (!onboardingVisible.value) return false
  guide.value?.dismiss()
  return true
})

const items: { key: BooleanSetting; label: string; desc: string }[] = [
  { key: 'largeDigits', label: '大字数字', desc: '放大棋盘数字与候选数' },
  { key: 'independentMode', label: '自主推理', desc: '隐藏即时正误与数字余数，候选和自动清理只依据当前填写；手动检查与解法仍可求助，错误和提示仍计入成绩' },
  { key: 'highlightRelated', label: '高亮同行列宫', desc: '选中格时突出显示相关区域' },
  { key: 'highlightSameDigit', label: '高亮相同数字', desc: '突出显示与选中数字相同的数字' },
  { key: 'autoRemoveCandidates', label: '自动删除候选', desc: '正确填入后清除同行、同列和同宫中的同数字候选' },
  { key: 'smartNotes', label: '智能草稿', desc: '阻止添加已经被行、列或宫排除的候选数' },
  { key: 'immediateErrorCheck', label: '错误即时提示', desc: '立即标红错误；关闭后隐藏即时反馈和数字禁用，但其他辅助仍可用。自主推理开启时不生效，错误仍计入结算'  },
  { key: 'autoPauseOnBackground', label: '后台自动暂停', desc: '切到后台时停止计时，回到游戏后手动继续' },
  { key: 'disableCompletedDigit', label: '完成数字禁用', desc: '显示即时正误辅助时，某数字正确填满 9 个后禁用；自主推理或关闭即时提示时不禁用' },
  { key: 'sound', label: '音效', desc: '数字输入、错误和完成时播放轻量音效' },
  { key: 'haptics', label: '震动反馈', desc: '操作和错误时触发轻触感' }
]

function update(key: BooleanSetting, event: unknown) {
  store.setSetting(key, Boolean((event as { detail?: { value?: boolean } }).detail?.value))
}

function resetProgress() {
  uni.showModal({
    title: '重置所有游戏进度',
    content: '将删除关卡成绩、历史记录与当前游戏。设置不会被清除，此操作不可恢复。',
    cancelText: '取消',
    confirmText: '重置',
    confirmColor: '#ff3b30',
    success: ({ confirm }) => {
      if (!confirm) return
      try {
        resultsRepository.reset()
        gameStore.discard(false)
        try { currentGameRepository.clear() } catch { /* Reset marker rejects a stale current game. */ }
        progressStore.reload()
        historyStore.refresh()
        try { resetPracticeCache() } catch { /* Auxiliary cache can be rebuilt. */ }
        campaignRepository.clear()
      } catch { uni.showToast({ title: '重置失败，请稍后再试', icon: 'none' }); return }
      uni.showToast({ title: '游戏进度已重置', icon: 'none' })
    }
  })
}

function resetSettings() {
  try { store.reset() } catch { uni.showToast({ title: '恢复设置失败', icon: 'none' }); return }
  uni.showToast({ title: '设置已恢复默认', icon: 'none' })
}

const exportVisible = ref(false)
const exportText = ref('')
const exportSummary = ref('')
const importVisible = ref(false)
const importInput = ref('')
const importError = ref('')
const importSummary = ref('')
const importChecked = ref<BackupPayload | null>(null)

function formatStamp(iso: string) {
  return iso ? iso.replace('T', ' ').slice(0, 16) : '未知时间'
}

function backupDigest(summary: { exportedAt: string; historyCount: number; progressCount: number; hasCurrentGame: boolean }) {
  return `历史 ${summary.historyCount} 条 · 进度 ${summary.progressCount} 关 · ${summary.hasCurrentGame ? '含未完成对局' : '无未完成对局'}`
}

function openExport() {
  // Capture the paused board and any pending save before reading storage.
  gameStore.flushSave()
  try {
    const payload = buildBackupPayload()
    const summary = summarizeBackup(payload)
    exportText.value = JSON.stringify(payload)
    exportSummary.value = `导出于 ${formatStamp(summary.exportedAt)} · ${backupDigest(summary)} · 约 ${(summary.characters / 1024).toFixed(1)}K 字符`
    exportVisible.value = true
  } catch {
    uni.showToast({ title: '导出失败，请稍后再试', icon: 'none' })
  }
}

function copyExport() {
  uni.setClipboardData({
    data: exportText.value,
    success: () => uni.showToast({ title: '备份内容已复制，请粘贴到备忘录等保存', icon: 'none' }),
    fail: () => uni.showToast({ title: '复制失败，请长按上方内容手动全选复制', icon: 'none' })
  })
}

function openImport() {
  importInput.value = ''
  importError.value = ''
  importSummary.value = ''
  importChecked.value = null
  importVisible.value = true
}

function checkImport() {
  try {
    const payload = parseBackup(importInput.value)
    importChecked.value = payload
    importSummary.value = `备份有效 · 导出于 ${formatStamp(summarizeBackup(payload).exportedAt)} · ${backupDigest(summarizeBackup(payload))}`
    importError.value = ''
  } catch (e) {
    importChecked.value = null
    importSummary.value = ''
    importError.value = e instanceof Error ? e.message : '备份校验失败'
  }
}

function confirmImport() {
  if (!importChecked.value) return
  uni.showModal({
    title: '导入并覆盖本机数据',
    content: '当前进度、历史、设置与未完成对局将被备份内容替换，此操作不可撤销。',
    cancelText: '取消',
    confirmText: '导入',
    confirmColor: '#ff3b30',
    success: ({ confirm }) => { if (confirm) restoreBackup() }
  })
}

function restoreBackup() {
  const payload = importChecked.value
  if (!payload) return
  try {
    applyBackup(payload)
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '导入失败，请重试', icon: 'none' })
    return
  }
  // Re-read every store so in-memory state matches the restored snapshot.
  store.reload()
  progressStore.reload()
  historyStore.refresh()
  gameStore.discard(false)
  gameStore.restoreGame()
  importVisible.value = false
  uni.showToast({ title: '备份已恢复', icon: 'none' })
  setTimeout(() => uni.reLaunch({ url: '/pages/home/index' }), 400)
}
</script>

<template>
  <view class="safe-page settings-page" :class="appearance" :style="pageStyle">
    <template v-if="!onboardingVisible">
    <AppHeader title="设置">
      <template #left><text class="back" @tap="back">‹</text></template>
    </AppHeader>
    <view class="content">
      <view class="section preference-section">
        <text class="label">显示主题</text>
        <view class="choices"><button :class="{ chosen: store.settings.theme === 'light' }" @tap="store.setSetting('theme', 'light')">浅色</button><button :class="{ chosen: store.settings.theme === 'dark' }" @tap="store.setSetting('theme', 'dark')">深色</button></view>
        <text class="label">棋盘配色</text>
        <text class="desc palette-desc">选择后立即生效，下次打开仍保留</text>
        <view class="choices board-color-choices">
          <button class="board-color-blue" :class="{ chosen: store.settings.boardColor === 'blue' }" :aria-pressed="store.settings.boardColor === 'blue'" @tap="store.setSetting('boardColor', 'blue')">
            <view class="palette-name"><view class="color-swatch blue"></view><text>经典蓝色</text></view>
            <text class="palette-status">{{ store.settings.boardColor === 'blue' ? '✓ 已选' : '选择' }}</text>
          </button>
          <button class="board-color-green" :class="{ chosen: store.settings.boardColor === 'green' }" :aria-pressed="store.settings.boardColor === 'green'" @tap="store.setSetting('boardColor', 'green')">
            <view class="palette-name"><view class="color-swatch green"></view><text>护眼绿色</text></view>
            <text class="palette-status">{{ store.settings.boardColor === 'green' ? '✓ 已选' : '选择' }}</text>
          </button>
        </view>
        <text class="label">输入方式</text>
        <view class="choices"><button :class="{ chosen: store.settings.inputStyle === 'cell-first' }" @tap="store.setSetting('inputStyle', 'cell-first')">先选格再填数</button><button :class="{ chosen: store.settings.inputStyle === 'number-first' }" @tap="store.setSetting('inputStyle', 'number-first')">先选数字再点格</button></view>
      </view>
      <view class="section">
        <view v-for="item in items" :key="item.key" class="setting-row">
          <view class="text"><text class="label">{{ item.label }}</text><text class="desc">{{ item.desc }}</text></view>
          <switch :checked="store.settings[item.key]" :disabled="store.settings.independentMode && ['immediateErrorCheck', 'disableCompletedDigit'].includes(item.key)" color="#0a7cff" @change="update(item.key, $event)" />
        </view>
      </view>

      <view class="section action-section">
        <button class="action-row replay-onboarding" @tap="replayOnboarding"><text>重新查看新手引导</text><text aria-hidden="true">›</text></button>
        <view class="action-row" role="button" aria-label="导出备份数据" @tap="openExport"><text>导出备份数据</text><text aria-hidden="true">›</text></view>
        <view class="action-row" role="button" aria-label="导入备份数据" @tap="openImport"><text>导入备份数据</text><text aria-hidden="true">›</text></view>
        <view class="action-row" @tap="resetSettings"><text>恢复默认设置</text><text>›</text></view>
        <view class="action-row danger" @tap="resetProgress"><text>重置游戏进度</text><text>›</text></view>
      </view>
      <text class="version">数独 · V1.0.0 · 数据仅保存在本机</text>
    </view>
    </template>
    <OnboardingGuide v-if="onboardingVisible" ref="guide" context="settings" @finish="onboardingVisible = false" />
    <BottomSheet v-model="exportVisible" title="导出备份">
      <view class="backup-body">
        <text class="backup-summary">{{ exportSummary }}</text>
        <textarea class="backup-text" :value="exportText" maxlength="-1" disabled aria-label="备份内容全文" />
        <text class="backup-hint">复制后请粘贴到备忘录、聊天工具或文件中妥善保存；恢复时把整段内容粘贴回本应用。</text>
        <button class="backup-primary" @tap="copyExport">复制备份内容</button>
      </view>
    </BottomSheet>
    <BottomSheet v-model="importVisible" title="导入备份">
      <view class="backup-body">
        <text class="backup-summary">粘贴此前导出的备份文本，校验通过后整体覆盖本机数据。</text>
        <textarea v-model="importInput" class="backup-text import" maxlength="-1" placeholder="粘贴备份内容" aria-label="备份内容输入" @input="importChecked = null; importError = ''; importSummary = ''" />
        <text v-if="importError" class="backup-error">{{ importError }}</text>
        <text v-else-if="importSummary" class="backup-valid">{{ importSummary }}</text>
        <button class="backup-secondary" @tap="checkImport">检查备份</button>
        <button class="backup-danger" :disabled="!importChecked" @tap="confirmImport">导入并覆盖本机数据</button>
      </view>
    </BottomSheet>
  </view>
</template>

<style scoped lang="scss">
.preference-section { padding: 24rpx; margin-bottom: 24rpx; }
.choices { display: flex; gap: 16rpx; margin: 12rpx 0 24rpx; }
.choices button { flex: 1; min-height: 48px; font-size: clamp(11.05px, 26rpx, 13px); background: var(--surface); color: var(--text-primary); border-radius: 12rpx; }
.choices .chosen { background: var(--primary-soft); color: var(--primary); }
.palette-desc { display: block; margin-top: 8rpx; }
.board-color-choices button { padding: 18rpx 12rpx; border: 2rpx solid var(--divider); }
.board-color-choices .chosen { border-color: var(--primary); }
.palette-name { display: flex; align-items: center; justify-content: center; gap: 10rpx; }
.palette-status { display: block; margin-top: 8rpx; font-size: clamp(9.35px, 22rpx, 11px); }
.color-swatch { width: 24rpx; height: 24rpx; border-radius: 50%; flex-shrink: 0; }
.color-swatch.blue { background: #0864cf; }
.color-swatch.green { background: #285c3c; }
.theme-dark .color-swatch.blue { background: #79b8ff; }
.theme-dark .color-swatch.green { background: #b5e0b7; }
.settings-page { background: var(--surface); }
.back { color: var(--primary); font-size: clamp(24.65px, 58rpx, 29px); line-height: 1; }
.content { padding: 16rpx 24rpx 40rpx; }
.section { background: var(--cell-bg); border-radius: 24rpx; overflow: hidden; }
.setting-row { min-height: 116rpx; padding: 18rpx 24rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid var(--divider); gap: 20rpx; }
.setting-row:last-child { border-bottom: 0; }
.text { display: flex; flex-direction: column; gap: 5rpx; flex: 1; }
.label { font-size: clamp(12.33px, 29rpx, 14.5px); font-weight: 560; }
.desc { color: var(--text-secondary); font-size: clamp(8.92px, 21rpx, 10.5px); line-height: 1.42; padding-right: 6rpx; }
.action-section { margin-top: 28rpx; }
.action-row { height: 94rpx; padding: 0 26rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid var(--divider); font-size: clamp(12.33px, 29rpx, 14.5px); }
.replay-onboarding { width: 100%; min-height: 48px; margin: 0; background: var(--cell-bg); color: var(--text-primary); border-radius: 0; }
.replay-onboarding::after { display: none; border: 0; }
.action-row:last-child { border-bottom: 0; }
.action-row text:last-child { color: #bbb; font-size: clamp(18.7px, 44rpx, 22px); }
.action-row.danger text:first-child { color: #ff3b30; }
.version { display: block; text-align: center; color: var(--text-secondary); font-size: clamp(8.5px, 20rpx, 10px); margin-top: 28rpx; }
.backup-body { padding: 24rpx; }
.backup-summary { display: block; color: var(--text-secondary); font-size: clamp(8.92px, 21rpx, 10.5px); line-height: 1.5; margin-bottom: 16rpx; }
.backup-text { width: 100%; height: 340rpx; padding: 20rpx; margin-bottom: 16rpx; background: var(--cell-bg); border-radius: 16rpx; color: var(--text-primary); font-size: clamp(10px, 24rpx, 12px); line-height: 1.4; font-family: monospace; box-sizing: border-box; }
.backup-text.import { height: 280rpx; }
.backup-hint { display: block; color: var(--text-secondary); font-size: clamp(8.92px, 21rpx, 10.5px); line-height: 1.5; margin-bottom: 8rpx; }
.backup-error, .backup-valid { display: block; font-size: clamp(11.05px, 26rpx, 13px); line-height: 1.5; margin-bottom: 8rpx; }
.backup-error { color: var(--error); }
.backup-valid { color: var(--primary); }
.backup-body button { width: 100%; min-height: 48px; margin-top: 16rpx; border-radius: 12rpx; font-size: clamp(12.33px, 29rpx, 14.5px); }
.backup-body button::after { border: 0; }
.backup-primary { background: var(--primary); color: #ffffff; }
.backup-secondary { background: var(--surface); color: var(--primary); border: 2rpx solid var(--primary); }
.backup-danger { background: var(--cell-bg); color: #ff3b30; }
.backup-danger[disabled] { color: var(--text-secondary); opacity: 0.6; }
</style>
