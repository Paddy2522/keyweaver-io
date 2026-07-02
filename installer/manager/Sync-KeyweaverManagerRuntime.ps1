#Requires -Version 5.1
<#
  Sync Keyweaver Manager runtime files from keyweaver.io/installer/manifest.json.
  Called by bootstrap-launch.ps1 (website) and optionally local tooling.
#>
param(
  [string]$ManagerRoot = '',
  [string]$ManifestUrl = 'https://keyweaver.io/installer/manifest.json'
)

$ErrorActionPreference = 'Stop'

if (-not $ManagerRoot) {
  $ManagerRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
}

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Get-FileSha256Hex {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return '' }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-ManagerRuntimeFileHashes {
  param($ManagerMeta)
  $result = @{}
  if (-not $ManagerMeta -or -not $ManagerMeta.files) { return $result }
  $files = $ManagerMeta.files
  if ($files -is [System.Collections.IDictionary]) {
    foreach ($k in $files.Keys) { $result[[string]$k] = [string]$files[$k] }
  } else {
    foreach ($p in $files.PSObject.Properties) {
      $result[$p.Name] = [string]$p.Value
    }
  }
  return $result
}

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

$wc = New-Object System.Net.WebClient
$wc.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
$raw = [System.Text.Encoding]::UTF8.GetString($wc.DownloadData($ManifestUrl))
$manifest = $raw | ConvertFrom-Json
if (-not $manifest -or -not $manifest.manager) { return }

$mgr = $manifest.manager
$baseUrl = [string]$mgr.baseUrl
if (-not $baseUrl.Length) { $baseUrl = 'https://keyweaver.io/installer/manager/' }
if (-not $baseUrl.EndsWith('/')) { $baseUrl += '/' }

$expected = Get-ManagerRuntimeFileHashes $mgr
foreach ($entry in $expected.GetEnumerator()) {
  $name = $entry.Key
  $dest = Join-Path $ManagerRoot $name
  $hash = (Get-FileSha256Hex $dest).ToLowerInvariant()
  if ($hash -eq $entry.Value.ToLowerInvariant()) { continue }

  $url = $baseUrl + $name
  $tmp = $dest + '.download'
  Ensure-Directory (Split-Path -Parent $dest)
  $dl = New-Object System.Net.WebClient
  $dl.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
  $dl.DownloadFile($url, $tmp)
  $newHash = (Get-FileSha256Hex $tmp).ToLowerInvariant()
  if ($newHash -ne $entry.Value.ToLowerInvariant()) {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    throw "Manager sync failed checksum for $name"
  }
  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
  Move-Item -LiteralPath $tmp -Destination $dest
}

if ($mgr.version) {
  $stateRoot = Join-Path $env:LOCALAPPDATA 'Keyweaver\State'
  Ensure-Directory $stateRoot
  [System.IO.File]::WriteAllText((Join-Path $stateRoot 'manager-runtime-version.txt'), [string]$mgr.version)
}
