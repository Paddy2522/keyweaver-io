# Cuemark installer downloads

The three installer files total **~140 MB**. That is too large to ship inside a Vercel static deploy (Hobby plan output is capped around **100 MB**), which is why `/downloads/*.exe` and `/downloads/*.zip` returned **404** on keyweaver.io even though they were committed to git.

## How downloads work now

1. **Website** (`download.html`) loads `/downloads.json`, which points at **GitHub Releases** URLs.
2. **Vercel** ignores the binary files via `.vercelignore` so the site deploy stays small and reliable.
3. **GitHub Releases** hosts the actual `.exe` / `.zip` files (free, CDN-backed, no size issue for this use case).

## One-time setup (per version)

After building installers (`scripts/build-cuemark-release.ps1`):

1. Open [keyweaver-io Releases](https://github.com/Paddy2522/keyweaver-io/releases)
2. **Draft a new release** — tag `v1.1.0` (must match `downloads.json`)
3. Attach these files from `dist/cuemark-release/` or `Captio/Website/downloads/`:
   - `Cuemark-Setup-1.1.0.exe`
   - `Cuemark-Install-win-v1.1.0.zip`
   - `Cuemark-Install-mac-v1.1.0.zip`
4. Publish the release
5. Verify links work, e.g.  
   `https://github.com/Paddy2522/keyweaver-io/releases/download/v1.1.0/Cuemark-Setup-1.1.0.exe`

Or run from Keyweaver repo root (requires [GitHub CLI](https://cli.github.com/) logged in):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish-cuemark-github-release.ps1
```

## Bumping a version

1. Build new installers
2. Update `downloads.json` (`version`, tag, and file URLs)
3. Create new GitHub release with matching tag
4. Update version strings on `download.html` if filenames change

## Local / fallback

`download.html` falls back to `/downloads/<filename>` if `downloads.json` cannot be loaded — useful when testing with files in this folder on a local static server.
