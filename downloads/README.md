# Download files for keyweaver.io

Host installer files here (or on your CDN) so `/downloads/*` URLs on the site work.

## Build

From the Keyweaver repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-cuemark-release.ps1
```

Copy from `dist/cuemark-release/` into this folder (or your static host):

- `Cuemark-Setup-1.1.0.exe` (after installing [Inno Setup 6](https://jrsoftware.org/isinfo.php) and re-running the build)
- `Cuemark-Install-win-v1.1.0.zip`
- `Cuemark-Install-mac-v1.1.0.zip`

Vercel/static site: place files in `public/downloads/` if using Next.js, or equivalent.
