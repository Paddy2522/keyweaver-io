# Keyweaver Manager install library — loaded in a dedicated runspace for background installs.
#Requires -Version 5.1

Add-Type -AssemblyName System.IO.Compression.FileSystem
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

# Static zip sizes (bytes) — used for progress UI when manifest omits sizeBytes. Keep in sync with release zips.
$script:KnownPackageSizes = @{
  cuemark = [int64]50034417
}

if (-not ([System.Management.Automation.PSTypeName]'KwPackageDownloader').Type) {
  Add-Type @'
using System;
using System.Collections;
using System.ComponentModel;
using System.Net;
using System.Threading;

public static class KwPackageDownloader
{
    public static void Download(
        string url,
        string destination,
        BackgroundWorker worker,
        int percentMin,
        int percentMax,
        string label,
        long expectedBytes)
    {
        // Never use WebClient TotalBytesToReceive — GitHub/CDN often reports ~10x the real zip size.
        long knownTotal = expectedBytes > 0 ? expectedBytes : 0;
        long displayTotalMb = knownTotal > 0
            ? Math.Max(1, (long)Math.Round(knownTotal / 1048576.0, 0))
            : 0;

        using (var wc = new WebClient())
        {
            wc.Headers.Add("User-Agent", "Keyweaver-Manager/1.0");
            var done = new ManualResetEvent(false);
            Exception error = null;

            wc.DownloadProgressChanged += (s, e) =>
            {
                if (worker == null) return;
                int span = percentMax - percentMin;
                int pct;
                if (knownTotal > 0)
                    pct = percentMin + (int)(span * (e.BytesReceived / (double)knownTotal));
                else
                    pct = percentMin + (int)(span * (e.ProgressPercentage / 100.0));
                if (pct > percentMax) pct = percentMax;
                if (pct < percentMin) pct = percentMin;

                string msg;
                if (knownTotal > 0)
                {
                    double recv = e.BytesReceived / 1048576.0;
                    msg = string.Format("Downloading {0}... {1}% ({2:0.1} of {3} MB)", label, pct, recv, displayTotalMb);
                }
                else
                {
                    msg = string.Format("Downloading {0}... {1}%", label, pct);
                }

                var state = new Hashtable();
                state["Status"] = msg;
                state["Percent"] = pct;
                worker.ReportProgress(pct, state);
            };

            wc.DownloadFileCompleted += (s, e) =>
            {
                if (e.Error != null) error = e.Error;
                done.Set();
            };

            wc.DownloadFileAsync(new Uri(url), destination);
            done.WaitOne();
            if (error != null) throw error;
        }
    }
}
'@
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

function Download-PackageWithProgress {
  param(
    [string]$Url,
    [string]$Destination,
    [string]$Label,
    $ProgressWorker,
    [long]$ExpectedBytes = 0,
    [int]$PercentMin = 5,
    [int]$PercentMax = 70
  )

  Ensure-Directory (Split-Path -Parent $Destination)
  if (Test-Path -LiteralPath $Destination) {
    Remove-Item -LiteralPath $Destination -Force
  }

  Send-InstallWorkerProgress -Worker $ProgressWorker -Status ('Downloading ' + $Label + '...') -Percent $PercentMin
  [KwPackageDownloader]::Download($Url, $Destination, $ProgressWorker, $PercentMin, $PercentMax, $Label, $ExpectedBytes)
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
