#!/usr/bin/env bash
# Sign + package Keyweaver Manager as a Developer ID .pkg and notarize.
#
# Prereqs (see docs/APPLE_MAC_SIGNING_SETUP.md):
#   - Developer ID Application + Installer certs in Keychain
#   - notarytool credentials stored (profile keyweaver-notary)
#
# Usage:
#   ./scripts/package-keyweaver-mac-manager.sh 1.0.0
#   TEAM_ID=XXXXXXXXXX APPLE_ID=you@keyweaver.io ./scripts/package-keyweaver-mac-manager.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/dist/keyweaver-mac-manager"
VERSION="${1:-1.0.0}"
APP="$OUT_DIR/Keyweaver Manager.app"
PKG_ROOT="$OUT_DIR/pkgroot"
COMPONENT_PKG="$OUT_DIR/KeyweaverManager-component.pkg"
SIGNED_PKG="$OUT_DIR/Keyweaver-Manager-${VERSION}.pkg"
IDENTIFIER="io.keyweaver.manager"
NOTARY_PROFILE="${NOTARY_PROFILE:-keyweaver-notary}"

APP_IDENTITY="${APP_IDENTITY:-Developer ID Application: Keyweaver Limited (4M29F3JH68)}"
INSTALLER_IDENTITY="${INSTALLER_IDENTITY:-Developer ID Installer: Keyweaver Limited (4M29F3JH68)}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS." >&2
  exit 1
fi

if [[ ! -d "$APP" ]]; then
  echo "App not found. Run scripts/build-keyweaver-mac-manager.sh first." >&2
  exit 1
fi

echo "Signing app with: $APP_IDENTITY"
codesign --force --deep --options runtime \
  --entitlements "$ROOT/mac-manager/KeyweaverManager/Resources/KeyweaverManager.entitlements" \
  --sign "$APP_IDENTITY" \
  "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

echo "Building component pkg…"
rm -rf "$PKG_ROOT"
mkdir -p "$PKG_ROOT/Applications"
ditto "$APP" "$PKG_ROOT/Applications/Keyweaver Manager.app"

pkgbuild \
  --root "$PKG_ROOT" \
  --identifier "$IDENTIFIER" \
  --version "$VERSION" \
  --install-location "/" \
  "$COMPONENT_PKG"

echo "Product-signing pkg with: $INSTALLER_IDENTITY"
productsign --sign "$INSTALLER_IDENTITY" "$COMPONENT_PKG" "$SIGNED_PKG"
pkgutil --check-signature "$SIGNED_PKG" || true

echo "Submitting for notarization (profile: $NOTARY_PROFILE)…"
xcrun notarytool submit "$SIGNED_PKG" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$SIGNED_PKG"
xcrun stapler validate "$SIGNED_PKG"

echo ""
echo "Done: $SIGNED_PKG"
echo "Upload to GitHub Releases and point /downloads/Keyweaver-Manager-${VERSION}.pkg at it."
