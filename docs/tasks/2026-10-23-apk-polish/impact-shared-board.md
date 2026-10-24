# 公共组件改动影响记录

任务：`2026-10-23-apk-polish`（启动图与老 WebView 降级）

## 改动内容

- `src/components/sudoku/SudokuBoard.vue`：在外层新增 `.board-frame`，并在 `@supports not (aspect-ratio: 1 / 1)` 分支用 `padding-top: 100%` + 绝对定位维持正方形。
- `src/components/common/OnboardingGuide.vue`：为 `.rule-board` 新增 `.rule-board-frame` / `.rule-board-square` 两层容器，仅在缺少 `aspect-ratio` 时启用回退；`.demo-board button` 在该分支补 `min-height: 44px`。
- `src/pages/history/index.vue`：`.mini-cell` 增加 `min-height: 18px`，`.mini-board` 增加 `grid-auto-rows: minmax(18px, auto)`。

## 调用方核对

| 调用方 | 位置 | 结论 |
| --- | --- | --- |
| 对局页 | `src/pages/game/index.vue` `.board-wrap` | 外层 `.board-wrap` 有显式像素宽度，`.board-frame` 宽度与之相等，百分比内边距解析正确；暂停遮罩仍通过 `:deep(.board)` 命中。 |
| 历史复盘 | `src/pages/history/detail.vue` `.board-shell` | `.board-shell` 宽度 100%，单层容器不影响宽度传递。 |
| 引导（首页） | `src/pages/home/index.vue` | 仅使用引导弹层，`.rule-board-frame` 限制了最大宽度 540rpx，回退高度按该宽度计算。 |
| 引导（对局页） | `src/pages/game/index.vue` | 同上。 |
| 引导（设置页） | `src/pages/settings/index.vue` | 同上。 |
| 历史列表 | `src/pages/history/index.vue` | 仅提高缩略格最小高度，不影响既有网格列宽。 |

## 回归风险

- 正常分支（支持 `aspect-ratio` 的浏览器/WebView）DOM 仅多一层 `width: 100%` 的容器，未改变棋盘尺寸来源。
- 回退分支只在 `@supports not (aspect-ratio: 1 / 1)` 内生效，不影响现代 WebView。
- `ui` 检查编译全部 SFC 并通过；`typecheck`、`unit`、`puzzles` 均通过。
