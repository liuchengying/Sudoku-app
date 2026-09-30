export function back() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) }) }
export function openPage(url: string) { uni.navigateTo({ url }) }
