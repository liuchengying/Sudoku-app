<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  closeOnMask?: boolean
}>(), { title: '', closeOnMask: true })

const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()

function close() {
  emit('update:modelValue', false)
}

function maskTap() {
  if (props.closeOnMask) close()
}
</script>

<template>
  <view v-if="modelValue" class="sheet-layer">
    <view class="sheet-mask" @tap="maskTap" @touchmove.stop.prevent></view>
    <view class="sheet" @touchmove.stop>
      <view class="grabber"></view>
      <view v-if="title" class="sheet-header">
        <text class="sheet-title">{{ title }}</text>
        <view class="close" @tap="close">×</view>
      </view>
      <scroll-view scroll-y class="sheet-content">
        <slot />
      </scroll-view>
      <view class="safe-bottom"></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.sheet-layer { position: fixed; inset: 0; z-index: 1000; }
.sheet-mask { position: absolute; inset: 0; background: rgba(0,0,0,.20); backdrop-filter: blur(7px); }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; max-height: 82vh; background: #f7f7f9; border-radius: 34rpx 34rpx 0 0; overflow: hidden; box-shadow: 0 -12rpx 40rpx rgba(0,0,0,.10); }
.grabber { width: 74rpx; height: 8rpx; border-radius: 999rpx; background: #d2d2d7; margin: 14rpx auto 0; }
.sheet-header { position: relative; height: 112rpx; display: flex; align-items: center; justify-content: center; }
.sheet-title { font-size: 38rpx; font-weight: 700; }
.close { position: absolute; right: 28rpx; width: 62rpx; height: 62rpx; border-radius: 50%; background: #e5e5e8; color: #777; font-size: 48rpx; line-height: 58rpx; text-align: center; font-weight: 300; }
.sheet-content { max-height: calc(82vh - 140rpx); }
.safe-bottom { height: calc(18rpx + env(safe-area-inset-bottom)); }
</style>
