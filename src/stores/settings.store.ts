import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { settingsRepository } from '@/repositories/settings.repository'
import type { AppSettings } from '@/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive<AppSettings>(settingsRepository.load())

  function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    try {
      settingsRepository.save({ ...settings, [key]: value })
      settings[key] = value
    } catch { uni.showToast({ title: '设置保存失败，请释放设备存储后重试', icon: 'none' }) }
  }

  function reload() {
    Object.assign(settings, settingsRepository.load())
  }

  function reset() {
    Object.assign(settings, settingsRepository.reset())
  }

  return { settings, setSetting, reload, reset }
})
