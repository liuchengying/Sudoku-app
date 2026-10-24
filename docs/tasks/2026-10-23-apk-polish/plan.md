# 实施计划

## 目标

1. 用贴合应用视觉的自定义启动图替换 Capacitor 默认启动图。
2. 为棋盘的正方形布局增加老 WebView 降级分支，避免 `aspect-ratio` 不可用时塌陷。

## 实现

1. `src/components/sudoku/SudokuBoard.vue`
   - 外层新增 `.board-frame`（`width: 100%`）。
   - 正常分支保持 `aspect-ratio: 1 / 1`。
   - `@supports not (aspect-ratio: 1 / 1)` 分支：`.board-frame` 使用 `position: relative; padding-top: 100%`，`.board` 绝对定位铺满，维持正方形。
2. `src/components/common/OnboardingGuide.vue`
   - `.rule-board` 外包 `.rule-board-frame`（限宽 540rpx）与 `.rule-board-square`（回退时承担百分比内边距）。
   - 同一降级分支内为 `.demo-board button` 补 `min-height: 44px`。
3. `src/pages/history/index.vue`
   - `.mini-cell` 补 `min-height: 18px`，`.mini-board` 补 `grid-auto-rows: minmax(18px, auto)`。
4. Android 打包壳（`unpackage/android`，生成目录，不入库）
   - 用本地脚本生成启动标志图（`drawable-*/splash_logo.png`，5 档密度）：品牌蓝 `#0864CF` 背景上放白色圆角卡片、绿色九宫格与“数独”字标。
   - 新增 `drawable/splash_background.xml`（layer-list：纯色 + 居中位图）与 `values/colors.xml`。
   - `values/styles.xml` 的启动主题改为引用 `@drawable/splash_background`。
   - 新增 `values-v31/styles.xml`，设置 Android 12+ 的 `windowSplashScreenBackground` 与前景图标。
   - 删除 Capacitor 默认 `splash.png`；启动图标同步为同色系。

## 检查与证据

- 注册检查：`adapter`、`adapter-tests`、`typecheck`、`unit`、`puzzles`、`ui`、`risk-evidence`。
- 公共组件改动：声明 `shared-contract`，影响记录见 `docs/tasks/2026-10-23-apk-polish/impact-shared-board.md`。
- 交付物：重新构建 `docs/build/sudoku-1.0.0.apk`，校验签名、包名、版本与启动图资源。

## 恢复

- 检查失败保留日志，按真实原因修复，不删减检查。
- 不操作 Git，不启动模拟器或浏览器；真机效果由用户验收。
