# Cuemark installer downloads

Installer packages total **~150 MB** (Keyweaver bootstrap ~2.5 MB, Windows zip ~48 MB, macOS zip ~64 MB with bundled ffmpeg). They are too large to ship inside the Cloudflare Workers static deploy, which is why `/downloads/*` on keyweaver.io redirects to GitHub Releases.

## How downloads work

1. **Website** (`download.html`) loads `/downloads.json`, which lists **keyweaver.io** download URLs.
2. **Cloudflare redirects** (`_redirects`) map `/downloads/*` to **GitHub Releases** (binaries are not in the site deploy).
3. **Primary Windows download:** signed `Keyweaver-Setup-<bootstrapVersion>.exe` (Keyweaver Ltd) — installs **Keyweaver Manager**, then Cuemark installs from Manager.
4. **Remote catalog:** `installer/manifest.json` on keyweaver.io — Manager fetches product versions, zip URLs, and sizes.
5. **Fallback:** zip + `Install-Cuemark.cmd` (Windows) or `Install-Cuemark.command` (macOS).
6. **GitHub Releases** hosts the actual files (CDN-backed). Publish scripts sync `downloads.json` and `_redirects` after upload.

## Publish Cuemark plugin update (zip only)

From the Keyweaver repo root (requires [GitHub CLI](https://cli.github.com/) logged in):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-cuemark-release.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish-cuemark-github-release.ps1
```

Then sync the Manager manifest (no bootstrap rebuild):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\sync-keyweaver-installer-manifest.ps1
```

Push the website repo so Cloudflare redeploys.

## Publish Keyweaver Installer bootstrap (rare)

Only when Manager or bootstrap code changes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-keyweaver-installer.ps1 -Sign
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish-keyweaver-installer-github-release.ps1 -SkipBuild
```

## Current release

| File | Role |
|------|------|
| `Keyweaver-Setup-1.0.0.exe` | Signed bootstrap — primary Windows CTA on download page |
| `Cuemark-Install-win-v1.0.1.zip` | Zip fallback — extract, run `Install-Cuemark.cmd` |
| `Cuemark-Install-mac-v1.0.1.zip` | macOS — extract, run `Install-Cuemark.command` |
| `installer/manifest.json` | Manager product catalog (hosted on site, not redirected) |

## Local / fallback

`download.html` falls back to `/downloads/<filename>` if `downloads.json` cannot be loaded — useful when testing with files in this folder on a local static server.
