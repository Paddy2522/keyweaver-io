#Requires -Version 5.1
# Frozen local stub — always runs live bootstrap from keyweaver.io before opening Manager.
$ErrorActionPreference = 'Stop'
$managerRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location -LiteralPath $managerRoot

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

$bootstrapUrl = 'https://keyweaver.io/installer/manager/bootstrap-launch.ps1?cb=' + [guid]::NewGuid().ToString('N')
try {
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
  $script = $wc.DownloadString($bootstrapUrl)
  Invoke-Expression $script
} catch {
  $msg = "Keyweaver Manager could not download updates.`n`n$($_.Exception.Message)`n`nCheck your internet connection and try again."
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
    [System.Windows.MessageBox]::Show($msg, 'Keyweaver Manager', 'OK', 'Error') | Out-Null
  } catch {
    Write-Host $msg
  }
  exit 1
}
