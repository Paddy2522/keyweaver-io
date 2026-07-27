#!/usr/bin/env bash
# Build Keyweaver Manager.app as a universal (arm64 + x86_64) binary.
# Requires: macOS, Xcode, xcodegen (brew install xcodegen)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Website repo keeps sources under mac-manager/; monorepo under installer/mac-manager/
if [[ -d "$ROOT/mac-manager" ]]; then
  APP_DIR="$ROOT/mac-manager"
elif [[ -d "$ROOT/installer/mac-manager" ]]; then
  APP_DIR="$ROOT/installer/mac-manager"
else
  echo "mac-manager sources not found under $ROOT" >&2
  exit 1
fi
OUT_DIR="$ROOT/dist/keyweaver-mac-manager"
VERSION="${1:-1.0.0}"
ICON_SRC="$APP_DIR/KeyweaverManager/Resources/AppIconSource.png"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS." >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen not found. Install with: brew install xcodegen" >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild not found. Install Xcode from the App Store." >&2
  exit 1
fi

cd "$APP_DIR"
# Keep Marketing version in sync when passed
/usr/bin/sed -i '' "s/MARKETING_VERSION: \".*\"/MARKETING_VERSION: \"${VERSION}\"/" project.yml || true

xcodegen generate
mkdir -p "$OUT_DIR"

# Universal binary — required so Intel Macs can open the app built on Apple Silicon runners.
xcodebuild \
  -project KeyweaverManager.xcodeproj \
  -scheme KeyweaverManager \
  -configuration Release \
  -derivedDataPath "$OUT_DIR/DerivedData" \
  -archivePath "$OUT_DIR/KeyweaverManager.xcarchive" \
  ARCHS="arm64 x86_64" \
  ONLY_ACTIVE_ARCH=NO \
  EXCLUDED_ARCHS= \
  CODE_SIGNING_ALLOWED=NO \
  archive

APP_SRC="$OUT_DIR/KeyweaverManager.xcarchive/Products/Applications/Keyweaver Manager.app"
if [[ ! -d "$APP_SRC" ]]; then
  echo "Archive did not produce Keyweaver Manager.app" >&2
  ls -la "$OUT_DIR/KeyweaverManager.xcarchive/Products/Applications" || true
  exit 1
fi

rm -rf "$OUT_DIR/Keyweaver Manager.app"
ditto "$APP_SRC" "$OUT_DIR/Keyweaver Manager.app"
APP="$OUT_DIR/Keyweaver Manager.app"

BIN="$APP/Contents/MacOS/Keyweaver Manager"
if [[ ! -f "$BIN" ]]; then
  # PRODUCT_NAME may differ slightly; pick the first Mach-O in MacOS/
  BIN="$(find "$APP/Contents/MacOS" -type f | head -n 1)"
fi
ARCHS_FOUND="$(lipo -archs "$BIN" 2>/dev/null || true)"
echo "Binary architectures: ${ARCHS_FOUND:-unknown}"
if [[ "$ARCHS_FOUND" != *"arm64"* || "$ARCHS_FOUND" != *"x86_64"* ]]; then
  echo "ERROR: expected universal arm64+x86_64 binary, got: ${ARCHS_FOUND:-none}" >&2
  exit 1
fi

# Embed Keyweaver app icon (.icns) if source PNG is present
if [[ -f "$ICON_SRC" ]]; then
  ICONSET="$OUT_DIR/AppIcon.iconset"
  rm -rf "$ICONSET"
  mkdir -p "$ICONSET"
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$ICON_SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
    sips -z "$((size * 2))" "$((size * 2))" "$ICON_SRC" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$OUT_DIR/AppIcon.icns"
  mkdir -p "$APP/Contents/Resources"
  cp "$OUT_DIR/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
  PLIST="$APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c "Delete :CFBundleIconFile" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" "$PLIST"
  echo "Embedded AppIcon.icns"
else
  echo "WARNING: no AppIconSource.png at $ICON_SRC — app will use the default generic icon" >&2
fi

echo "Built: $APP"
