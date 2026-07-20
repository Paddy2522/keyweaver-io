# Keyweaver Manager install library â€” loaded in a dedicated runspace for background installs.
#Requires -Version 5.1

Add-Type -AssemblyName System.IO.Compression.FileSystem
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

# Static zip sizes (bytes) for progress ratio when manifest omits sizeBytes. Keep in sync with release zips.
$script:KnownPackageSizes = @{
  cuemark = [int64]50038336
  superconductor = [int64]126271
  ludo = [int64]302084
  trillian = [int64]123765
  tamborine = [int64]120657
}

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-JsonFile {
  param([string]$Path, $Object)
  Ensure-Directory (Split-Path -Parent $Path)
  $json = $Object | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($Path, $json)
}

function Repair-DisplayText {
  param([string]$Text)
  if (-not $Text) { return $Text }
  $t = [string]$Text
  $t = $t.Replace([string][char]0x00B7, ' - ')
  $t = $t.Replace([string][char]0x2022, ' - ')
  $t = $t.Replace([string][char]0x2013, '-')
  $t = $t.Replace([string][char]0x2014, '-')
  $badDash1 = -join @([char]0x00E2, [char]0x20AC, [char]0x0094)
  $badDash2 = -join @([char]0x00E2, [char]0x20AC, [char]0x0093)
  $badDot = -join @([char]0x00C2, [char]0x00B7)
  $t = $t.Replace($badDash1, '-')
  $t = $t.Replace($badDash2, '-')
  $t = $t.Replace($badDot, ' - ')
  return $t
}

function Send-InstallWorkerProgress {
  param(
    $Worker,
    [string]$Status,
    [double]$Percent
  )
  if (-not $Worker) { return }
  $pct = [int][Math]::Max(0, [Math]::Min(100, [Math]::Round($Percent)))
  $state = [System.Collections.Hashtable]@{
    Status = $Status
    Percent = $pct
  }
  [void]$Worker.ReportProgress($pct, $state)
}

function Get-ProductStatusName {
  param($Product)
  $id = [string]$Product.id
  if ($id -eq 'cuemark') { return 'Cuemark' }
  $name = Repair-DisplayText ([string]$Product.displayName)
  if ($name.Length) { return $name }
  return 'plugin'
}

function Get-PlatformPackage {
  param($Product)
  if (-not $Product -or -not $Product.platforms) { return $null }
  $plat = $Product.platforms.win
  if (-not $plat) { $plat = $Product.platforms.windows }
  return $plat
}

function Get-PackageExpectedBytes {
  param($Product)
  $plat = Get-PlatformPackage $Product
  if ($plat -and $null -ne $plat.sizeBytes) {
    try {
      $n = [int64]$plat.sizeBytes
      if ($n -gt 1000000) { return $n }
    } catch {}
  }
  $id = [string]$Product.id
  if ($script:KnownPackageSizes.ContainsKey($id)) {
    return [int64]$script:KnownPackageSizes[$id]
  }
  return [int64]0
}

function Get-FileSha256Hex {
  param([string]$Path)
  $hash = Get-FileHash -LiteralPath $Path -Algorithm SHA256
  return $hash.Hash.ToLowerInvariant()
}

function Get-DownloadStatusText {
  param(
    [string]$Label,
    [int]$Percent,
    [long]$ExpectedBytes = 0
  )
  if ($ExpectedBytes -gt 0) {
    $totalMb = [int][Math]::Max(1, [Math]::Round($ExpectedBytes / 1048576.0, 0))
    return ('Downloading ' + $Label + '... ' + $Percent + '% out of ' + $totalMb + ' MB')
  }
  return ('Downloading ' + $Label + '... ' + $Percent + '%')
}

function Download-PackageWithProgress {
  param(
    [string]$Url,
    [string]$Destination,
    [string]$Label,
    $ProgressWorker,
    [long]$ExpectedBytes = 0,
    [int]$PercentMin = 5,
    [int]$PercentMax = 72
  )

  Ensure-Directory (Split-Path -Parent $Destination)
  if (Test-Path -LiteralPath $Destination) {
    Remove-Item -LiteralPath $Destination -Force
  }

  Send-InstallWorkerProgress -Worker $ProgressWorker -Status (Get-DownloadStatusText -Label $Label -Percent $PercentMin -ExpectedBytes $ExpectedBytes) -Percent $PercentMin

  $request = [System.Net.HttpWebRequest]::Create($Url)
  $request.UserAgent = 'Keyweaver-Manager/1.0'
  $request.AllowAutoRedirect = $true
  $request.Timeout = 30 * 60 * 1000
  $response = $request.GetResponse()
  $stream = $response.GetResponseStream()
  $fileStream = [System.IO.File]::Create($Destination)
  $buffer = New-Object byte[] 81920
  $received = [int64]0
  $span = $PercentMax - $PercentMin
  $lastPct = $PercentMin

  try {
    while ($true) {
      $read = $stream.Read($buffer, 0, $buffer.Length)
      if ($read -le 0) { break }
      $fileStream.Write($buffer, 0, $read)
      $received += $read

      $ratio = 0.0
      if ($ExpectedBytes -gt 0) {
        $ratio = [Math]::Min(1.0, $received / [double]$ExpectedBytes)
      } elseif ($response.ContentLength -gt 0) {
        $ratio = [Math]::Min(1.0, $received / [double]$response.ContentLength)
      }

      if ($ratio -gt 0) {
        $pct = $PercentMin + [int]($span * $ratio)
        if ($pct -gt $PercentMax) { $pct = $PercentMax }
        if ($pct -lt $lastPct) { $pct = $lastPct }
        if ($pct -gt $lastPct) {
          $lastPct = $pct
          Send-InstallWorkerProgress -Worker $ProgressWorker -Status (Get-DownloadStatusText -Label $Label -Percent $pct -ExpectedBytes $ExpectedBytes) -Percent $pct
        }
      }
    }
  } finally {
    if ($fileStream) { $fileStream.Dispose() }
    if ($stream) { $stream.Dispose() }
    if ($response) { $response.Dispose() }
  }

  Send-InstallWorkerProgress -Worker $ProgressWorker -Status (Get-DownloadStatusText -Label $Label -Percent $PercentMax -ExpectedBytes $ExpectedBytes) -Percent $PercentMax
}

function Expand-PackageZip {
  param(
    [string]$ZipPath,
    [string]$Destination
  )
  if (Test-Path -LiteralPath $Destination) {
    Remove-Item -LiteralPath $Destination -Recurse -Force
  }
  Ensure-Directory $Destination
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $Destination)
}

function Invoke-ProductInstallScript {
  param(
    [string]$ExtractRoot,
    [string]$InstallScriptName
  )
  $scriptPath = Join-Path $ExtractRoot $InstallScriptName
  if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Install script not found in package: $InstallScriptName"
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -Silent
  if ($LASTEXITCODE -ne 0) {
    throw "Install script failed (exit $LASTEXITCODE)."
  }
}

function Install-KeyweaverProduct {
  param(
    $Product,
    $ProgressWorker = $null
  )

  $plat = Get-PlatformPackage $Product
  if (-not $plat -or -not $plat.packageUrl) {
    throw 'No Windows package URL in manifest for this product.'
  }

  $productName = Get-ProductStatusName $Product
  Ensure-Directory $script:CacheRoot
  $version = [string]($Product.version)
  if (-not $version.Length) { $version = 'latest' }
  $zipName = ($Product.id + '-win-v' + $version + '.zip') -replace '[^\w\.\-]', '_'
  $zipPath = Join-Path $script:CacheRoot $zipName
  $extractRoot = Join-Path $script:CacheRoot ('extract\' + $Product.id + '-v' + $version)
  $expectedSizeBytes = Get-PackageExpectedBytes -Product $Product

  Download-PackageWithProgress -Url $plat.packageUrl -Destination $zipPath -Label $productName -ProgressWorker $ProgressWorker -ExpectedBytes $expectedSizeBytes -PercentMin 5 -PercentMax 72

  if ($plat.sha256) {
    Send-InstallWorkerProgress -Worker $ProgressWorker -Status ('Verifying ' + $productName + ' download...') -Percent 78
    $expected = ([string]$plat.sha256).ToLowerInvariant()
    $actual = Get-FileSha256Hex -Path $zipPath
    if ($expected -ne $actual) {
      throw 'Download verification failed (checksum mismatch). Try again or use the zip fallback from keyweaver.io/download.'
    }
  }

  Send-InstallWorkerProgress -Worker $ProgressWorker -Status ('Extracting ' + $productName + '...') -Percent 86
  Expand-PackageZip -ZipPath $zipPath -Destination $extractRoot

  $installScript = [string]$plat.installScript
  if (-not $installScript.Length) { $installScript = ($Product.id + '-install-windows.ps1') }

  Send-InstallWorkerProgress -Worker $ProgressWorker -Status ('Installing ' + $productName + ' into After Effects...') -Percent 94
  Invoke-ProductInstallScript -ExtractRoot $extractRoot -InstallScriptName $installScript

  $statePath = Join-Path $script:StateRoot ('installed-' + $Product.id + '.json')
  Write-JsonFile -Path $statePath -Object @{
    id = $Product.id
    version = $version
    installedAt = (Get-Date).ToString('o')
  }
  Send-InstallWorkerProgress -Worker $ProgressWorker -Status ($productName + ' installed.') -Percent 100
}
