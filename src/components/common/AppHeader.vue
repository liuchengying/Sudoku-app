<script setup lang="ts">
import { useSafeArea } from '@/composables/useSafeArea'

withDefaults(defineProps<{ title?: string }>(), { title: '数独' })
const { topStyle } = useSafeArea()
</script>

<template>
  <view class="header-shell" :style="topStyle">
    <view class="app-header">
      <view class="left"><slot name="left" /></view>
      <text class="header-title">{{ title }}</text>
      <view class="right"><slot name="right" /></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.header-shell { width: 100%; background: var(--page-bg); }
.app-header { position: relative; height: 112rpx; padding: 0 32rpx; display: flex; align-items: center; justify-content: space-between; }
.left, .right { min-width: 150rpx; min-height: 80rpx; display: flex; align-items: center; gap: 28rpx; z-index: 1; }
.right { justify-content: flex-end; }
.header-title { position: absolute; left: 50%; transform: translateX(-50%); font-size: 40rpx; font-weight: 700; color: var(--text-primary); letter-spacing: 1rpx; }
</style>
