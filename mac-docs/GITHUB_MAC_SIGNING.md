# Mac Manager — GitHub Actions signing (no personal Mac required)

Yes: GitHub-hosted `macos-14` runners build, sign, and notarize `Keyweaver-Manager.pkg`.

## You already have

- Developer ID Application + Installer certificates
- Local `.p12` files in the monorepo `installer/mac-signing/` (gitignored)

## One more Apple thing (5 minutes)

Create an **App Store Connect API key** for notarization:

1. Open [App Store Connect → Users and Access → Integrations → Team Keys](https://appstoreconnect.apple.com/access/integrations/api)
2. Click **Generate API Key** (or +)
3. Name: `Keyweaver Notary`
4. Access: **Developer** (or Admin)
5. Download the `.p8` file once — you cannot download it again
6. Note **Key ID** and **Issuer ID** shown on that page

## GitHub secrets (repo `Paddy2522/keyweaver-io`)

| Secret | Value |
|--------|--------|
| `APPLE_APP_P12` | Base64 of `keyweaver-developer-id-application.p12` |
| `APPLE_INSTALLER_P12` | Base64 of `keyweaver-developer-id-installer.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Contents of `p12-password.txt` |
| `APPLE_API_KEY_P8` | Full text of the `.p8` file |
| `APPLE_API_KEY_ID` | Key ID from App Store Connect |
| `APPLE_API_ISSUER_ID` | Issuer ID from App Store Connect |

After secrets are set: **Actions → Build Keyweaver Mac Manager → Run workflow**.

The signed `.pkg` appears as a workflow artifact. Then we attach it to a Release and point the Mac download CTA at it.
