#Requires -Version 5.1
<#
  Keyweaver Manager — download and install Keyweaver CEP plugins from a remote manifest.
  Bootstrap (Keyweaver-Setup.exe) installs a frozen copy once; Manager updates itself from keyweaver.io.
#>
param(
  [string]$ManifestUrl = 'https://keyweaver.io/installer/manifest.json'
)

$ErrorActionPreference = 'Stop'

function Hide-ConsoleWindow {
  try {
    if (-not ([System.Management.Automation.PSTypeName]'KwConsoleUtil').Type) {
      Add-Type @'
using System;
using System.Runtime.InteropServices;
public class KwConsoleUtil {
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
}
'@
    }
    $hwnd = [KwConsoleUtil]::GetConsoleWindow()
    if ($hwnd -ne [IntPtr]::Zero) {
      [void][KwConsoleUtil]::ShowWindow($hwnd, 0)
    }
    [void][KwConsoleUtil]::FreeConsole()
  } catch {}
}

Hide-ConsoleWindow

$script:ManagerRoot = if ($script:ManagerRoot) { $script:ManagerRoot }
  elseif ($PSScriptRoot) { $PSScriptRoot }
  else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$script:CacheRoot = Join-Path $env:LOCALAPPDATA 'Keyweaver\Cache'
$script:StateRoot = Join-Path $env:LOCALAPPDATA 'Keyweaver\State'
$script:ManifestCachePath = Join-Path $script:StateRoot 'manifest.json'
$script:CepExtensionsRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$script:CurrentManifest = $null
$script:IsBusy = $false
$script:KwInstallBgWorker = $null

$installLibPath = Join-Path $script:ManagerRoot 'Keyweaver-InstallLib.ps1'
if (-not (Test-Path -LiteralPath $installLibPath)) {
  throw "Install library not found: $installLibPath"
}
. $installLibPath

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.IO.Compression.FileSystem
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

if (-not ([System.Management.Automation.PSTypeName]'KwInstallBackgroundWorker').Type) {
  $sma = [System.Reflection.Assembly]::LoadWithPartialName('System.Management.Automation')
  Add-Type -ReferencedAssemblies $sma.Location -TypeDefinition @'
using System;
using System.Collections;
using System.ComponentModel;
using System.IO;
using System.Management.Automation;
using System.Management.Automation.Runspaces;

public sealed class KwInstallBackgroundWorker
{
    private BackgroundWorker _worker;

    public Action<int, string> OnProgress;
    public Action OnCompleted;
    public Action<Exception> OnFailed;

    public bool IsBusy
    {
        get { return _worker != null && _worker.IsBusy; }
    }

    private static void ThrowIfErrors(PowerShell ps)
    {
        if (ps.Streams.Error.Count > 0)
        {
            var record = ps.Streams.Error[0];
            if (record.Exception != null) throw record.Exception;
            throw new Exception(record.ToString());
        }
        if (ps.HadErrors)
        {
            throw new Exception("Install script failed.");
        }
    }

  public void RunAsync(object product, string libPath, Hashtable context)
    {
        if (_worker != null && _worker.IsBusy) return;

        _worker = new BackgroundWorker();
        _worker.WorkerReportsProgress = true;
        _worker.DoWork += (sender, e) =>
        {
            var args = (Hashtable)e.Argument;
            var prod = args["Product"];
            var lib = (string)args["LibPath"];
            var ctx = (Hashtable)args["Context"];

            using (var rs = RunspaceFactory.CreateRunspace())
            {
                rs.Open();
                using (var ps = PowerShell.Create())
                {
                    ps.Runspace = rs;
                    ps.AddScript(File.ReadAllText(lib));
                    ps.Invoke();
                    ThrowIfErrors(ps);
                    ps.Commands.Clear();

                    ps.AddScript(@"
param($Product, $ProgressWorker, $ManagerRoot, $CacheRoot, $StateRoot, $CepExtensionsRoot)
$script:ManagerRoot = $ManagerRoot
$script:CacheRoot = $CacheRoot
$script:StateRoot = $StateRoot
$script:CepExtensionsRoot = $CepExtensionsRoot
Install-KeyweaverProduct -Product $Product -ProgressWorker $ProgressWorker
");
                    ps.AddParameter("Product", prod);
                    ps.AddParameter("ProgressWorker", sender);
                    ps.AddParameter("ManagerRoot", ctx["ManagerRoot"]);
                    ps.AddParameter("CacheRoot", ctx["CacheRoot"]);
                    ps.AddParameter("StateRoot", ctx["StateRoot"]);
                    ps.AddParameter("CepExtensionsRoot", ctx["CepExtensionsRoot"]);
                    ps.Invoke();
                    ThrowIfErrors(ps);
                }
            }
        };

        _worker.ProgressChanged += (sender, e) =>
        {
            var state = e.UserState as Hashtable;
            if (state == null) return;
            int pct = state.ContainsKey("Percent") ? Convert.ToInt32(state["Percent"]) : e.ProgressPercentage;
            string status = state.ContainsKey("Status") ? (string)state["Status"] : string.Empty;
            if (OnProgress != null) OnProgress(pct, status);
        };

        _worker.RunWorkerCompleted += (sender, e) =>
        {
            if (e.Error != null)
            {
                if (OnFailed != null) OnFailed(e.Error);
                return;
            }
            if (OnCompleted != null) OnCompleted();
        };

        var argument = new Hashtable();
        argument["Product"] = product;
        argument["LibPath"] = libPath;
        argument["Context"] = context;
        _worker.RunWorkerAsync(argument);
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

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $raw = [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
  if (-not $raw.Trim().Length) { return $null }
  return $raw | ConvertFrom-Json
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

function Write-JsonFile {
  param([string]$Path, $Object)
  Ensure-Directory (Split-Path -Parent $Path)
  $json = $Object | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($Path, $json)
}

function Get-FallbackManifestPath {
  $local = Join-Path $script:ManagerRoot 'manifest.json'
  if (Test-Path -LiteralPath $local) { return $local }
  return $null
}

function Get-LocalFileSha256Hex {
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

function Test-ManagerRuntimeCurrent {
  param($ManagerMeta)
  $expected = Get-ManagerRuntimeFileHashes $ManagerMeta
  if (-not $expected.Count) { return $true }
  foreach ($entry in $expected.GetEnumerator()) {
    $localPath = Join-Path $script:ManagerRoot $entry.Key
    if ((Get-LocalFileSha256Hex $localPath) -ne $entry.Value.ToLowerInvariant()) {
      return $false
    }
  }
  return $true
}

function Update-ManagerRuntimeIfNeeded {
  $manifest = $null
  try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
    $bytes = $wc.DownloadData($ManifestUrl)
    $raw = [System.Text.Encoding]::UTF8.GetString($bytes)
    $manifest = $raw | ConvertFrom-Json
    Write-JsonFile -Path $script:ManifestCachePath -Object $manifest
  } catch {
    $manifest = Read-JsonFile $script:ManifestCachePath
    if (-not $manifest) {
      $fallback = Get-FallbackManifestPath
      if ($fallback) { $manifest = Read-JsonFile $fallback }
    }
  }

  if (-not $manifest -or -not $manifest.manager) { return $false }
  if (Test-ManagerRuntimeCurrent $manifest.manager) { return $false }

  $mgr = $manifest.manager
  $baseUrl = [string]$mgr.baseUrl
  if (-not $baseUrl.Length) { $baseUrl = 'https://keyweaver.io/installer/manager/' }
  if (-not $baseUrl.EndsWith('/')) { $baseUrl += '/' }

  $expected = Get-ManagerRuntimeFileHashes $mgr
  foreach ($entry in $expected.GetEnumerator()) {
    $name = $entry.Key
    $url = $baseUrl + $name
    $dest = Join-Path $script:ManagerRoot $name
    $tmp = $dest + '.download'
    Ensure-Directory (Split-Path -Parent $dest)
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
    $wc.DownloadFile($url, $tmp)
    $hash = (Get-LocalFileSha256Hex $tmp).ToLowerInvariant()
    if ($hash -ne $entry.Value.ToLowerInvariant()) {
      if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
      throw "Manager update failed checksum for $name"
    }
    if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
    Move-Item -LiteralPath $tmp -Destination $dest
  }

  if ($mgr.version) {
    $verPath = Join-Path $script:StateRoot 'manager-runtime-version.txt'
    [System.IO.File]::WriteAllText($verPath, [string]$mgr.version)
  }
  return $true
}

function Invoke-Ui {
  param(
    [scriptblock]$Action,
    [switch]$Async
  )
  $window = $script:UiWindow
  if (-not $window) { & $Action; return }
  $uiAction = [System.Action]$Action
  if ($Async) {
    [void]$window.Dispatcher.BeginInvoke($uiAction)
  } else {
    if ($window.Dispatcher.CheckAccess()) {
      & $Action
    } else {
      $window.Dispatcher.Invoke($uiAction)
    }
  }
}

function Report-InstallProgress {
  param(
    $Worker,
    [string]$Status,
    [double]$Percent
  )
  $pct = [int][Math]::Max(0, [Math]::Min(100, [Math]::Round($Percent)))
  if ($Worker) {
    $state = [System.Collections.Hashtable]@{
      Status = $Status
      Percent = $pct
    }
    [void]$Worker.ReportProgress($pct, $state)
  } else {
    Set-Status $Status
    Set-Progress -Value $pct
  }
}

function Set-Status {
  param([string]$Message)
  Invoke-Ui {
    $script:UiStatus.Text = $Message
  }
}

function Set-Progress {
  param([double]$Value, [switch]$Indeterminate)
  Invoke-Ui {
    if ($Indeterminate) {
      $script:UiProgress.IsIndeterminate = $true
      $script:UiProgress.Visibility = 'Visible'
    } else {
      $script:UiProgress.IsIndeterminate = $false
      $script:UiProgress.Value = [Math]::Max(0, [Math]::Min(100, $Value))
      $script:UiProgress.Visibility = 'Visible'
    }
  }
}

function Set-ManagerBusyState {
  param([bool]$Busy)
  Invoke-Ui {
    if ($script:UiWindow) {
      $script:UiWindow.Cursor = if ($Busy) { [System.Windows.Input.Cursors]::Wait } else { [System.Windows.Input.Cursors]::Arrow }
    }
    foreach ($name in @('RefreshButton', 'WebsiteButton')) {
      $btn = $script:UiWindow.FindName($name)
      if (-not $btn) { continue }
      $btn.IsHitTestVisible = -not $Busy
      $btn.Opacity = if ($Busy) { 0.45 } else { 1.0 }
    }
  }
}

function Set-InstallButtonBusy {
  param(
    $Button,
    [bool]$Busy,
    [string]$BusyLabel = 'Working...'
  )
  if (-not $Button) { return }
  Invoke-Ui {
    $Button.IsEnabled = $true
    if ($Busy) {
      if (-not $script:KwInstallButtonText) {
        $script:KwInstallButtonText = [string]$Button.Content
      }
      $Button.Content = $BusyLabel
      $Button.IsHitTestVisible = $false
      $Button.Cursor = [System.Windows.Input.Cursors]::Wait
    } else {
      if ($script:KwInstallButtonText) {
        $Button.Content = $script:KwInstallButtonText
        $script:KwInstallButtonText = $null
      }
      $Button.IsHitTestVisible = $true
      $Button.Cursor = [System.Windows.Input.Cursors]::Hand
    }
  }
}

function Get-PlatformPackage {
  param($Product)
  if (-not $Product -or -not $Product.platforms) { return $null }
  $plat = $Product.platforms.win
  if (-not $plat) { $plat = $Product.platforms.windows }
  return $plat
}

function Get-PlatformDownloadSizeLabel {
  param($Product)
  $plat = Get-PlatformPackage $Product
  $bytes = [int64]0
  if ($plat -and $null -ne $plat.sizeBytes) {
    try {
      $n = [int64]$plat.sizeBytes
      if ($n -gt 1000000) { $bytes = $n }
    } catch {}
  }
  if (-not $bytes -and $Product -and [string]$Product.id -eq 'cuemark') {
    $bytes = [int64]50034417
  }
  if (-not $bytes) { return $null }
  $mb = [int][Math]::Round([double]$bytes / 1048576.0, 0)
  if ($mb -lt 1) { $mb = 1 }
  return ('~' + $mb + ' MB download')
}

function Get-InstalledPanelVersion {
  param([string]$PanelId)
  $manifestPath = Join-Path (Join-Path $script:CepExtensionsRoot $PanelId) 'CSXS\manifest.xml'
  if (-not (Test-Path -LiteralPath $manifestPath)) { return $null }
  try {
    $xml = [xml](Get-Content -LiteralPath $manifestPath -Raw)
    $ver = $xml.ExtensionManifest.ExtensionBundleVersion
    if ($ver) { return [string]$ver }
  } catch {}
  return 'installed'
}

function Test-ProductInstalled {
  param($Product)
  if (-not $Product -or -not $Product.panelId) { return $false }
  $mainJs = Join-Path (Join-Path $script:CepExtensionsRoot $Product.panelId) 'js\main.js'
  return Test-Path -LiteralPath $mainJs
}

function Compare-Semver {
  param([string]$A, [string]$B)
  if (-not $A) { return if ($B) { -1 } else { 0 } }
  if (-not $B) { return 1 }
  $pa = $A.Split('.') | ForEach-Object { [int]($_ -replace '\D.*$', '0') }
  $pb = $B.Split('.') | ForEach-Object { [int]($_ -replace '\D.*$', '0') }
  for ($i = 0; $i -lt [Math]::Max($pa.Count, $pb.Count); $i++) {
    $va = if ($i -lt $pa.Count) { $pa[$i] } else { 0 }
    $vb = if ($i -lt $pb.Count) { $pb[$i] } else { 0 }
    if ($va -gt $vb) { return 1 }
    if ($va -lt $vb) { return -1 }
  }
  return 0
}

function Get-CurrentManagerRuntimeVersion {
  $paths = @(
    (Join-Path $script:StateRoot 'manager-runtime-version.txt'),
    (Join-Path $script:ManagerRoot 'VERSION')
  )
  foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
      try {
        $value = (Get-Content -LiteralPath $path -Raw).Trim()
        if ($value) { return $value }
      } catch {}
    }
  }
  return $null
}

function Fetch-Manifest {
  param([switch]$ForceNetwork)

  $fallback = Get-FallbackManifestPath
  try {
    Set-Status 'Checking for updates from keyweaver.io...'
    Set-Progress -Indeterminate
  } catch {}

  try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'Keyweaver-Manager/1.0')
    $bytes = $wc.DownloadData($ManifestUrl)
    $raw = [System.Text.Encoding]::UTF8.GetString($bytes)
    $parsed = $raw | ConvertFrom-Json
  } catch {
    if ($ForceNetwork) { throw }
    $parsed = $null
    if (Test-Path -LiteralPath $script:ManifestCachePath) {
      $parsed = Read-JsonFile $script:ManifestCachePath
    }
    if (-not $parsed -and $fallback) {
      $parsed = Read-JsonFile $fallback
    }
    if (-not $parsed) {
      throw 'Could not load plugin catalog. Check your internet connection and try Refresh.'
    }
  }

  if ($parsed) {
    Write-JsonFile -Path $script:ManifestCachePath -Object $parsed
  }
  $script:CurrentManifest = $parsed
  return $parsed
}

function Open-ExternalUrl {
  param([string]$Url)
  if (-not $Url) { return }
  Start-Process $Url
}

function Reset-InstallUiState {
  $script:IsBusy = $false
  Set-ManagerBusyState $false
  Set-InstallButtonBusy -Button $script:KwInstallButton -Busy $false
  $script:KwInstallButton = $null
  $script:KwInstallProduct = $null
  $script:KwInstallProductName = $null
  Set-Progress -Value 0
}

function Initialize-InstallWorkerHost {
  if ($script:KwInstallBgWorker) { return }

  $script:KwInstallBgWorker = New-Object KwInstallBackgroundWorker

  $script:KwInstallBgWorker.OnProgress = [System.Action[int,string]]{
    param([int]$Percent, [string]$Status)
    if ($Status) { Set-Status $Status }
    Set-Progress -Value $Percent
  }

  $script:KwInstallBgWorker.OnFailed = [System.Action[Exception]]{
    param([Exception]$ex)
    $message = if ($ex.Message) { $ex.Message } else { 'Install failed.' }
    Set-Status $message
    [System.Windows.MessageBox]::Show($message, 'Install failed', 'OK', 'Error') | Out-Null
    Reset-InstallUiState
  }

  $script:KwInstallBgWorker.OnCompleted = [System.Action]{
    $name = $script:KwInstallProductName
    $prod = $script:KwInstallProduct
    Set-Status ($name + ' installed. Quit and reopen After Effects.')
    [System.Windows.MessageBox]::Show(
      ($name + " is installed.`n`n1. Quit After Effects completely`n2. Reopen After Effects`n3. " + $prod.menuPath),
      'Keyweaver',
      'OK',
      'Information'
    ) | Out-Null
    Render-ManifestUi
    Reset-InstallUiState
  }
}

function Start-ProductInstall {
  param(
    $Product,
    $Button
  )

  if ($script:IsBusy) { return }
  Initialize-InstallWorkerHost
  if ($script:KwInstallBgWorker.IsBusy) { return }

  $productName = Get-ProductStatusName $Product
  $script:KwInstallProductName = $productName
  $script:KwInstallProduct = $Product
  $script:IsBusy = $true
  $script:KwInstallButton = $Button
  Set-InstallButtonBusy -Button $Button -Busy $true
  Set-ManagerBusyState $true
  Report-InstallProgress -Worker $null -Status ('Starting ' + $productName + ' install...') -Percent 2

  $context = [System.Collections.Hashtable]@{
    ManagerRoot = $script:ManagerRoot
    CacheRoot = $script:CacheRoot
    StateRoot = $script:StateRoot
    CepExtensionsRoot = $script:CepExtensionsRoot
  }

  $script:KwInstallBgWorker.RunAsync($Product, $installLibPath, $context)
}

function Get-ManagerImagePath {
  param([string]$FileName)
  $path = Join-Path $script:ManagerRoot (Join-Path 'images' $FileName)
  if (Test-Path -LiteralPath $path) {
    return ([System.IO.Path]::GetFullPath($path))
  }
  return $null
}

function New-ManagerImage {
  param(
    [string]$FileName,
    [double]$MaxHeight = 32
  )
  $path = Get-ManagerImagePath $FileName
  if (-not $path) { return $null }
  $img = New-Object System.Windows.Controls.Image
  $bmp = New-Object System.Windows.Media.Imaging.BitmapImage
  $bmp.BeginInit()
  $bmp.UriSource = [uri]$path
  $bmp.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  $bmp.EndInit()
  $img.Source = $bmp
  $img.Stretch = 'Uniform'
  $img.MaxHeight = $MaxHeight
  $img.HorizontalAlignment = 'Left'
  return $img
}

function Get-ProductLogoFileName {
  param($Product)
  $id = [string]$Product.id
  # WPF BitmapImage does not render SVG; use PNG assets when present.
  switch ($id) {
    'cuemark' {
      if (Get-ManagerImagePath 'cuemark-logo.png') { return 'cuemark-logo.png' }
      return $null
    }
    default { return $null }
  }
}

function Get-ProductAccentColor {
  param($Product)
  if ($Product.accent) { return [string]$Product.accent }
  $id = [string]$Product.id
  switch ($id) {
    'cuemark' { return '#3D9CF0' }
    'superconductor' { return '#5B6BF8' }
    'trillian' { return '#B56BFF' }
    'tamborine' { return '#E8952F' }
    'ludo' { return '#34D399' }
    default { return '#5B6BF8' }
  }
}

function Set-ManagerHeaderLogo {
  param($Window)
  $logo = New-ManagerImage -FileName 'keyweaver-logo.png' -MaxHeight 40
  if (-not $logo) { return }
  $headerLogo = $Window.FindName('HeaderLogo')
  if ($headerLogo) {
    $headerLogo.Source = $logo.Source
    $headerLogo.MaxHeight = 40
    $headerLogo.Visibility = 'Visible'
  }
}

function New-ProductCard {
  param($Product)

  $accent = Get-ProductAccentColor $Product

  $border = New-Object System.Windows.Controls.Border
  $border.Margin = New-Object System.Windows.Thickness(0, 0, 0, 10)
  $border.Padding = New-Object System.Windows.Thickness(14)
  $border.CornerRadius = New-Object System.Windows.CornerRadius(10)
  $border.Background = '#1B1B28'
  $border.BorderBrush = '#2B2B3D'
  $border.BorderThickness = New-Object System.Windows.Thickness(1)

  # Left accent bar
  $cardGrid = New-Object System.Windows.Controls.Grid
  $col0 = New-Object System.Windows.Controls.ColumnDefinition
  $col0.Width = New-Object System.Windows.GridLength(4)
  $col1 = New-Object System.Windows.Controls.ColumnDefinition
  $col1.Width = New-Object System.Windows.GridLength(1, [System.Windows.GridUnitType]::Star)
  $cardGrid.ColumnDefinitions.Add($col0) | Out-Null
  $cardGrid.ColumnDefinitions.Add($col1) | Out-Null

  $accentBar = New-Object System.Windows.Controls.Border
  $accentBar.Background = $accent
  $accentBar.CornerRadius = New-Object System.Windows.CornerRadius(2)
  $accentBar.Margin = New-Object System.Windows.Thickness(-10, -6, 10, -6)
  [System.Windows.Controls.Grid]::SetColumn($accentBar, 0)
  $cardGrid.Children.Add($accentBar) | Out-Null

  $stack = New-Object System.Windows.Controls.StackPanel
  [System.Windows.Controls.Grid]::SetColumn($stack, 1)

  $logoFile = Get-ProductLogoFileName $Product
  $titleAdded = $false
  if ($logoFile) {
    $productLogo = New-ManagerImage -FileName $logoFile -MaxHeight 30
    if ($productLogo) {
      $stack.Children.Add($productLogo) | Out-Null
      $titleAdded = $true
    }
  }
  if (-not $titleAdded) {
    $title = New-Object System.Windows.Controls.TextBlock
    $title.Text = Repair-DisplayText ([string]$Product.displayName)
    $title.FontSize = 15
    $title.FontWeight = 'SemiBold'
    $title.Foreground = '#F0F0F7'
    $stack.Children.Add($title) | Out-Null
  }

  if ($Product.description) {
    $desc = New-Object System.Windows.Controls.TextBlock
    $desc.Text = Repair-DisplayText ([string]$Product.description)
    $desc.Margin = '0,6,0,0'
    $desc.TextWrapping = 'Wrap'
    $desc.Foreground = '#8989A6'
    $stack.Children.Add($desc) | Out-Null
  }

  $installed = Test-ProductInstalled $Product
  $installedVer = if ($installed) { Get-InstalledPanelVersion $Product.panelId } else { $null }
  $latestVer = [string]$Product.version
  $needsUpdate = $installed -and $latestVer -and ((Compare-Semver $installedVer $latestVer) -lt 0)

  $meta = New-Object System.Windows.Controls.TextBlock
  $meta.Margin = '0,8,0,0'
  $meta.Foreground = '#6B6B88'
  $sizeLabel = Get-PlatformDownloadSizeLabel $Product
  if ($installed) {
    $meta.Text = 'Installed' + $(if ($installedVer) { ' v' + $installedVer } else { '' }) +
      $(if ($needsUpdate) { ' - Update available (v' + $latestVer + ')' } elseif ($latestVer) { ' - Up to date' } else { '' })
  } else {
    $meta.Text = $(if ($latestVer) { 'Not installed - v' + $latestVer + ' available' } else { 'Not installed' })
  }
  if ($sizeLabel) {
    $meta.Text = $meta.Text + ' - ' + $sizeLabel
  }
  $stack.Children.Add($meta) | Out-Null

  $actions = New-Object System.Windows.Controls.StackPanel
  $actions.Orientation = 'Horizontal'
  $actions.Margin = '0,12,0,0'

  $installBtn = New-Object System.Windows.Controls.Button
  $installBtn.Content = if ($needsUpdate) { 'Update' } elseif ($installed) { 'Reinstall' } else { 'Install' }
  if ($script:PrimaryButtonStyle) { $installBtn.Style = $script:PrimaryButtonStyle }
  $installBtn.Tag = $Product
  $installBtn.Add_Click({
    Start-ProductInstall -Product $this.Tag -Button $this
  })
  $actions.Children.Add($installBtn) | Out-Null

  if ($Product.helpUrl) {
    $helpBtn = New-Object System.Windows.Controls.Button
    $helpBtn.Content = 'Help'
    $helpBtn.Margin = New-Object System.Windows.Thickness(8, 0, 0, 0)
    if ($script:ToolbarButtonStyle) { $helpBtn.Style = $script:ToolbarButtonStyle }
    $helpBtn.Tag = [string]$Product.helpUrl
    $helpBtn.Add_Click({ Open-ExternalUrl $this.Tag })
    $actions.Children.Add($helpBtn) | Out-Null
  }

  $stack.Children.Add($actions) | Out-Null
  $cardGrid.Children.Add($stack) | Out-Null
  $border.Child = $cardGrid
  return $border
}

function New-PromotionCard {
  param($Promotion)

  $border = New-Object System.Windows.Controls.Border
  $border.Margin = New-Object System.Windows.Thickness(0, 0, 0, 10)
  $border.Padding = New-Object System.Windows.Thickness(14)
  $border.CornerRadius = New-Object System.Windows.CornerRadius(10)
  $border.Background = '#151522'
  $border.BorderBrush = '#3A3A52'
  $border.BorderThickness = New-Object System.Windows.Thickness(1)

  $stack = New-Object System.Windows.Controls.StackPanel

  $title = New-Object System.Windows.Controls.TextBlock
  $title.Text = Repair-DisplayText ([string]$Promotion.title)
  $title.FontSize = 14
  $title.FontWeight = 'SemiBold'
  $title.Foreground = '#E8E8F0'
  $stack.Children.Add($title) | Out-Null

  if ($Promotion.body) {
    $body = New-Object System.Windows.Controls.TextBlock
    $body.Text = Repair-DisplayText ([string]$Promotion.body)
    $body.Margin = '0,6,0,0'
    $body.TextWrapping = 'Wrap'
    $body.Foreground = '#8989A6'
    $stack.Children.Add($body) | Out-Null
  }

  if ($Promotion.ctaUrl) {
    $cta = New-Object System.Windows.Controls.Button
    $cta.Content = if ($Promotion.ctaLabel) { [string]$Promotion.ctaLabel } else { 'Learn more' }
    $cta.Margin = New-Object System.Windows.Thickness(0, 10, 0, 0)
    $cta.Padding = New-Object System.Windows.Thickness(14, 7, 14, 7)
    if ($script:ToolbarButtonStyle) { $cta.Style = $script:ToolbarButtonStyle }
    $cta.HorizontalAlignment = 'Left'
    $cta.Tag = [string]$Promotion.ctaUrl
    $cta.Add_Click({ Open-ExternalUrl $this.Tag })
    $stack.Children.Add($cta) | Out-Null
  }

  $border.Child = $stack
  return $border
}

function Render-ManifestUi {
  $manifest = $script:CurrentManifest
  if (-not $manifest) { return }

  Invoke-Ui {
    $script:UiProductsPanel.Children.Clear()
    $script:UiPromotionsPanel.Children.Clear()

    $products = @($manifest.products)
    $pluginUpdateCount = 0
    if (-not $products -or -not $products.Count) {
      $empty = New-Object System.Windows.Controls.TextBlock
      $empty.Text = 'No plugins are available in the catalog yet.'
      $empty.Foreground = '#8989A6'
      $script:UiProductsPanel.Children.Add($empty) | Out-Null
    } else {
      foreach ($product in $products) {
        if (Test-ProductInstalled $product) {
          $installedVersion = Get-InstalledPanelVersion $product.panelId
          if ($product.version -and ((Compare-Semver $installedVersion ([string]$product.version)) -lt 0)) {
            $pluginUpdateCount++
          }
        }
        $script:UiProductsPanel.Children.Add((New-ProductCard $product)) | Out-Null
      }
    }

    $managerCurrent = Get-CurrentManagerRuntimeVersion
    $managerLatest = if ($manifest.manager -and $manifest.manager.version) { [string]$manifest.manager.version } else { $null }
    $managerNeedsUpdate = $managerCurrent -and $managerLatest -and ((Compare-Semver $managerCurrent $managerLatest) -lt 0)
    $alerts = @()
    if ($managerNeedsUpdate) {
      # Scripts normally sync in bootstrap-launch before the UI opens; this means
      # the last sync was offline/failed or VERSION state is stale.
      $alerts += ('Keyweaver Manager v' + $managerLatest + ' is available. Close Manager and reopen from the Start Menu to sync.')
    }
    if ($pluginUpdateCount -gt 0) {
      $alerts += ($pluginUpdateCount.ToString() + $(if ($pluginUpdateCount -eq 1) { ' plugin update is' } else { ' plugin updates are' }) + ' available below.')
    }
    if ($alerts.Count -gt 0) {
      $script:UiUpdateAlertText.Text = ($alerts -join '  ')
      $script:UiUpdateAlert.Visibility = 'Visible'
    } else {
      $script:UiUpdateAlert.Visibility = 'Collapsed'
    }

    $promotions = @($manifest.promotions)
    if ($promotions -and $promotions.Count) {
      $script:UiPromotionsSection.Visibility = 'Visible'
      foreach ($promo in $promotions) {
        $script:UiPromotionsPanel.Children.Add((New-PromotionCard $promo)) | Out-Null
      }
    } else {
      $script:UiPromotionsSection.Visibility = 'Collapsed'
    }

    if ($managerLatest) {
      $script:UiSubtitle.Text = ('v' + $managerLatest + ' · Updates automatically before launch')
    } else {
      $script:UiSubtitle.Text = 'keyweaver.io'
    }
    Set-Progress 0
  }
}

function Initialize-KeyweaverManagerUi {
  $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Keyweaver Manager" Height="580" Width="680" MinHeight="480" MinWidth="560"
        Background="#12121A" WindowStartupLocation="CenterScreen" ResizeMode="CanResizeWithGrip">
  <Window.Resources>
    <Style x:Key="ToolbarButtonStyle" TargetType="Button">
      <Setter Property="Background" Value="#2B2B3D"/>
      <Setter Property="Foreground" Value="#F0F0F7"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Padding" Value="14,8"/>
      <Style.Triggers>
        <Trigger Property="IsEnabled" Value="False">
          <Setter Property="Background" Value="#2B2B3D"/>
          <Setter Property="Foreground" Value="#8989A6"/>
          <Setter Property="Opacity" Value="0.55"/>
        </Trigger>
      </Style.Triggers>
    </Style>
    <Style x:Key="PrimaryButtonStyle" TargetType="Button">
      <Setter Property="Background" Value="#5B6BF8"/>
      <Setter Property="Foreground" Value="#FFFFFF"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Padding" Value="16,8"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="RootBorder" Background="{TemplateBinding Background}" CornerRadius="4" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsEnabled" Value="False">
                <Setter TargetName="RootBorder" Property="Background" Value="#4A54C4"/>
                <Setter Property="Foreground" Value="#E8EAFF"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="CuemarkScrollBarButton" TargetType="{x:Type RepeatButton}">
      <Setter Property="Focusable" Value="false"/>
      <Setter Property="IsTabStop" Value="false"/>
      <Setter Property="Opacity" Value="0"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="{x:Type RepeatButton}">
            <Rectangle Fill="Transparent" Height="{TemplateBinding Height}" Width="{TemplateBinding Width}"/>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="CuemarkScrollBarThumb" TargetType="{x:Type Thumb}">
      <Setter Property="OverridesDefaultStyle" Value="true"/>
      <Setter Property="IsTabStop" Value="false"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="{x:Type Thumb}">
            <Border x:Name="ThumbBorder" Background="#24FFFFFF" CornerRadius="4" Margin="1,2"/>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="ThumbBorder" Property="Background" Value="#6B4A9EFF"/>
              </Trigger>
              <Trigger Property="IsDragging" Value="True">
                <Setter TargetName="ThumbBorder" Property="Background" Value="#6B4A9EFF"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="CuemarkScrollBar" TargetType="{x:Type ScrollBar}">
      <Setter Property="Stylus.IsPressAndHoldEnabled" Value="false"/>
      <Setter Property="Stylus.IsFlicksEnabled" Value="false"/>
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Width" Value="8"/>
      <Setter Property="MinWidth" Value="8"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="{x:Type ScrollBar}">
            <Grid x:Name="BgGrid" Background="Transparent">
              <Track x:Name="PART_Track" IsDirectionReversed="true">
                <Track.DecreaseRepeatButton>
                  <RepeatButton Command="{x:Static ScrollBar.PageUpCommand}" Style="{StaticResource CuemarkScrollBarButton}"/>
                </Track.DecreaseRepeatButton>
                <Track.IncreaseRepeatButton>
                  <RepeatButton Command="{x:Static ScrollBar.PageDownCommand}" Style="{StaticResource CuemarkScrollBarButton}"/>
                </Track.IncreaseRepeatButton>
                <Track.Thumb>
                  <Thumb Style="{StaticResource CuemarkScrollBarThumb}"/>
                </Track.Thumb>
              </Track>
            </Grid>
            <ControlTemplate.Triggers>
              <Trigger Property="Orientation" Value="Horizontal">
                <Setter TargetName="BgGrid" Property="LayoutTransform">
                  <Setter.Value>
                    <RotateTransform Angle="-90"/>
                  </Setter.Value>
                </Setter>
                <Setter Property="Width" Value="Auto"/>
                <Setter Property="Height" Value="8"/>
                <Setter Property="MinWidth" Value="0"/>
                <Setter Property="MinHeight" Value="8"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="CuemarkScrollViewer" TargetType="{x:Type ScrollViewer}">
      <Setter Property="OverridesDefaultStyle" Value="true"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="{x:Type ScrollViewer}">
            <Grid Background="{TemplateBinding Background}">
              <ScrollContentPresenter/>
              <ScrollBar x:Name="PART_VerticalScrollBar"
                         Style="{StaticResource CuemarkScrollBar}"
                         Maximum="{TemplateBinding ScrollableHeight}"
                         ViewportSize="{TemplateBinding ViewportHeight}"
                         Value="{TemplateBinding VerticalOffset}"
                         Visibility="{TemplateBinding ComputedVerticalScrollBarVisibility}"
                         HorizontalAlignment="Right"/>
              <ScrollBar x:Name="PART_HorizontalScrollBar"
                         Style="{StaticResource CuemarkScrollBar}"
                         Orientation="Horizontal"
                         Maximum="{TemplateBinding ScrollableWidth}"
                         ViewportSize="{TemplateBinding ViewportWidth}"
                         Value="{TemplateBinding HorizontalOffset}"
                         Visibility="{TemplateBinding ComputedHorizontalScrollBarVisibility}"
                         VerticalAlignment="Bottom"/>
            </Grid>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>
  <Grid Margin="20">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>
    <StackPanel Grid.Row="0">
      <Image Name="HeaderLogo" Height="40" HorizontalAlignment="Left" Stretch="Uniform" Visibility="Collapsed"/>
      <TextBlock Name="SubtitleText" Text="keyweaver.io" Margin="0,6,0,0" Foreground="#8989A6"/>
    </StackPanel>
    <StackPanel Grid.Row="1" Orientation="Horizontal" Margin="0,16,0,8">
      <Button Name="RefreshButton" Content="Refresh catalog" Style="{StaticResource ToolbarButtonStyle}"/>
      <Button Name="WebsiteButton" Content="keyweaver.io" Margin="8,0,0,0" Style="{StaticResource ToolbarButtonStyle}"/>
    </StackPanel>
    <ScrollViewer Grid.Row="2" VerticalScrollBarVisibility="Auto" Style="{StaticResource CuemarkScrollViewer}">
      <StackPanel>
        <Border Name="UpdateAlert" Visibility="Collapsed" Background="#2B2418" BorderBrush="#8A6729" BorderThickness="1" CornerRadius="8" Padding="12" Margin="0,0,0,12">
          <TextBlock Name="UpdateAlertText" Foreground="#F5C46B" FontWeight="SemiBold" TextWrapping="Wrap"/>
        </Border>
        <TextBlock Text="Plugins" FontSize="13" FontWeight="SemiBold" Foreground="#7B8BFF" Margin="0,0,0,8"/>
        <StackPanel Name="ProductsPanel"/>
        <StackPanel Name="PromotionsSection" Margin="0,18,0,0">
          <TextBlock Text="From Keyweaver" FontSize="13" FontWeight="SemiBold" Foreground="#7B8BFF" Margin="0,0,0,8"/>
          <StackPanel Name="PromotionsPanel"/>
        </StackPanel>
      </StackPanel>
    </ScrollViewer>
    <ProgressBar Name="ProgressBar" Grid.Row="3" Height="6" Margin="0,12,0,0" Minimum="0" Maximum="100" Value="0" Background="#2B2B3D" Foreground="#5B6BF8" BorderThickness="0"/>
    <TextBlock Name="StatusText" Grid.Row="4" Margin="0,8,0,0" TextWrapping="Wrap" Foreground="#8989A6"/>
    <TextBlock Grid.Row="5" Margin="0,10,0,0" Text="Signed bootstrap installer from Keyweaver Ltd. Plugin downloads use HTTPS from keyweaver.io." TextWrapping="Wrap" Foreground="#6B6B88" FontSize="11"/>
  </Grid>
</Window>
"@

  $reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
  $window = [Windows.Markup.XamlReader]::Load($reader)
  $iconPath = Join-Path $script:ManagerRoot 'keyweaver.ico'
  if (Test-Path -LiteralPath $iconPath) {
    $window.Icon = [System.Windows.Media.Imaging.BitmapFrame]::Create(
      [uri]([System.IO.Path]::GetFullPath($iconPath))
    )
  }
  $script:UiWindow = $window
  $script:UiProductsPanel = $window.FindName('ProductsPanel')
  $script:UiPromotionsPanel = $window.FindName('PromotionsPanel')
  $script:UiPromotionsSection = $window.FindName('PromotionsSection')
  $script:UiStatus = $window.FindName('StatusText')
  $script:UiProgress = $window.FindName('ProgressBar')
  $script:UiSubtitle = $window.FindName('SubtitleText')
  $script:UiUpdateAlert = $window.FindName('UpdateAlert')
  $script:UiUpdateAlertText = $window.FindName('UpdateAlertText')
  $script:ToolbarButtonStyle = $window.FindResource('ToolbarButtonStyle')
  $script:PrimaryButtonStyle = $window.FindResource('PrimaryButtonStyle')
  Set-ManagerHeaderLogo $window

  $refreshBtn = $window.FindName('RefreshButton')
  $refreshBtn.Add_Click({
    if ($script:IsBusy) { return }
    try {
      Fetch-Manifest -ForceNetwork | Out-Null
      Render-ManifestUi
      Set-Status 'Catalog updated.'
    } catch {
      Set-Status $_.Exception.Message
    }
  })

  $websiteBtn = $window.FindName('WebsiteButton')
  $websiteBtn.Add_Click({ Open-ExternalUrl 'https://keyweaver.io' })

  $window.Add_Loaded({
    try {
      Ensure-Directory $script:CacheRoot
      Ensure-Directory $script:StateRoot
      Fetch-Manifest | Out-Null
      Render-ManifestUi
      Set-Status 'Ready. Choose a plugin to install.'
    } catch {
      Set-Status $_.Exception.Message
    }
  })

  return $window
}

function Show-ManagerFatalError {
  param([string]$Message)
  $logDir = Join-Path $env:LOCALAPPDATA 'Keyweaver\State'
  try {
    Ensure-Directory $logDir
    $logPath = Join-Path $logDir 'manager-error.log'
    "$(Get-Date -Format o) $Message" | Out-File -LiteralPath $logPath -Append -Encoding utf8
  } catch {}
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
    [System.Windows.MessageBox]::Show($Message, 'Keyweaver Manager', 'OK', 'Error') | Out-Null
  } catch {
    Write-Host $Message
  }
}

Ensure-Directory $script:StateRoot
try {
  $ui = Initialize-KeyweaverManagerUi
  Hide-ConsoleWindow
  [void]$ui.ShowDialog()
} catch {
  Show-ManagerFatalError $_.Exception.Message
  exit 1
}
