#Requires -Version 5.1
# Local stub - syncs live bootstrap from keyweaver.io, then opens Manager.
# Does not use DownloadString+Invoke-Expression (Defender treats that as malware).
$ErrorActionPreference = 'Stop'
$managerRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location -LiteralPath $managerRoot

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

function Show-ManagerLaunchError {
  param([string]$Detail)
  $msg = @"
Keyweaver Manager could not finish its update check.

$Detail

If Windows said virus / unwanted software: that is a false positive on Keyweaver Manager.
1. Open Windows Security → Virus & threat protection → Protection history
2. Find Keyweaver-Manager.exe → Actions → Allow / Restore
3. Reopen Keyweaver Manager from the Start Menu

Or run Manager without the .exe (same UI):
powershell -NoProfile -ExecutionPolicy Bypass -File `"$managerRoot\Keyweaver-Manager.ps1`"
"@
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
    [System.Windows.MessageBox]::Show($msg, 'Keyweaver Manager', 'OK', 'Error') | Out-Null
  } catch {
    Write-Host $msg
  }
}

function Start-ManagerUi {
  $exe = Join-Path $managerRoot 'Keyweaver-Manager.exe'
  $ps1 = Join-Path $managerRoot 'Keyweaver-Manager.ps1'
  if (Test-Path -LiteralPath $exe) {
    try {
      Start-Process -FilePath $exe -WorkingDirectory $managerRoot
      return
    } catch {
      if ($_.Exception.Message -notmatch 'virus|unwanted software|cannot be run') { throw }
      # Unsigned host sometimes flagged; fall through to .ps1
    }
  }
  if (-not (Test-Path -LiteralPath $ps1)) {
    throw "Keyweaver Manager not found at $managerRoot"
  }
  $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  Start-Process -FilePath $ps -WorkingDirectory $managerRoot -WindowStyle Hidden -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-File', $ps1
  )
}

$bootstrapUrl = 'https://keyweaver.io/installer/manager/bootstrap-launch.ps1?cb=' + [guid]::NewGuid().ToString('N')
$bootstrapPath = Join-Path $managerRoot 'bootstrap-launch.ps1'
try {
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
  $tmp = $bootstrapPath + '.download'
  $wc.DownloadFile($bootstrapUrl, $tmp)
  if (Test-Path -LiteralPath $bootstrapPath) { Remove-Item -LiteralPath $bootstrapPath -Force }
  Move-Item -LiteralPath $tmp -Destination $bootstrapPath -Force
  try { Unblock-File -LiteralPath $bootstrapPath -ErrorAction SilentlyContinue } catch {}
  # File-based run (not IEX). bootstrap-launch opens Manager when done.
  & $bootstrapPath
} catch {
  $detail = $_.Exception.Message
  # Sync failed (Defender / offline) — still try to open the last installed UI.
  try {
    Start-ManagerUi
    exit 0
  } catch {
    Show-ManagerLaunchError -Detail $detail
    exit 1
  }
}
