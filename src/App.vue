<script setup lang="ts">
import { onHide, onLaunch } from '@dcloudio/uni-app'
import { useGameStore } from '@/stores/game.store'
import { useSettingsStore } from '@/stores/settings.store'
import { watch } from 'vue'

onLaunch(() => {
  const settings = useSettingsStore()
  watch(() => settings.settings.theme, theme => {
    try {
      uni.setNavigationBarColor?.({ frontColor: theme === 'dark' ? '#ffffff' : '#000000', backgroundColor: theme === 'dark' ? '#141922' : '#ffffff' })
    } catch { /* Custom navigation may not expose native status bar controls. */ }
  }, { immediate: true })
})

onHide(() => {
  const gameStore = useGameStore()
  gameStore.pause(true)
  gameStore.flushSave()
})
</script>

<style lang="scss">
@import './styles.scss';
</style>
