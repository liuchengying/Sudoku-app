<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import { TUTORIAL_ARTICLES, TUTORIAL_SECTIONS, type TutorialSection } from '@/content/tutorial'

const filter = ref<TutorialSection | null>(null)

onLoad((query) => {
  const section = String(query?.section ?? '') as TutorialSection
  if (TUTORIAL_SECTIONS.some((item) => item.id === section)) filter.value = section
})

const sections = computed(() => filter.value ? TUTORIAL_SECTIONS.filter((item) => item.id === filter.value) : TUTORIAL_SECTIONS)
</script>

<template>
  <view class="safe-page tutorial-page">
    <AppHeader :title="filter ? TUTORIAL_SECTIONS.find(s => s.id === filter)?.title : '数独技巧'">
      <template #left><text class="back" @tap="uni.navigateBack()">‹</text></template>
    </AppHeader>

    <view class="content">
      <view v-for="section in sections" :key="section.id" class="section">
        <view class="section-head"><text class="section-title">{{ section.title }}</text><text class="section-sub">{{ section.subtitle }}</text></view>
        <view class="card">
          <view
            v-for="article in TUTORIAL_ARTICLES.filter(item => item.section === section.id)"
            :key="article.id"
            class="row"
            @tap="uni.navigateTo({ url: `/pages/tutorial/detail?id=${article.id}` })"
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
.tutorial-page { background: #f5f5f7; }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.content { padding: 16rpx 28rpx 40rpx; }
.section { margin-bottom: 30rpx; }
.section-head { margin: 0 10rpx 11rpx; display: flex; align-items: baseline; justify-content: space-between; }
.section-title { color: #5f6065; font-size: 27rpx; font-weight: 650; }
.section-sub { color: #aaabb0; font-size: 20rpx; }
.card { background: #fff; border-radius: 24rpx; overflow: hidden; }
.row { min-height: 112rpx; padding: 15rpx 24rpx; display: flex; align-items: center; border-bottom: 1rpx solid #ececef; }
.row:last-child { border-bottom: 0; }
.doc-icon { width: 58rpx; color: #111; font-size: 38rpx; }
.copy { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.name { font-size: 29rpx; font-weight: 620; }
.summary { color: #999; font-size: 21rpx; }
.arrow { color: #bbb; font-size: 48rpx; }
</style>
