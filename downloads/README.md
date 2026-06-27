# Cuemark installer downloads

Installer zips total **~90–100 MB** (Windows ~48 MB, macOS ~45 MB with bundled ffmpeg). They are too large to ship inside the Cloudflare Workers static deploy, which is why `/downloads/*.zip` on keyweaver.io would 404 if committed to the site repo.

## How downloads work

1. **Website** (`download.html`) loads `/downloads.json`, which points at **GitHub Releases** URLs.
2. **Cloudflare** ignores binaries via `.assetsignore` so deploys stay small and reliable.
3. **GitHub Releases** hosts the zip files (CDN-backed, anonymous download on the public repo).

## Publish a new version

From the Keyweaver repo root (requires [GitHub CLI](https://cli.github.com/) logged in):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-cuemark-release.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish-cuemark-github-release.ps1
```

Or build once and publish existing artifacts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish-cuemark-github-release.ps1 -SkipBuild
```

Then update `downloads.json` (`version`, tag, file URLs) and version strings on `download.html` if filenames change. Push the website repo so Cloudflare redeploys.

## Current release (v1.1.1)

- `Cuemark-Install-win-v1.1.1.zip` — extract, run `Install-Cuemark.cmd`
- `Cuemark-Install-mac-v1.1.1.zip` — extract, run `Install-Cuemark.command`

No standalone `.exe` is offered on the website (unsigned installers trigger SmartScreen).

## Local / fallback

`download.html` falls back to `/downloads/<filename>` if `downloads.json` cannot be loaded — useful when testing with files in this folder on a local static server.
