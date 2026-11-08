param([string]$LaunchUrl = '')

$logPath = Join-Path $env:LOCALAPPDATA 'dsh-pet\webview-error.txt'
function Write-PetLog([string]$Text) {
  try {
    New-Item -ItemType Directory -Force (Split-Path $logPath) | Out-Null
    $Text | Set-Content -LiteralPath $logPath -Encoding UTF8
  } catch { }
}
function Send-PetWebMessage([object]$Message) {
  try {
    if ($null -eq $script:WebView -or $null -eq $script:WebView.CoreWebView2) { return }
    $json = ConvertTo-Json -InputObject $Message -Compress -Depth 4
    $script:WebView.CoreWebView2.PostWebMessageAsJson($json)
  } catch { Write-PetLog ("Web message: " + $_.Exception.Message) }
}
function Set-PetHitRegion([bool]$FullWindow, [object[]]$Boxes = @()) {
  try {
    $handle = (New-Object System.Windows.Interop.WindowInteropHelper($script:Window)).Handle
    if ($handle -eq [IntPtr]::Zero) { return }
    $scale = [System.Windows.Media.VisualTreeHelper]::GetDpi($script:Window).DpiScaleX
    $hRegion = [DshPet.Win32]::CreateRectRgn(0, 0, 0, 0)
    if ($FullWindow) {
      $width = [Math]::Max(1, [int][Math]::Ceiling($script:Window.Width * $scale))
      $height = [Math]::Max(1, [int][Math]::Ceiling($script:Window.Height * $scale))
      $hBox = [DshPet.Win32]::CreateRectRgn(0, 0, $width, $height)
      [DshPet.Win32]::CombineRgn($hRegion, $hRegion, $hBox, 2) | Out-Null
      [DshPet.Win32]::DeleteObject($hBox) | Out-Null
    } else {
      foreach ($box in $Boxes) {
        if ($null -eq $box -or [double]$box.w -lt 1 -or [double]$box.h -lt 1) { continue }
        $x = [int][Math]::Floor([double]$box.x * $scale)
        $y = [int][Math]::Floor([double]$box.y * $scale)
        $right = [Math]::Max($x + 1, [int][Math]::Ceiling(([double]$box.x + [double]$box.w) * $scale))
        $bottom = [Math]::Max($y + 1, [int][Math]::Ceiling(([double]$box.y + [double]$box.h) * $scale))
        $hBox = [DshPet.Win32]::CreateRectRgn($x, $y, $right, $bottom)
        [DshPet.Win32]::CombineRgn($hRegion, $hRegion, $hBox, 2) | Out-Null
        [DshPet.Win32]::DeleteObject($hBox) | Out-Null
      }
    }
    $applied = [DshPet.Win32]::SetWindowRgn($handle, $hRegion, $false)
    if ($applied -eq 0) { [DshPet.Win32]::DeleteObject($hRegion) | Out-Null }
  } catch { Write-PetLog ("Hit-test region: " + $_.Exception.Message) }
}
function Send-PetNativeDragPosition {
  if (-not $script:NativeDragActive) { return }
  $point = New-Object DshPet.Point
  if (-not [DshPet.Win32]::GetCursorPos([ref]$point)) { return }
  $x = $script:DragStartPetX + (($point.X - $script:DragStartCursorX) / $script:DragScale)
  $y = $script:DragStartPetY + (($point.Y - $script:DragStartCursorY) / $script:DragScale)
  if ([Math]::Abs($x - $script:DragLastSentX) -lt 0.25 -and [Math]::Abs($y - $script:DragLastSentY) -lt 0.25) { return }
  $script:DragLastSentX = $x
  $script:DragLastSentY = $y
  Send-PetWebMessage @{ type = 'dsh-pet-native-drag-move'; x = $x; y = $y }
}
function Stop-PetNativeDrag([bool]$NotifyRenderer = $false, [bool]$CaptureFinalPosition = $false) {
  $wasActive = $script:NativeDragActive
  if ($CaptureFinalPosition -and $wasActive) { Send-PetNativeDragPosition }
  $script:NativeDragActive = $false
  if ($null -ne $script:DragTimer) {
    try { $script:DragTimer.Stop() } catch { }
    $script:DragTimer = $null
  }
  if ($script:NativeMouseCaptured) {
    try { [DshPet.Win32]::ReleaseCapture() | Out-Null } catch { }
    $script:NativeMouseCaptured = $false
  }
  if ($NotifyRenderer -and $wasActive) {
    Send-PetWebMessage @{ type = 'dsh-pet-native-drag-end' }
  }
}
function Start-PetNativeDrag([object]$Message) {
  Stop-PetNativeDrag
  $handle = (New-Object System.Windows.Interop.WindowInteropHelper($script:Window)).Handle
  if ($handle -eq [IntPtr]::Zero) { return }
  $cursor = New-Object DshPet.Point
  if (-not [DshPet.Win32]::GetCursorPos([ref]$cursor)) { return }
  $script:NativeDragActive = $true
  $script:DragStartPetX = [double]$Message.screenX
  $script:DragStartPetY = [double]$Message.screenY
  $script:DragScale = [Math]::Max(0.5, [System.Windows.Media.VisualTreeHelper]::GetDpi($script:Window).DpiScaleX)
  $script:DragStartCursorX = if ($null -ne $Message.pointerScreenX) {
    [double]$Message.pointerScreenX * $script:DragScale
  } else { [double]$cursor.X }
  $script:DragStartCursorY = if ($null -ne $Message.pointerScreenY) {
    [double]$Message.pointerScreenY * $script:DragScale
  } else { [double]$cursor.Y }
  $script:DragLastSentX = $script:DragStartPetX
  $script:DragLastSentY = $script:DragStartPetY
  Set-PetHitRegion -FullWindow $true
  [DshPet.Win32]::SetCapture($handle) | Out-Null
  $script:NativeMouseCaptured = $true
  $script:DragTimer = New-Object System.Windows.Threading.DispatcherTimer
  $script:DragTimer.Interval = [TimeSpan]::FromMilliseconds(16)
  $script:DragTimer.add_Tick({
    try {
      if (-not $script:NativeDragActive) { return }
      if ([DshPet.Win32]::GetAsyncKeyState(0x01) -ge 0) {
        Stop-PetNativeDrag -NotifyRenderer $true -CaptureFinalPosition $true
        return
      }
      Send-PetNativeDragPosition
    } catch {
      Write-PetLog ("Native drag: " + $_.Exception.Message)
      Stop-PetNativeDrag -NotifyRenderer $true
    }
  })
  $script:DragTimer.Start()
}
try {
  Add-Type -AssemblyName PresentationFramework
  Add-Type -AssemblyName PresentationCore
  Add-Type -AssemblyName WindowsBase
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace DshPet {
  [StructLayout(LayoutKind.Sequential)]
  public struct Point { public int X; public int Y; }
  public static class Win32 {
    [DllImport("user32.dll")] public static extern int SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw);
    [DllImport("user32.dll")] public static extern IntPtr SetCapture(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ReleaseCapture();
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int virtualKey);
    [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr hObject);
    [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int left, int top, int right, int bottom);
    [DllImport("gdi32.dll")] public static extern int CombineRgn(IntPtr dest, IntPtr src1, IntPtr src2, int mode);
  }
}
'@ | Out-Null
  $source = Join-Path $PSScriptRoot 'webview2'
  $baseDir = Join-Path $env:LOCALAPPDATA 'dsh-pet\webview2'
  $dllDir = Join-Path $baseDir ('run-' + $PID)
  if (Test-Path -LiteralPath $source) {
    New-Item -ItemType Directory -Force $dllDir | Out-Null
    Get-ChildItem -LiteralPath $source -File | ForEach-Object {
      $target = Join-Path $dllDir $_.Name
      try {
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force
        Unblock-File -LiteralPath $target
      } catch { }
    }
    try {
      Get-ChildItem -LiteralPath $baseDir -Directory -Filter 'run-*' -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -ne $dllDir -and $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    } catch { }
  }
  if (-not (Test-Path -LiteralPath (Join-Path $dllDir 'Microsoft.Web.WebView2.Core.dll'))) {
    $fallback = Get-ChildItem -LiteralPath $baseDir -Directory -Filter 'run-*' -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -ne $fallback) { $dllDir = $fallback.FullName }
  }
  Set-Location $dllDir
  Add-Type -Path (Join-Path $dllDir 'Microsoft.Web.WebView2.Core.dll')
  Add-Type -Path (Join-Path $dllDir 'Microsoft.Web.WebView2.Wpf.dll')

  $script:LaunchUrl = $LaunchUrl
  $script:NativeDragActive = $false
  $script:NativeMouseCaptured = $false
  $script:DragTimer = $null
  $script:Window = New-Object System.Windows.Window
  $workArea = [System.Windows.SystemParameters]::WorkArea
  $script:Window.Left = $workArea.Left
  $script:Window.Top = $workArea.Top
  $script:Window.Width = $workArea.Width
  $script:Window.Height = $workArea.Height
  $script:Window.WindowStyle = 'None'
  $script:Window.ResizeMode = 'NoResize'
  $script:Window.AllowsTransparency = $true
  $script:Window.Background = [System.Windows.Media.Brushes]::Transparent
  $script:Window.Topmost = $true
  $script:Window.ShowInTaskbar = $false
  $script:Window.Title = 'DSH Pet'

  $script:WebView = New-Object Microsoft.Web.WebView2.Wpf.WebView2CompositionControl
  $script:WebView.DefaultBackgroundColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
  $creation = New-Object Microsoft.Web.WebView2.Wpf.CoreWebView2CreationProperties
  $creation.UserDataFolder = Join-Path $env:LOCALAPPDATA 'dsh-pet\webview-profile'
  $script:WebView.CreationProperties = $creation
  $script:Window.Content = $script:WebView

  $script:WebView.add_CoreWebView2InitializationCompleted({
    try {
      $eventArgs = $args[1]
      if ($null -eq $eventArgs -or -not $eventArgs.IsSuccess) {
        Write-PetLog ("WebView2 init failed: " + [string]$eventArgs.InitializationException)
        return
      }
      $script:WebView.CoreWebView2.add_WebMessageReceived({
        try {
          $message = $args[1].WebMessageAsJson | ConvertFrom-Json
          if ($message.type -eq 'dsh-pet-native-drag-start') {
            Start-PetNativeDrag $message
            return
          }
          if ($message.type -eq 'dsh-pet-native-drag-stop') {
            Stop-PetNativeDrag -NotifyRenderer $true -CaptureFinalPosition $true
            return
          }
          if ($message.type -ne 'dsh-pet-regions') { return }
          Set-PetHitRegion -FullWindow $false -Boxes @($message.boxes)
        } catch { Write-PetLog ("Web message handling: " + $_.Exception.Message) }
      })
      if ($script:LaunchUrl -ne '') { $script:WebView.CoreWebView2.Navigate($script:LaunchUrl) }
    } catch {
      Write-PetLog ("WebView2 init handler: " + $_.Exception.Message)
    }
  })

  $script:Window.Add_ContentRendered({
    try { $script:WebView.EnsureCoreWebView2Async($null) | Out-Null }
    catch { Write-PetLog ("WebView2 ensure: " + $_.Exception.Message) }
  })

  $notify = New-Object System.Windows.Forms.NotifyIcon
  $notify.Icon = [System.Drawing.SystemIcons]::Application
  $notify.Text = 'DSH Pet'
  $notify.Visible = $true
  $menu = New-Object System.Windows.Forms.ContextMenuStrip
  $toggle = New-Object System.Windows.Forms.ToolStripMenuItem
  $toggle.Text = '显示 / 隐藏'
  $toggle.Add_Click({ if ($script:Window.Visibility -eq 'Visible') { $script:Window.Hide() } else { $script:Window.Show() } })
  $menu.Items.Add($toggle) | Out-Null
  $settings = New-Object System.Windows.Forms.ToolStripMenuItem
  $settings.Text = '设置'
  $settings.Add_Click({
    try {
      $script:Window.Show()
      $script:Window.Activate()
      if ($null -ne $script:WebView.CoreWebView2) {
        $script:WebView.CoreWebView2.ExecuteScriptAsync("document.querySelector('.dshp-pet')?.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}))") | Out-Null
      }
    } catch { }
  })
  $menu.Items.Add($settings) | Out-Null
  $exit = New-Object System.Windows.Forms.ToolStripMenuItem
  $exit.Text = '退出'
  $exit.Add_Click({ try { $script:Window.Close() } catch { } })
  $menu.Items.Add($exit) | Out-Null
  $notify.ContextMenuStrip = $menu
  $script:Window.Add_Closed({
    Stop-PetNativeDrag
    try { $notify.Visible = $false; $notify.Dispose() } catch { }
  })

  $script:Window.ShowDialog() | Out-Null
} catch {
  Write-PetLog $_.Exception.ToString()
}
