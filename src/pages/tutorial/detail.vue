<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/common/AppHeader.vue'
import { getTutorialArticle } from '@/content/tutorial'

const articleId = ref('rules')
const article = computed(() => getTutorialArticle(articleId.value))

onLoad((query) => {
  if (query?.id) articleId.value = String(query.id)
})
</script>

<template>
  <view class="safe-page detail-page">
    <AppHeader :title="article?.title ?? '技巧详情'">
      <template #left><text class="back" @tap="uni.navigateBack()">‹</text></template>
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
.detail-page { background: #f5f5f7; }
.back { color: var(--primary); font-size: 58rpx; line-height: 1; }
.content { padding: 18rpx 28rpx 45rpx; }
.summary { display: block; color: #75767b; font-size: 25rpx; margin: 0 8rpx 16rpx; }
.article-card { background: #fff; border-radius: 24rpx; padding: 30rpx; }
.paragraph { display: block; line-height: 1.9; font-size: 29rpx; color: #292a2d; margin-bottom: 22rpx; }
.paragraph:last-child { margin-bottom: 0; }
.tips { margin-top: 22rpx; background: #eaf4ff; border-radius: 22rpx; padding: 26rpx 28rpx; }
.tips-title { display: block; color: var(--primary); font-size: 27rpx; font-weight: 700; margin-bottom: 12rpx; }
.tip { display: flex; gap: 12rpx; color: #4d6680; line-height: 1.65; font-size: 24rpx; margin: 7rpx 0; }
.bullet { color: var(--primary); }
.engine-note { margin-top: 24rpx; padding: 24rpx 28rpx; border-radius: 20rpx; background: #fff; color: #98999e; line-height: 1.65; font-size: 22rpx; }
</style>
