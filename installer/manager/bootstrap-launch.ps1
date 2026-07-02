# Keyweaver Manager live bootstrap — hosted on keyweaver.io, updated without rebuilding Keyweaver-Setup.exe.
$ErrorActionPreference = 'Stop'
if (-not $managerRoot) {
  $managerRoot = Join-Path $env:LOCALAPPDATA 'Keyweaver\Manager'
}
$managerRoot = [System.IO.Path]::GetFullPath($managerRoot)

$syncScriptUrl = 'https://keyweaver.io/installer/manager/Sync-KeyweaverManagerRuntime.ps1'
$syncPath = Join-Path $env:TEMP 'kw-manager-sync.ps1'
(New-Object System.Net.WebClient).DownloadFile($syncScriptUrl, $syncPath)
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $syncPath -ManagerRoot $managerRoot

$exe = Join-Path $managerRoot 'Keyweaver-Manager.exe'
if (-not (Test-Path -LiteralPath $exe)) {
  throw "Keyweaver Manager not found at $managerRoot"
}
Start-Process -FilePath $exe -WorkingDirectory $managerRoot
