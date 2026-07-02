#Requires -Version 5.1
# Frozen local stub — always runs live bootstrap from keyweaver.io before opening Manager.
$ErrorActionPreference = 'Stop'
$managerRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location -LiteralPath $managerRoot

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

$bootstrapUrl = 'https://keyweaver.io/installer/manager/bootstrap-launch.ps1'
$script = (New-Object System.Net.WebClient).DownloadString($bootstrapUrl)
Invoke-Expression $script
