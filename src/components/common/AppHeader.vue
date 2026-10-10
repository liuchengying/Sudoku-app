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
.app-header { position: relative; min-height: 56px; padding: 4px 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.left, .right { min-width: 64px; min-height: 48px; display: flex; align-items: center; gap: 8px; z-index: 1; }
.right { justify-content: flex-end; }
.header-title { flex: 1; min-width: 0; font-size: 20px; font-weight: 700; color: var(--text-primary); text-align: center; overflow-wrap: anywhere; }
</style>
