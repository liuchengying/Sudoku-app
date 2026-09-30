<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { useAppearance } from '@/composables/useAppearance'
import { openPage } from '@/composables/useNavigation'
import { DIFFICULTIES } from '@/config/difficulty'
import { PRACTICE_TIERS, tierName } from '@/config/practice'
import { campaignPage, campaignProfile, campaignSlot, CAMPAIGN_PAGE_SIZE, parseCampaignId, suggestedCampaignLevel, type CampaignSlot } from '@/config/campaign'
import { knownCampaignLevel, requestCampaignLevel } from '@/services/campaign.service'
import type { PuzzleTier } from '@/core/sudoku'
import LevelGrid from '@/components/home/LevelGrid.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import MoreSheet from '@/components/common/MoreSheet.vue'
import { useProgressStore } from '@/stores/progress.store'
import { useGameStore } from '@/stores/game.store'
import { requestPracticeLevel, GenerationCancelled } from '@/services/puzzle.service'
import { gameTitle } from '@/utils/game-label'
import { shareApp } from '@/services/share.service'

const appearance = useAppearance()
const progressStore = useProgressStore()
const gameStore = useGameStore()
const difficultyIndex = ref(0)
const selectedNo = ref(1)
const page = ref(0)
const jumpText = ref('')
const cacheRevision = ref(0)
const mode = ref<'campaign' | 'practice'>('campaign')
const practiceTier = ref<PuzzleTier>('beginner')
const moreVisible = ref(false)
const loading = ref(false)
let generationToken = 0
const difficulty = computed(() => DIFFICULTIES[difficultyIndex.value])
const levels = computed(() => campaignPage(difficulty.value.id, page.value))
const selected = computed(() => campaignSlot(difficulty.value.id, selectedNo.value))
const selectedId = computed(() => selected.value.id)
const selectedLevel = computed(() => { cacheRevision.value; return current.value?.levelId === selectedId.value ? current.value.level : knownCampaignLevel(selectedId.value) })
const profile = computed(() => campaignProfile(difficulty.value.id, selectedNo.value))
const current = computed(() => gameStore.game && gameStore.game.status !== 'COMPLETED' ? gameStore.game : null)
function selectLevel(slot: CampaignSlot) { if (!loading.value) selectedNo.value = slot.levelNo }
function chooseLevel(levelNo: number) { selectedNo.value = levelNo; page.value = Math.floor((levelNo - 1) / CAMPAIGN_PAGE_SIZE) }
function recommended() { chooseLevel(suggestedCampaignLevel(difficulty.value.id, progressStore.progressMap)) }
function chooseDifficulty(index: number) { if (loading.value) return; difficultyIndex.value = index; recommended() }
function turnPage(delta: number) {
  if (loading.value || page.value + delta < 0) return
  try { campaignPage(difficulty.value.id, page.value + delta) }
  catch { return uni.showToast({ title: '关卡号超出可支持范围', icon: 'none' }) }
  page.value += delta
  selectedNo.value = page.value * CAMPAIGN_PAGE_SIZE + 1
}
function updateJumpText(event: unknown) { jumpText.value = String((event as { detail?: { value?: string } }).detail?.value ?? '') }
function jumpToLevel() {
  const text = jumpText.value.trim()
  if (!/^\d+$/.test(text)) return uni.showToast({ title: '请输入正整数关卡号', icon: 'none' })
  const levelNo = Number(text)
  try { campaignSlot(difficulty.value.id, levelNo); campaignPage(difficulty.value.id, Math.floor((levelNo - 1) / CAMPAIGN_PAGE_SIZE)) }
  catch { return uni.showToast({ title: '请输入有效关卡号', icon: 'none' }) }
  if (loading.value) return
  chooseLevel(levelNo)
  jumpText.value = ''
}
function cancelGeneration() { generationToken++; loading.value = false }
function replaceCurrent(launch: () => void | Promise<void>) {
  if (!current.value) return launch()
  uni.showModal({ title: '开始新游戏', content: '当前未完成进度会被替换，是否继续？', confirmText: '开始', success: ({ confirm }) => { if (confirm) launch() } })
}
function startSelected() {
  if (loading.value) return
  if (current.value?.levelId === selected.value.id) return openPage('/pages/game/index')
  const id = selected.value.id
  replaceCurrent(async () => {
    if (loading.value) return
    loading.value = true
    const token = ++generationToken
    try {
      const level = await requestCampaignLevel(id, () => token !== generationToken)
      if (token !== generationToken) return
      gameStore.startGame(level)
      openPage('/pages/game/index')
    } catch (e) { if (!(e instanceof GenerationCancelled)) uni.showToast({ title: e instanceof Error ? e.message : '生成失败，请再试一次', icon: 'none' }) }
    finally { if (token === generationToken) loading.value = false }
  })
}
function startPractice() {
  if (loading.value) return
  const tier = practiceTier.value
  replaceCurrent(async () => {
    if (loading.value) return
    loading.value = true
    const token = ++generationToken
    try {
      const level = await requestPracticeLevel(tier, () => token !== generationToken)
      if (token !== generationToken) return
      gameStore.startGame(level, 'PRACTICE')
      openPage('/pages/game/index')
    } catch (e) { if (!(e instanceof GenerationCancelled)) uni.showToast({ title: e instanceof Error ? e.message : '生成失败，请再试一次', icon: 'none' }) }
    finally { if (token === generationToken) loading.value = false }
  })
}
function moreAction(action: string) {
  if (action === 'share') return shareApp()
  const routes: Record<string, string> = { history: '/pages/history/index', statistics: '/pages/statistics/index', basic: '/pages/tutorial/index?section=basic', advanced: '/pages/tutorial/index?section=advanced', rules: '/pages/tutorial/index?section=rules', settings: '/pages/settings/index', daily: '/pages/daily/index', import: '/pages/import/index' }
  if (routes[action]) openPage(routes[action])
}
onShow(() => {
  progressStore.reload()
  if (!gameStore.game) gameStore.restoreGame()
  cacheRevision.value++
  const slot = current.value && (current.value.mode ?? 'CAMPAIGN') === 'CAMPAIGN' ? parseCampaignId(current.value.levelId) : undefined
  if (slot) { difficultyIndex.value = DIFFICULTIES.findIndex(d => d.id === slot.difficultyId); chooseLevel(slot.levelNo) }
  else recommended()
})
onHide(cancelGeneration)
</script>
<template>
  <view class="safe-page home-page" :class="appearance">
    <AppHeader title="数独"><template #left><text class="link" @tap="openPage('/pages/tutorial/index')">技巧</text></template><template #right><text class="link" @tap="moreVisible = true">更多</text></template></AppHeader>
    <view class="content">
      <button v-if="current" class="resume-card" @tap="openPage('/pages/game/index')"><text>继续上次游戏</text><text>{{ gameTitle(current) }} ›</text></button>
      <view class="quick-links"><button @tap="openPage('/pages/daily/index')">▦ 每日挑战</button><button @tap="openPage('/pages/import/index')">＋ 导入题目</button></view>
      <view class="tabs"><button :disabled="loading" :class="{ active: mode === 'campaign' }" @tap="mode = 'campaign'">无限闯关</button><button :disabled="loading" :class="{ active: mode === 'practice' }" @tap="mode = 'practice'">无限练习</button></view>
      <template v-if="mode === 'campaign'">
        <view class="difficulty-tabs"><button v-for="(item, index) in DIFFICULTIES" :key="item.id" :disabled="loading" :class="{ active: difficultyIndex === index }" @tap="chooseDifficulty(index)">{{ item.name }}</button></view>
        <text class="secondary-copy">{{ difficulty.subtitle }} · 关卡不限</text>
        <view class="pagination"><button :disabled="loading || page === 0" @tap="turnPage(-1)">上一组</button><text>{{ levels[0].levelNo }}–{{ levels[levels.length - 1].levelNo }} 关</text><button :disabled="loading" @tap="turnPage(1)">下一组</button></view>
        <LevelGrid :levels="levels" :disabled="loading" :selected-level-id="selectedId" :current-level-id="current?.levelId" :progress-map="progressStore.progressMap" @select="selectLevel" />
        <view class="jump-row"><input :value="jumpText" class="jump-input" type="number" :disabled="loading" placeholder="输入关卡号" @input="updateJumpText" @confirm="jumpToLevel" /><button :disabled="loading" @tap="jumpToLevel">前往</button><button :disabled="loading" @tap="recommended">推荐下一关</button></view>
        <text class="selection">第 {{ selected.levelNo }} 关<template v-if="profile"> · 第 {{ profile.stage }} 阶段 · {{ profile.label }}</template></text>
        <text v-if="selectedLevel" class="secondary-copy">实际难度：{{ tierName(selectedLevel.tier) }} · {{ selectedLevel.clueCount }} 个已知数</text>
        <text v-else-if="profile" class="secondary-copy">目标难度：{{ tierName(profile.tier) }} · 开始时离线生成唯一解题目</text>
        <button class="primary-action" :loading="loading" :disabled="loading" @tap="startSelected">{{ loading ? '正在准备题目…' : current?.levelId === selectedId ? '继续本关' : '开始本关' }}</button>
        <text class="secondary-copy footnote">每个难度的前 25 关保留，之后自动生成。新增关卡每 25 关提升一个阶段，专家阶段持续出新题；每关首次完成获得积分。</text>
      </template>
      <template v-else>
        <text class="secondary-copy">离线生成唯一解题目，练习次数不限。练习计入统计，不增加闯关积分。</text>
        <button v-for="tier in PRACTICE_TIERS" :key="tier.id" class="tier-card" :class="{ active: practiceTier === tier.id }" :disabled="loading" @tap="practiceTier = tier.id"><text>{{ tier.name }}</text><text>{{ tier.desc }}</text></button>
        <button class="primary-action" :loading="loading" :disabled="loading" @tap="startPractice">{{ loading ? '正在生成题目…' : '开始新的练习' }}</button>
      </template>
      <button v-if="loading" class="secondary-action" @tap="cancelGeneration">取消生成</button>
    </view>
    <MoreSheet v-model="moreVisible" @action="moreAction" />
  </view>
</template>
<style scoped>
.home-page { background: var(--page-bg); }
.content { padding: 12rpx 24rpx 40rpx; max-width: 900rpx; margin: 0 auto; }
.link { min-height: 48px; display: flex; align-items: center; color: var(--primary); font-size: 29rpx; }
.resume-card { display: flex; flex-direction: column; align-items: flex-start; padding: 22rpx; gap: 8rpx; background: var(--primary-soft); border-radius: 18rpx; color: var(--primary); font-size: 28rpx; min-height: 48px; }
.resume-card text:last-child { font-size: 24rpx; }
.quick-links, .tabs, .difficulty-tabs { display: flex; gap: 12rpx; margin: 20rpx 0; }
.quick-links button, .tabs button, .difficulty-tabs button { flex: 1; min-height: 48px; border-radius: 14rpx; background: var(--surface); color: var(--text-primary); font-size: 28rpx; display: flex; align-items: center; justify-content: center; }
.tabs .active, .difficulty-tabs .active, .tier-card.active { background: var(--primary-soft); color: var(--primary); box-shadow: inset 0 0 0 2rpx var(--primary); }
.selection { display: block; font-size: 26rpx; color: var(--text-secondary); margin: 20rpx 0 8rpx; }
.footnote { display: block; margin-top: 20rpx; }
.pagination, .jump-row { display: flex; align-items: center; gap: 12rpx; margin-top: 18rpx; }
.pagination text { flex: 1; text-align: center; font-size: 26rpx; }
.pagination button, .jump-row button { margin: 0; min-height: 48px; padding: 0 18rpx; font-size: 24rpx; border-radius: 12rpx; color: var(--primary); background: var(--primary-soft); display: flex; align-items: center; }
.jump-input { flex: 1; min-width: 0; min-height: 48px; padding: 0 12rpx; font-size: 24rpx; border-radius: 12rpx; color: var(--text-primary); background: var(--surface); }
.tier-card { text-align: left; display: flex; flex-direction: column; gap: 8rpx; padding: 24rpx; margin-top: 16rpx; border-radius: 18rpx; background: var(--surface); color: var(--text-primary); font-size: 31rpx; min-height: 48px; }
.tier-card text:last-child { font-size: 24rpx; color: var(--text-secondary); }
</style>
