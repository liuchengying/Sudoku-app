#!/usr/bin/env bash
# Rebuilds the local Android APK (H5 bundle + Capacitor shell + Gradle release build).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

npm run build:h5

mkdir -p unpackage/android/www
find unpackage/android/www -mindepth 1 -delete
cp -R dist/build/h5/. unpackage/android/www/

cd unpackage/android
npx cap sync android

cd android
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"

./gradlew assembleRelease --no-daemon --console=plain -I ../mirror-init.gradle

cp app/build/outputs/apk/release/app-release.apk "$ROOT/docs/build/sudoku-1.0.0.apk"
echo "APK written to docs/build/sudoku-1.0.0.apk"
