<script setup lang="ts">
import { onHide, onLaunch } from '@dcloudio/uni-app'
import { useGameStore } from '@/stores/game.store'

onLaunch(() => {
  try {
    uni.setNavigationBarColor?.({ frontColor: '#000000', backgroundColor: '#ffffff' })
  } catch {
    // Custom-navigation pages do not require this on every platform.
  }
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
