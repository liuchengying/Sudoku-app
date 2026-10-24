# APK 启动图与棋盘老设备降级

原始需求：用户原话："你最后提到的这两点短板，你马上修改一下，对于启动图，你可以自行设计一下，要贴合当前的数独以及整体样式风格"。背景：本地 Capacitor 打包的 APK 使用默认白色启动图（带 Capacitor 标志），且主棋盘依赖 aspect-ratio 保持正方形，在老系统 WebView 上可能布局塌陷。

## 验收条件

- splash-custom：启动主题引用自定义背景与居中的数独标志图，配色取自应用现有变量（board-green 画布 #F4F8EF、棋盘线 #354D36、重点色 #0864CF），不再使用 Capacitor 默认 splash 图；横竖屏与各密度下标志居中且不拉伸。
- square-fallback：主棋盘与引导棋盘在 @supports not (aspect-ratio) 分支下通过容器 padding-top:100% + 绝对定位保持正方形；历史缩略棋盘设置最小行高，不支持 aspect-ratio 时不塌陷为一条线。
- checks-pass：项目注册检查（adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence）全部通过。
- apk-rebuilt：重新构建的 release APK 签名校验通过，包名 com.family.sudoku、versionCode 10000 保持不变，且 APK 内含自定义启动图资源。

## 修改范围

- src/components/sudoku/SudokuBoard.vue
- src/components/common/OnboardingGuide.vue
- src/pages/history/index.vue

## 允许的检查

adapter、adapter-tests、typecheck、unit、puzzles、ui、risk-evidence

## 未纳入本次自动验收

- 未连接真机或模拟器，启动图实际显示效果与老 WebView 降级效果未做设备验证；仅做静态与构建校验。
