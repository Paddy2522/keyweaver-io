# Cuemark installer downloads

Installer packages total **~150 MB** (Windows exe ~40 MB, Windows zip ~48 MB, macOS zip ~64 MB with bundled ffmpeg). They are too large to ship inside the Cloudflare Workers static deploy, which is why `/downloads/*.zip` on keyweaver.io would 404 if committed to the site repo.

## How downloads work

1. **Website** (`download.html`) loads `/downloads.json`, which lists **keyweaver.io** download URLs.
2. **Cloudflare redirects** (`_redirects`) map `/downloads/*` to **GitHub Releases** (binaries are not in the site deploy).
3. **Primary Windows download:** signed `Cuemark-Setup-<version>.exe` (Keyweaver Ltd).
4. **Fallback:** zip + `Install-Cuemark.cmd` (Windows) or `Install-Cuemark.command` (macOS).
5. **GitHub Releases** hosts the actual files (CDN-backed). `publish-cuemark-github-release.ps1` syncs `downloads.json` and `_redirects` after upload.

## Publish a new version

From the Keyweaver repo root (requires [GitHub CLI](https://cli.github.com/) logged in):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-cuemark-release.ps1 -IncludeExe -Sign
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish-cuemark-github-release.ps1 -IncludeSignedExe
```

Or build once and publish existing artifacts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish-cuemark-github-release.ps1 -SkipBuild -IncludeSignedExe
```

Then push the website repo so Cloudflare redeploys (`downloads.json` + `_redirects` are updated automatically by the publish script).

## Current release (v1.0.1)

- `Cuemark-Setup-1.0.1.exe` — signed installer (primary on download page)
- `Cuemark-Install-win-v1.0.1.zip` — extract, run `Install-Cuemark.cmd`
- `Cuemark-Install-mac-v1.0.1.zip` — extract, run `Install-Cuemark.command`

## Local / fallback

`download.html` falls back to `/downloads/<filename>` if `downloads.json` cannot be loaded — useful when testing with files in this folder on a local static server.
