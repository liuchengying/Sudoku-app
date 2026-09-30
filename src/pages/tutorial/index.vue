<script setup lang="ts">
import { useAppearance } from '@/composables/useAppearance'
import { back, openPage } from '@/composables/useNavigation'
import { computed, ref } from 'vue'
import { onLoad, onHide } from '@dcloudio/uni-app'
import { requestPracticeLevel, GenerationCancelled } from '@/services/puzzle.service'
import { useGameStore } from '@/stores/game.store'
import AppHeader from '@/components/common/AppHeader.vue'
import { TUTORIAL_ARTICLES, TUTORIAL_SECTIONS, type TutorialSection } from '@/content/tutorial'

const appearance = useAppearance()

const training = ref(false)
let generationToken = 0
const filter = ref<TutorialSection | null>(null)

onLoad((query) => {
  const section = String(query?.section ?? '') as TutorialSection
  if (TUTORIAL_SECTIONS.some((item) => item.id === section)) filter.value = section
})

const sections = computed(() => filter.value ? TUTORIAL_SECTIONS.filter((item) => item.id === filter.value) : TUTORIAL_SECTIONS)
async function startTraining() {
  if (training.value) return
  const store = useGameStore()
  const launch = async () => {
    training.value = true
    const token = ++generationToken
    try {
      const level = await requestPracticeLevel('beginner', () => token !== generationToken)
      if (token !== generationToken) return
      store.startGame(level, 'PRACTICE'); openPage('/pages/game/index')
    }
    catch (e) { if (!(e instanceof GenerationCancelled)) uni.showToast({ title: '练习生成失败，请重试', icon: 'none' }) }
    finally { if (token === generationToken) training.value = false }
  }
  if (store.game && store.game.status !== 'COMPLETED') uni.showModal({ title: '开始实局练习', content: '当前未完成游戏会被替换，是否继续？', success: ({ confirm }) => { if (confirm) launch() } })
  else launch()
}
onHide(() => { generationToken++; training.value = false })
</script>

<template>
  <view class="safe-page tutorial-page" :class="appearance">
    <AppHeader :title="filter ? TUTORIAL_SECTIONS.find(s => s.id === filter)?.title : '数独技巧'">
      <template #left><text class="back" @tap="back">‹</text></template>
    </AppHeader>

    <view class="content">
      <button class="primary-action" :loading="training" :disabled="training" @tap="startTraining">用入门题实局练习</button>
      <text class="secondary-copy">练习中点击解法，逐步查看推导，也可以先记录草稿。</text>
      <view v-for="section in sections" :key="section.id" class="section">
        <view class="section-head"><text class="section-title">{{ section.title }}</text><text class="section-sub">{{ section.subtitle }}</text></view>
        <view class="card">
          <view
            v-for="article in TUTORIAL_ARTICLES.filter(item => item.section === section.id)"
            :key="article.id"
            class="row"
            @tap="openPage(`/pages/tutorial/detail?id=${article.id}`)"
          >
            <view class="doc-icon">▤</view>
            <view class="copy"><text class="name">{{ article.title }}</text><text class="summary">{{ article.summary }}</text></view>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tutorial-page { background: var(--surface); }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.content { padding: 16rpx 28rpx 40rpx; }
.section { margin-bottom: 30rpx; }
.section-head { margin: 0 10rpx 11rpx; display: flex; align-items: baseline; justify-content: space-between; }
.section-title { color: var(--text-secondary); font-size: 27rpx; font-weight: 650; }
.section-sub { color: var(--text-secondary); font-size: 20rpx; }
.card { background: var(--cell-bg); border-radius: 24rpx; overflow: hidden; }
.row { min-height: 112rpx; padding: 15rpx 24rpx; display: flex; align-items: center; border-bottom: 1rpx solid var(--divider); }
.row:last-child { border-bottom: 0; }
.doc-icon { width: 58rpx; color: var(--text-primary); font-size: 38rpx; }
.copy { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.name { font-size: 29rpx; font-weight: 620; }
.summary { color: var(--text-secondary); font-size: 21rpx; }
.arrow { color: #bbb; font-size: 48rpx; }
</style>
