#!/usr/bin/env bash
# Build Keyweaver Manager.app (unsigned or locally signed).
# Requires: macOS, Xcode, xcodegen (brew install xcodegen)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/mac-manager"
OUT_DIR="$ROOT/dist/keyweaver-mac-manager"
VERSION="${1:-1.0.0}"

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

xcodebuild \
  -project KeyweaverManager.xcodeproj \
  -scheme KeyweaverManager \
  -configuration Release \
  -derivedDataPath "$OUT_DIR/DerivedData" \
  -archivePath "$OUT_DIR/KeyweaverManager.xcarchive" \
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
echo "Built: $OUT_DIR/Keyweaver Manager.app"
