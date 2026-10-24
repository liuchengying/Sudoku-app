1. SudokuBoard.vue 增加外层 .board-frame，正常分支保持 aspect-ratio 正方形，@supports not (aspect-ratio: 1/1) 分支用 padding-top:100% + 绝对定位回退。
2. OnboardingGuide.vue 的 .rule-board 采用同样回退；history/index.vue 的 .mini-cell 增加最小高度，避免不支持时塌陷。
3. 用 sharp 生成自定义启动图：浅绿画布上居中放置白色圆角卡片，内含 3×3 棋盘标记（绿色格线、重点色高亮格）与“数独”字标；放入 drawable-nodpi，主题改用 layer-list 背景（颜色 + 居中位图），并补充 Android 12 的 windowSplashScreen 属性；删除 Capacitor 默认 splash.png。
4. 运行注册检查；重新执行 H5 构建 → cap sync → Gradle release 打包，校验签名、包名、版本与新资源。
5. 会话内逐项复核并 finish 交付；不操作 Git，不启动模拟器。