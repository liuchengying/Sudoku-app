<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import { techniqueName, type HintResult } from '@/core/sudoku'
const props = defineProps<{ modelValue: boolean; hint: HintResult | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'reveal'): void; (e: 'apply'): void }>()
const cursor = ref(-1)
watch(() => props.modelValue, open => { if (open) cursor.value = -1 })
const steps = computed(() => props.hint?.steps?.length ? props.hint.steps.map(s => `${techniqueName(s.technique)}：${s.message}`) : [props.hint?.message ?? ''])
function reveal() { emit('reveal'); cursor.value = 0 }
</script>
<template>
  <BottomSheet :model-value="modelValue" title="分步解法" @update:model-value="emit('update:modelValue', $event)">
    <view class="hint-content">
      <template v-if="cursor < 0">
        <text class="position">寻找全盘下一步</text>
        <text class="intro">先检查已有填写，再寻找可推导的空格。提示目标可能与当前选中格不同。打开或关闭这段说明不计提示。</text>
        <text class="intro">查看有效推导计 1 次提示，本局完成后将获得铜牌。棋盘未改变时重复查看同一步不重复计数。</text>
        <button class="primary-action reveal-hint" @tap="reveal">查看下一步推导</button>
      </template>
      <template v-else-if="hint">
      <text class="position">观察第 {{ Math.floor(hint.index / 9) + 1 }} 行第 {{ hint.index % 9 + 1 }} 列</text>
      <text class="intro">已查看这一步提示。继续展开或填入同一步答案不会重复计数。</text>
      <text v-for="(message, i) in steps.slice(0, cursor + 1)" :key="i" class="step">{{ i + 1 }}. {{ message }}</text>
      <button v-if="cursor < steps.length - 1" class="primary-action" @tap="cursor++">{{ cursor < 0 ? '查看推导' : '展开下一步' }}</button>
      <template v-else>
        <text class="answer">这个格可填 {{ hint.digit }}</text>
        <button class="primary-action" @tap="emit('apply'); emit('update:modelValue', false)">填入答案</button>
      </template>
      </template>
      <button class="secondary-action" @tap="emit('update:modelValue', false)">返回自己尝试</button>
    </view>
  </BottomSheet>
</template>
<style scoped>
.hint-content { padding: 12rpx 32rpx 28rpx; }
.position { display: block; font-size: clamp(13.6px, 32rpx, 16px); font-weight: 650; }
.intro, .step { display: block; margin: 22rpx 0; line-height: 1.7; font-size: clamp(11.9px, 28rpx, 14px); color: var(--text-secondary); }
.step { color: var(--text-primary); padding: 18rpx; background: var(--cell-bg); border-radius: 14rpx; }
.answer { display: block; margin: 18rpx 0; font-size: clamp(12.75px, 30rpx, 15px); color: var(--primary); }
</style>
