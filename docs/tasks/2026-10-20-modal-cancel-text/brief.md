# 确认弹窗取消按钮中文化

原始需求：用户原话："所有确认弹窗的取消按钮在 H5 显示英文 "Cancel" 把这个改了吧"。背景：2026-10-20 H5 内部浏览器验证（docs/tasks/2026-10-20-local-backup/observations/h5/VERIFICATION.md）发现全部 uni.showModal 确认弹窗的取消按钮显示英文 Cancel，原因是调用未传 cancelText。

## 验收条件

- cancel-text-zh：src 下全部 9 处 uni.showModal 确认弹窗均显式声明 cancelText: '取消'，H5 弹窗取消按钮显示中文，确认按钮文案与语义保持不变。
- regression-guard：docs/validation/validate-ui.cjs 新增静态规则：src 内每个 uni.showModal( 调用必须包含 cancelText:，遗漏时 ui 检查失败，防止回归。
- checks-pass：项目注册检查全部通过，且 AI 在内部浏览器实测至少两枚弹窗（退出本局、开始新游戏/导入确认）取消按钮显示"取消"。

## 修改范围

- src/pages/settings/index.vue
- src/pages/tutorial/index.vue
- src/pages/daily/index.vue
- src/pages/game/index.vue
- src/pages/levels/index.vue
- src/pages/import/index.vue
- docs/validation/validate-ui.cjs

## 允许的检查

adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence

## 未纳入本次自动验收

- AI 已按用户授权在内部浏览器实测弹窗文案；Android 真机弹窗样式未验证。
