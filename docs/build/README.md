# 本地 APK 打包说明

面向家庭内部分发的本地打包产物，不经过任何应用市场或云打包服务。

## 当前产物

- 文件：`docs/build/sudoku-1.0.0.apk`
- 应用名：数独
- 包名：`com.family.sudoku`
- 版本：`versionName 1.0.0` / `versionCode 10001`（2026-10-24 重新构建，含折叠屏/棋盘交互的最新源码）
- 历史包：`docs/build/archive/`（10000 版，含上次交付校验记录的原始文件）
- 支持系统：Android 6.0（API 23）及以上，targetSdk 35
- 签名：自签名证书（v1 + v2），证书 DN `CN=Family Sudoku`

安装方式：把 APK 发到手机，点开后允许“未知来源应用”即可安装。

## 重新打包

代码改动后执行：

```bash
bash docs/build/rebuild-apk.sh
```

脚本依次完成：H5 生产构建 → 复制到 Capacitor `www` → 同步 Android 工程 → Gradle release 打包 → 复制 APK 到 `docs/build/`。

## 升级注意事项

- 每次发新版必须把 `versionCode` 加一：`unpackage/android/android/app/build.gradle`。
- 必须继续使用 `~/.sudoku-signing/sudoku-release.keystore` 签名，否则手机无法覆盖安装，且会丢失本地存档。请务必备份该文件。
- 证书口令写在 `unpackage/android/android/keystore.properties`（该目录已被 git 忽略）。

## 环境依赖

- JDK 17：`/opt/homebrew/opt/openjdk@17`
- Android SDK：`~/Library/Android/sdk`（platform 35、build-tools 35.0.0、platform-tools）
- Gradle 8.9：由 wrapper 从腾讯镜像下载
- 依赖镜像：`unpackage/android/mirror-init.gradle`（阿里云 Maven）

## 视觉资源

- 应用图标：品牌蓝 `#0864CF` 底色 + 白色九宫格，位于 `res/mipmap-*`。
- 启动图：`res/drawable-*/splash_logo.png`（5 档密度）+ `res/drawable/splash_background.xml`（纯色底 + 居中标志），主题入口在 `res/values/styles.xml` 与 `res/values-v31/styles.xml`。
- 生成脚本：`unpackage/android/make-brand-assets.cjs`（依赖 sharp），改动后可重新执行。

## 已知限制

- APK 只在本地完成构建与签名校验，未在真机或模拟器上做运行验证。
- 棋盘尺寸默认使用 `aspect-ratio`，源码中已为不支持该特性的老 WebView 提供 `@supports` 降级分支；降级分支未在真实老设备上验证。
