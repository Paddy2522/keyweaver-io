# Keyweaver Manager live bootstrap — always download latest scripts (small files, no hash cache traps).
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
  'Sync-KeyweaverManagerRuntime.ps1'
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

$exe = Join-Path $managerRoot 'Keyweaver-Manager.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  throw "Keyweaver Manager not found at $managerRoot"
}
Start-Process -FilePath $exe -WorkingDirectory $managerRoot
