const SHARE_TEXT = '数独：离线关卡、候选笔记、解法提示和历史复盘。'

export function shareApp(): void {
  // #ifdef APP-PLUS
  try {
    plus.share.sendWithSystem({ type: 'text', content: SHARE_TEXT }, () => {}, () => {})
    return
  } catch {
    // Fall through to clipboard when system share is unavailable.
  }
  // #endif

  uni.setClipboardData({
    data: SHARE_TEXT,
    success: () => uni.showToast({ title: '分享文案已复制', icon: 'none' })
  })
}
