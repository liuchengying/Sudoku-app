<script setup lang="ts">
import type { MedalType } from '@/types/progress'
import { computed } from 'vue'

const props = defineProps<{ medal: MedalType; size?: 'small' | 'normal' }>()
const number = computed(() => props.medal === 'GOLD' ? 1 : props.medal === 'SILVER' ? 2 : 3)
</script>

<template>
  <view class="medal" :class="[medal.toLowerCase(), size === 'small' ? 'small' : '']">
    <view class="ribbon left"></view><view class="ribbon right"></view>
    <text>{{ number }}</text>
  </view>
</template>

<style scoped lang="scss">
.medal { position: relative; width: 62rpx; height: 62rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 34rpx; font-weight: 800; color: rgba(80,40,0,.72); box-shadow: inset 0 0 0 5rpx rgba(255,255,255,.20), 0 3rpx 8rpx rgba(0,0,0,.12); }
.medal.gold { background: linear-gradient(145deg, #ffd86a, #e3a514); }
.medal.silver { background: linear-gradient(145deg, #e7ebf0, #aeb7c2); color: #59616a; }
.medal.bronze { background: linear-gradient(145deg, #d98a45, #a85619); color: #6f2f00; }
.medal.small { width: 46rpx; height: 46rpx; font-size: 25rpx; }
.ribbon { position: absolute; top: -18rpx; width: 10rpx; height: 25rpx; border-radius: 3rpx; background: #1f73d5; z-index: -1; }
.ribbon.left { left: 18rpx; transform: rotate(-12deg); }
.ribbon.right { right: 18rpx; background: #e64949; transform: rotate(12deg); }
</style>
