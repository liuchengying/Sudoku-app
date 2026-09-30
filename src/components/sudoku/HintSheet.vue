<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { techniqueName, type HintResult } from '@/core/sudoku'
const props = defineProps<{ modelValue: boolean; hint: HintResult | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'apply'): void }>()
const cursor = ref(-1)
watch(() => props.modelValue, open => { if (open) cursor.value = -1 })
const steps = computed(() => props.hint?.steps?.length ? props.hint.steps.map(s => `${techniqueName(s.technique)}：${s.message}`) : [props.hint?.message ?? ''])
</script>
<template>
  <BottomSheet :model-value="modelValue" title="分步解法" @update:model-value="emit('update:modelValue', $event)">
    <view v-if="hint" class="hint-content">
      <text class="position">观察第 {{ Math.floor(hint.index / 9) + 1 }} 行第 {{ hint.index % 9 + 1 }} 列</text>
      <text class="intro">先查看高亮区域和候选数，尝试自己推导。查看解法会计入一次提示。</text>
      <text v-for="(message, i) in steps.slice(0, cursor + 1)" :key="i" class="step">{{ i + 1 }}. {{ message }}</text>
      <button v-if="cursor < steps.length - 1" class="primary-action" @tap="cursor++">{{ cursor < 0 ? '查看推导' : '展开下一步' }}</button>
      <template v-else>
        <text class="answer">这个格可填 {{ hint.digit }}</text>
        <button class="primary-action" @tap="emit('apply'); emit('update:modelValue', false)">填入答案</button>
      </template>
      <button class="secondary-action" @tap="emit('update:modelValue', false)">返回自己尝试</button>
    </view>
  </BottomSheet>
</template>
<style scoped>
.hint-content { padding: 12rpx 32rpx 28rpx; }
.position { display: block; font-size: 32rpx; font-weight: 650; }
.intro, .step { display: block; margin: 22rpx 0; line-height: 1.7; font-size: 28rpx; color: var(--text-secondary); }
.step { color: var(--text-primary); padding: 18rpx; background: var(--cell-bg); border-radius: 14rpx; }
.answer { display: block; margin: 18rpx 0; font-size: 30rpx; color: var(--primary); }
</style>
