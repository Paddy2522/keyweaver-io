# Keyweaver Manager live bootstrap — always download latest scripts (small files, no hash cache traps).
$ErrorActionPreference = 'Stop'
if (-not $managerRoot) {
  $managerRoot = Join-Path $env:LOCALAPPDATA 'Keyweaver\Manager'
}
$managerRoot = [System.IO.Path]::GetFullPath($managerRoot)

$baseUrl = 'https://keyweaver.io/installer/manager/'
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
  $wc.DownloadFile($baseUrl + $name, $tmp)
  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
  Move-Item -LiteralPath $tmp -Destination $dest
}

$exe = Join-Path $managerRoot 'Keyweaver-Manager.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  throw "Keyweaver Manager not found at $managerRoot"
}
Start-Process -FilePath $exe -WorkingDirectory $managerRoot
