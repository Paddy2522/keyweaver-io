# Apple Developer ID signing + notarization for Keyweaver Manager (macOS)

**Goal:** Ship a signed, notarized `Keyweaver-Manager-1.0.0.pkg` that installs **Keyweaver Manager.app** — same role as Windows `Keyweaver-Setup.exe`.

You do **not** need a personal Mac day-to-day. Build/sign on a **cloud Mac** or **GitHub Actions `macos-14`** runner once certs are set up.

---

## 1. Apple Developer Program (done)

You already enrolled. In [developer.apple.com/account](https://developer.apple.com/account):

1. Note your **Team ID** (Membership details).
2. Under **Certificates, Identifiers & Profiles**:
   - Create **Developer ID Application** (signs the `.app`)
   - Create **Developer ID Installer** (signs the `.pkg`)
3. Download both certificates and install them in **Keychain Access** on the Mac that will build (cloud Mac or CI).

Also create an **App Store Connect API key** (or app-specific password) for `notarytool`:

```bash
# One-time on the build Mac (stores creds in Keychain as profile "keyweaver-notary")
xcrun notarytool store-credentials "keyweaver-notary" \
  --apple-id "YOUR_APPLE_ID@email" \
  --team-id "YOUR_TEAM_ID" \
  --password "app-specific-password-or-api-key-flow"
```

Prefer API key form for CI:

```bash
xcrun notarytool store-credentials "keyweaver-notary" \
  --key ~/AuthKey_XXXXX.p8 \
  --key-id XXXXX \
  --issuer YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY
```

---

## 2. Local / cloud Mac build

```bash
# On macOS with Xcode + Homebrew
brew install xcodegen
chmod +x scripts/build-keyweaver-mac-manager.sh scripts/package-keyweaver-mac-manager.sh

./scripts/build-keyweaver-mac-manager.sh 1.0.0

# Set identities if your cert CN differs:
# export APP_IDENTITY="Developer ID Application: Keyweaver Ltd (TEAMID)"
# export INSTALLER_IDENTITY="Developer ID Installer: Keyweaver Ltd (TEAMID)"

./scripts/package-keyweaver-mac-manager.sh 1.0.0
```

Output: `dist/keyweaver-mac-manager/Keyweaver-Manager-1.0.0.pkg` (stapled).

---

## 3. GitHub Actions (recommended once secrets exist)

Workflow: `.github/workflows/keyweaver-mac-manager.yml`

Secrets to add on the **Keyweaver monorepo** (or a dedicated build repo):

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE_P12` | Base64 of .p12 exporting both Developer ID certs + private key |
| `APPLE_CERTIFICATE_PASSWORD` | Password for that .p12 |
| `APPLE_API_KEY_P8` | App Store Connect API key `.p8` contents |
| `APPLE_API_KEY_ID` | Key ID |
| `APPLE_API_ISSUER_ID` | Issuer UUID |
| `APPLE_TEAM_ID` | Team ID |

The workflow builds, signs, notarizes, and uploads the `.pkg` as a workflow artifact (and can attach to a GitHub Release).

---

## 4. Website wiring (after first successful pkg)

1. Upload `Keyweaver-Manager-1.0.0.pkg` to `Paddy2522/keyweaver-io` Releases.
2. Add `_redirects` rule:
   `/downloads/Keyweaver-Manager-1.0.0.pkg → GitHub release asset`
3. Add `macExe` / `macPkg` to `downloads.json`.
4. Update `download.html` Mac primary CTA → Manager pkg (keep per-plugin zips as fallback).

Do **not** change the Mac download CTA until the notarized pkg is live.

---

## 5. Architecture reminder

```
Keyweaver-Manager-1.0.0.pkg   (signed + notarized, rarely rebuilt)
        ↓
Keyweaver Manager.app
        ↓
https://keyweaver.io/installer/manifest.json  → platforms.mac
        ↓
per-plugin zip + *-install-macos.sh
```

Plugin updates = **manifest + zip only** (same rule as Windows).

---

## 6. What Cursor already added in-repo

| Path | Role |
|------|------|
| `installer/mac-manager/` | SwiftUI Manager sources + `project.yml` (XcodeGen) |
| `scripts/build-keyweaver-mac-manager.sh` | Build `.app` |
| `scripts/package-keyweaver-mac-manager.sh` | Sign, pkg, notarize, staple |
| `.github/workflows/keyweaver-mac-manager.yml` | CI skeleton |

---

## Next actions for you

1. On Apple Developer, create the two **Developer ID** certificates.  
2. Export a `.p12` (or install certs on a cloud Mac).  
3. Create App Store Connect API key for notarization.  
4. Tell me when secrets are ready — we can run the first CI build / cloud Mac package and then wire the download page.
