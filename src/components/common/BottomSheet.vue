<script setup lang="ts">
import { computed } from 'vue'
import { useWindowMetrics } from '@/composables/useWindowMetrics'

const { metrics } = useWindowMetrics()
const windowStyle = computed(() => ({
  '--sheet-height': `${Math.max(0, Math.floor(Math.min(metrics.height * .82, metrics.height - Math.max(metrics.statusBarHeight, metrics.safeTop) - 24)))}px`,
  '--sheet-bottom': `${metrics.safeBottom}px`,
  '--sheet-left': `${metrics.safeLeft}px`, '--sheet-right': `${metrics.safeRight}px`
}))
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
  <view v-if="modelValue" class="sheet-layer" :class="{ wide: metrics.width - metrics.safeLeft - metrics.safeRight >= 640 }" :style="windowStyle">
    <view class="sheet-mask" @tap="maskTap" @touchmove.stop.prevent></view>
    <view class="sheet" role="dialog" aria-modal="true" :aria-label="title || '操作面板'" @touchmove.stop>
      <view class="grabber"></view>
      <view v-if="title" class="sheet-header">
        <text class="sheet-title">{{ title }}</text>
        <button class="close" aria-label="关闭面板" @tap="close">×</button>
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
.sheet { position: absolute; left: var(--sheet-left); right: var(--sheet-right); bottom: 0; height: var(--sheet-height); display: flex; flex-direction: column; background: var(--surface); border-radius: 18px 18px 0 0; overflow: hidden; box-shadow: 0 -6px 20px rgba(0,0,0,.10); }
.wide .sheet { left: 50%; right: auto; bottom: 12px; transform: translateX(-50%); width: min(560px, calc(100% - 32px)); border-radius: 18px; }
.grabber { flex-shrink: 0; width: 38px; height: 4px; border-radius: 999px; background: var(--divider); margin: 8px auto 0; }
.sheet-header { flex-shrink: 0; position: relative; min-height: 62px; padding: 8px 64px; display: flex; align-items: center; justify-content: center; }
.sheet-title { font-size: 19px; font-weight: 700; text-align: center; }
.close { position: absolute; right: 8px; width: 48px; height: 48px; border-radius: 50%; background: var(--divider); color: var(--text-primary); font-size: 28px; line-height: 48px; text-align: center; font-weight: 300; }
.sheet-content { flex: 1; min-height: 0; height: 0; }
.safe-bottom { flex-shrink: 0; height: calc(12px + max(var(--sheet-bottom), env(safe-area-inset-bottom))); }
</style>
