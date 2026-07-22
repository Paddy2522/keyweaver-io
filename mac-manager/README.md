# Keyweaver Manager (macOS)

SwiftUI app that mirrors Windows Keyweaver Manager:

1. Loads `https://keyweaver.io/installer/manifest.json`
2. Lists plugins with `platforms.mac`
3. Downloads zip → verifies SHA-256 → runs `*-install-macos.sh`

## Build (macOS only)

```bash
brew install xcodegen
./scripts/build-keyweaver-mac-manager.sh 1.0.0
./scripts/package-keyweaver-mac-manager.sh 1.0.0   # needs Developer ID + notarytool
```

See `docs/APPLE_MAC_SIGNING_SETUP.md`.

## Layout

```
KeyweaverManager/
  KeyweaverManagerApp.swift
  ContentView.swift
  Models/Manifest.swift
  Services/CatalogService.swift
  Services/InstallService.swift
  Resources/Info.plist
  Resources/KeyweaverManager.entitlements
project.yml          # XcodeGen → KeyweaverManager.xcodeproj
```
