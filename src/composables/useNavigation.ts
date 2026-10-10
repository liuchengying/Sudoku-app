import { useGameStore } from '@/stores/game.store'

export function back() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) }) }
export function openPage(url: string) { uni.navigateTo({ url }) }

export function continueGame() {
  const store = useGameStore()
  if (!store.game || store.game.status === 'COMPLETED') return
  const id = store.game.id
  store.resume()
  uni.navigateTo({ url: '/pages/game/index', fail: () => {
    if (store.game?.id === id) store.pause()
    uni.showToast({ title: '暂时无法打开棋盘，请再试一次', icon: 'none' })
  } })
}
