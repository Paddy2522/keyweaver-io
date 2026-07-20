# Keyweaver Manager live bootstrap — sync latest runtime from keyweaver.io, then open Manager.
$ErrorActionPreference = 'Stop'
if (-not $managerRoot) {
  $managerRoot = Join-Path $env:LOCALAPPDATA 'Keyweaver\Manager'
}
$managerRoot = [System.IO.Path]::GetFullPath($managerRoot)
$stateRoot = Join-Path $env:LOCALAPPDATA 'Keyweaver\State'

$baseUrl = 'https://keyweaver.io/installer/manager/'
$catalogUrl = 'https://keyweaver.io/installer/manifest.json'
$runtimeFiles = @(
  'Keyweaver-Manager.ps1',
  'Keyweaver-InstallLib.ps1',
  'Keyweaver-Manager-Launcher.ps1',
  'Sync-KeyweaverManagerRuntime.ps1',
  'Keyweaver-Manager.cmd',
  'Keyweaver-Manager.vbs'
)

foreach ($name in $runtimeFiles) {
  $dest = Join-Path $managerRoot $name
  $tmp = $dest + '.download'
  $parent = Split-Path -Parent $dest
  if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
  $url = $baseUrl + $name + '?cb=' + [guid]::NewGuid().ToString('N')
  $wc.DownloadFile($url, $tmp)
  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
  Move-Item -LiteralPath $tmp -Destination $dest
}

# Full catalog sync (exe, icons, images, hashes).
# Scripts above were already refreshed; Sync failure must not block opening Manager.
$syncScript = Join-Path $managerRoot 'Sync-KeyweaverManagerRuntime.ps1'
if (Test-Path -LiteralPath $syncScript) {
  try {
    & $syncScript -ManagerRoot $managerRoot -ManifestUrl $catalogUrl
  } catch {
    Write-Verbose ("Manager sync warning: " + $_.Exception.Message)
  }
}

# Record the catalog Manager version so the UI knows this launch already synced scripts.
try {
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
  $raw = $wc.DownloadString($catalogUrl + '?cb=' + [guid]::NewGuid().ToString('N'))
  $manifest = $raw | ConvertFrom-Json
  $managerVersion = if ($manifest.manager -and $manifest.manager.version) {
    [string]$manifest.manager.version
  } else {
    $null
  }
  if ($managerVersion) {
    if (-not (Test-Path -LiteralPath $stateRoot)) {
      New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
    }
    [System.IO.File]::WriteAllText(
      (Join-Path $stateRoot 'manager-runtime-version.txt'),
      $managerVersion
    )
    [System.IO.File]::WriteAllText(
      (Join-Path $managerRoot 'VERSION'),
      $managerVersion
    )
  }
} catch {
  # Offline / catalog failure — Manager still opens with previously synced scripts.
}

# Point Start Menu / Desktop shortcuts at silent VBS launcher (no Setup rebuild needed).
try {
  $vbsPath = Join-Path $managerRoot 'Keyweaver-Manager.vbs'
  $icoPath = Join-Path $managerRoot 'keyweaver.ico'
  if (Test-Path -LiteralPath $vbsPath) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcutPaths = @(
      (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Keyweaver\Keyweaver Manager.lnk'),
      (Join-Path $env:USERPROFILE 'Desktop\Keyweaver Manager.lnk')
    )
    foreach ($shortcutPath in $shortcutPaths) {
      if (-not (Test-Path -LiteralPath $shortcutPath)) { continue }
      $lnk = $shell.CreateShortcut($shortcutPath)
      $lnk.TargetPath = $vbsPath
      $lnk.WorkingDirectory = $managerRoot
      if (Test-Path -LiteralPath $icoPath) {
        $lnk.IconLocation = $icoPath
      }
      $lnk.Save()
    }
  }
} catch {}

$exe = Join-Path $managerRoot 'Keyweaver-Manager.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  throw "Keyweaver Manager not found at $managerRoot"
}
Start-Process -FilePath $exe -WorkingDirectory $managerRoot
