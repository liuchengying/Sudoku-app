# APK 构建与校验记录

构建时间：2026-10-23
产物：`docs/build/sudoku-1.0.0.apk`

## 构建链路

1. `npm run build:h5` → `DONE Build complete.`
2. 复制 `dist/build/h5` 到 `unpackage/android/www`
3. `npx cap sync android` → `Sync finished`
4. `./gradlew assembleRelease -I ../mirror-init.gradle` → `BUILD SUCCESSFUL`

## 校验输出

签名（apksigner）：

```
Signer #1 certificate DN: CN=Family Sudoku, OU=Personal, O=Family, C=CN
Signer #1 certificate SHA-256 digest: 666b0f8b0b60ca10c6752b22c4e2548d1330d4330cc8731781475f3978753c2c
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
```

包信息（aapt2 dump badging）：

```
package: name='com.family.sudoku' versionCode='10000' versionName='1.0.0'
targetSdkVersion:'35'
application-label:'数独'
```

启动图资源已编译进 APK（aapt2 dump resources）：

```
resource 0x7f050055 color/splash_background
resource 0x7f070070 drawable/splash_background
resource 0x7f070071 drawable/splash_logo
0x010100d4=@drawable/splash_background
0x0101062c=@color/splash_background
```

体积与摘要：

```
size: 2.9M
sha256: c3aa5a4729b137c65fcb20890ce5e763c6e40bdf0c57d95eb45795b15b9ce324
```

老 WebView 降级规则已进入构建产物（`dist/build/h5/assets/*.css`）：

```
@supports not (aspect-ratio: 1/1)
```

## 未验证事项

未连接真机或模拟器，未在设备上观察启动图切换与 `@supports` 降级分支的实际渲染；真机体验需用户验收。
