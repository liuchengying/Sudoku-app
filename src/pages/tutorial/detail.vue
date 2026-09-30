<script setup lang="ts">
import { useAppearance } from '@/composables/useAppearance'
import { back } from '@/composables/useNavigation'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import { getTutorialArticle } from '@/content/tutorial'

const appearance = useAppearance()

const articleId = ref('rules')
const article = computed(() => getTutorialArticle(articleId.value))

onLoad((query) => {
  if (query?.id) articleId.value = String(query.id)
})
</script>

<template>
  <view class="safe-page detail-page" :class="appearance">
    <AppHeader :title="article?.title ?? '技巧详情'">
      <template #left><text class="back" @tap="back">‹</text></template>
    </AppHeader>
    <view v-if="article" class="content">
      <text class="summary">{{ article.summary }}</text>
      <view class="article-card">
        <text v-for="(paragraph, index) in article.paragraphs" :key="index" class="paragraph">{{ paragraph }}</text>
      </view>
      <view v-if="article.tips?.length" class="tips">
        <text class="tips-title">要点</text>
        <view v-for="tip in article.tips" :key="tip" class="tip"><text class="bullet">•</text><text>{{ tip }}</text></view>
      </view>
      <view class="engine-note">游戏内“解法”功能与数独逻辑引擎使用同一套技巧定义；当棋盘存在可解释的逻辑步骤时，会优先给出逻辑提示。</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.detail-page { background: var(--surface); }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.content { padding: 18rpx 28rpx 45rpx; }
.summary { display: block; color: var(--text-secondary); font-size: 25rpx; margin: 0 8rpx 16rpx; }
.article-card { background: var(--cell-bg); border-radius: 24rpx; padding: 30rpx; }
.paragraph { display: block; line-height: 1.9; font-size: 29rpx; color: var(--text-primary); margin-bottom: 22rpx; }
.paragraph:last-child { margin-bottom: 0; }
.tips { margin-top: 22rpx; background: var(--primary-soft); border-radius: 22rpx; padding: 26rpx 28rpx; }
.tips-title { display: block; color: var(--primary); font-size: 27rpx; font-weight: 700; margin-bottom: 12rpx; }
.tip { display: flex; gap: 12rpx; color: var(--text-secondary); line-height: 1.65; font-size: 24rpx; margin: 7rpx 0; }
.bullet { color: var(--primary); }
.engine-note { margin-top: 24rpx; padding: 24rpx 28rpx; border-radius: 20rpx; background: var(--cell-bg); color: var(--text-secondary); line-height: 1.65; font-size: 22rpx; }
</style>
