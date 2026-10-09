import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { settingsRepository } from '@/repositories/settings.repository'
import type { AppSettings } from '@/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive<AppSettings>(settingsRepository.load())
  const onboardingDismissed = ref(false)
  const shouldShowOnboarding = computed(() => !settings.onboardingSeen && !onboardingDismissed.value)

  function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    try {
      settingsRepository.save({ ...settings, [key]: value })
      settings[key] = value
      return true
    } catch { uni.showToast({ title: '设置保存失败，请释放设备存储后重试', icon: 'none' }); return false }
  }

  function dismissOnboarding() {
    // A full device must not trap a player in the guide. Retry on a cold start.
    if (!settings.onboardingSeen) setSetting('onboardingSeen', true)
    onboardingDismissed.value = true
  }

  function reload() {
    Object.assign(settings, settingsRepository.load())
  }

  function reset() {
    Object.assign(settings, settingsRepository.reset())
  }

  return { settings, shouldShowOnboarding, setSetting, dismissOnboarding, reload, reset }
})
