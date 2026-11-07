param([string]$LaunchUrl = '')

$logPath = Join-Path $env:LOCALAPPDATA 'dsh-pet\webview-error.txt'
function Write-PetLog([string]$Text) {
  try {
    New-Item -ItemType Directory -Force (Split-Path $logPath) | Out-Null
    $Text | Set-Content -LiteralPath $logPath -Encoding UTF8
  } catch { }
}

try {
  Add-Type -AssemblyName PresentationFramework
  Add-Type -AssemblyName PresentationCore
  Add-Type -AssemblyName WindowsBase
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern int SetWindowRgn(IntPtr hWnd, IntPtr hRgn, bool bRedraw);' -Name Win32 -Namespace DshPet -PassThru | Out-Null
  $chromaCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class DshPetChroma {
  [DllImport("gdi32.dll")] private static extern IntPtr CreateRectRgn(int left, int top, int right, int bottom);
  [DllImport("gdi32.dll")] private static extern int CombineRgn(IntPtr dest, IntPtr src1, IntPtr src2, int mode);
  [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr handle);

  public static IntPtr Build(Bitmap bitmap, int topOffset) {
    IntPtr total = CreateRectRgn(0, 0, 0, 0);
    bool any = false;
    BitmapData data = bitmap.LockBits(new Rectangle(0, 0, bitmap.Width, bitmap.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    try {
      byte[] bytes = new byte[data.Stride * data.Height];
      Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
      for (int y = 0; y < bitmap.Height; y++) {
        int row = y * data.Stride;
        int start = -1;
        for (int x = 0; x <= bitmap.Width; x++) {
          bool transparent = true;
          if (x < bitmap.Width) {
            int i = row + (x * 4);
            int b = bytes[i];
            int g = bytes[i + 1];
            int r = bytes[i + 2];
            transparent = (r > 235 && g < 25 && b > 235);
          }
          if (!transparent && start < 0) start = x;
          else if (transparent && start >= 0) {
            IntPtr rect = CreateRectRgn(start, y + topOffset, x, y + topOffset + 1);
            CombineRgn(total, total, rect, 2);
            DeleteObject(rect);
            any = true;
            start = -1;
          }
        }
      }
    } finally {
      bitmap.UnlockBits(data);
    }
    if (!any) { DeleteObject(total); return IntPtr.Zero; }
    return total;
  }
}
'@
  Add-Type -TypeDefinition $chromaCode -ReferencedAssemblies System.Drawing | Out-Null

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
  $script:Dragging = $false
  $script:DragOffsetX = 0.0
  $script:DragOffsetY = 0.0
  $script:Window = New-Object System.Windows.Window
  $script:Window.Width = 420
  $script:Window.Height = 760
  $script:Window.WindowStyle = 'None'
  $script:Window.ResizeMode = 'NoResize'
  $script:Window.AllowsTransparency = $false
  $script:Window.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#ff00ff')
  $script:Window.Topmost = $true
  $script:Window.ShowInTaskbar = $false
  $script:Window.Title = 'DSH Pet'
  $area = [System.Windows.SystemParameters]::WorkArea
  $script:Window.Left = [Math]::Max(0, $area.Right - 440)
  $script:Window.Top = [Math]::Max(0, $area.Bottom - 800)

  $grid = New-Object System.Windows.Controls.Grid
  $dragRow = New-Object System.Windows.Controls.RowDefinition
  $dragRow.Height = [System.Windows.GridLength]::new(22)
  $contentRow = New-Object System.Windows.Controls.RowDefinition
  $contentRow.Height = [System.Windows.GridLength]::new(1, [System.Windows.GridUnitType]::Star)
  $grid.RowDefinitions.Add($dragRow) | Out-Null
  $grid.RowDefinitions.Add($contentRow) | Out-Null
  $script:Window.Content = $grid

  $drag = New-Object System.Windows.Controls.Border
  $drag.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#01000000')
  $drag.Add_MouseLeftButtonDown({ try { $script:Window.DragMove() } catch { } })
  [System.Windows.Controls.Grid]::SetRow($drag, 0)
  $grid.Children.Add($drag) | Out-Null

  $script:WebView = New-Object Microsoft.Web.WebView2.Wpf.WebView2
  $script:WebView.DefaultBackgroundColor = [System.Drawing.Color]::Magenta
  $creation = New-Object Microsoft.Web.WebView2.Wpf.CoreWebView2CreationProperties
  $creation.UserDataFolder = Join-Path $env:LOCALAPPDATA 'dsh-pet\webview-profile'
  $script:WebView.CreationProperties = $creation
  [System.Windows.Controls.Grid]::SetRow($script:WebView, 1)
  $grid.Children.Add($script:WebView) | Out-Null

  $script:CaptureActive = $false
  $script:CaptureTask = $null
  $script:CaptureStream = $null
  $script:CaptureTimer = New-Object System.Windows.Threading.DispatcherTimer
  $script:CaptureTimer.Interval = [TimeSpan]::FromMilliseconds(900)
  $script:CaptureTimer.Add_Tick({
    try {
      if ($null -ne $script:CaptureTask) {
        if (-not $script:CaptureTask.IsCompleted) { return }
        $task = $script:CaptureTask
        $stream = $script:CaptureStream
        $script:CaptureTask = $null
        $script:CaptureStream = $null
        if ($task.IsFaulted -or $task.IsCanceled -or $null -eq $stream) { return }
        $stream.Position = 0
        $bitmap = New-Object System.Drawing.Bitmap($stream)
        $dpi = [System.Windows.Media.VisualTreeHelper]::GetDpi($script:Window)
        $top = [int](22 * $dpi.DpiScaleY)
        $hRgn = [DshPetChroma]::Build($bitmap, $top)
        $bitmap.Dispose()
        if ($hRgn -ne [IntPtr]::Zero) {
          $handle = (New-Object System.Windows.Interop.WindowInteropHelper($script:Window)).Handle
          if ($handle -ne [IntPtr]::Zero) {
            [DshPet.Win32]::SetWindowRgn($handle, $hRgn, $true) | Out-Null
            $script:CaptureActive = $true
          }
        }
        return
      }
      if ($null -eq $script:WebView.CoreWebView2) { return }
      $stream = New-Object System.IO.MemoryStream
      $script:CaptureStream = $stream
      $script:CaptureTask = $script:WebView.CoreWebView2.CapturePreviewAsync(
        [Microsoft.Web.WebView2.Core.CoreWebView2CapturePreviewImageFormat]::Png,
        $stream
      )
    } catch {
      $script:CaptureTask = $null
      $script:CaptureStream = $null
    }
  })
  $script:CaptureTimer.Start()

  $script:WebView.add_CoreWebView2InitializationCompleted({
    try {
      $eventArgs = $args[1]
      if ($null -eq $eventArgs -or -not $eventArgs.IsSuccess) {
        Write-PetLog ("WebView2 init failed: " + [string]$eventArgs.InitializationException)
        return
      }
      if ($script:LaunchUrl -ne '') { $script:WebView.CoreWebView2.Navigate($script:LaunchUrl) }
      $script:WebView.CoreWebView2.add_WebMessageReceived({
        try {
          $message = $args[1].WebMessageAsJson | ConvertFrom-Json
          if ($message.type -eq 'dsh-pet-window-drag-start') {
            $script:DragOffsetX = [double]$message.screenX - $script:Window.Left
            $script:DragOffsetY = [double]$message.screenY - $script:Window.Top
            $script:Dragging = $true
            return
          }
          if ($message.type -eq 'dsh-pet-window-drag-move') {
            if ($script:Dragging) {
              $script:Window.Left = [double]$message.screenX - $script:DragOffsetX
              $script:Window.Top = [double]$message.screenY - $script:DragOffsetY
            }
            return
          }
          if ($message.type -eq 'dsh-pet-window-drag-end') {
            $script:Dragging = $false
            return
          }
          if ($message.type -eq 'dsh-pet-regions' -and $script:CaptureActive) { return }
          if ($message.type -eq 'dsh-pet-regions') {
            $handle = (New-Object System.Windows.Interop.WindowInteropHelper($script:Window)).Handle
            if ($handle -ne [IntPtr]::Zero) {
              $dpi = [System.Windows.Media.VisualTreeHelper]::GetDpi($script:Window)
              $scale = $dpi.DpiScaleX
              $topOffset = 22.0
              $region = New-Object System.Drawing.Region
              $region.MakeEmpty()
              $pet = $message.pet
              if ($null -ne $message.runs -and $message.runs.Count -gt 0) {
                foreach ($run in $message.runs) {
                  $x = [int](($pet.x + [double]$run[0]) * $scale)
                  $y = [int](($pet.y + $topOffset + [double]$run[1]) * $scale)
                  $w = [Math]::Max(1, [int]([double]$run[2] * $scale))
                  $h = [Math]::Max(1, [int]$scale)
                  $region.Union([System.Drawing.Rectangle]::new($x, $y, $w, $h)) | Out-Null
                }
              } elseif ($null -ne $pet) {
                $x = [int]([double]$pet.x * $scale)
                $y = [int](([double]$pet.y + $topOffset) * $scale)
                $w = [Math]::Max(1, [int]([double]$pet.w * $scale))
                $h = [Math]::Max(1, [int]([double]$pet.h * $scale))
                $region.Union([System.Drawing.Rectangle]::new($x, $y, $w, $h)) | Out-Null
              }
              if ($null -ne $message.boxes) {
                foreach ($box in $message.boxes) {
                  $x = [int]([double]$box.x * $scale)
                  $y = [int](([double]$box.y + $topOffset) * $scale)
                  $w = [Math]::Max(1, [int]([double]$box.w * $scale))
                  $h = [Math]::Max(1, [int]([double]$box.h * $scale))
                  $region.Union([System.Drawing.Rectangle]::new($x, $y, $w, $h)) | Out-Null
                }
              }
              $graphics = [System.Drawing.Graphics]::FromHwnd($handle)
              $hRgn = $region.GetHrgn($graphics)
              [DshPet.Win32]::SetWindowRgn($handle, $hRgn, $true) | Out-Null
              $graphics.Dispose()
              $region.Dispose()
            }
            return
          }
          if ($message.type -ne 'dsh-pet-bounds') { return }
          $targetWidth = [Math]::Max(200, [Math]::Min(520, [int]$message.width))
          $targetHeight = [Math]::Max(180, [Math]::Min(820, ([int]$message.height + 22)))
          $right = $script:Window.Left + $script:Window.Width
          $bottom = $script:Window.Top + $script:Window.Height
          $script:Window.Width = $targetWidth
          $script:Window.Height = $targetHeight
          $script:Window.Left = $right - $targetWidth
          $script:Window.Top = $bottom - $targetHeight
          $area = [System.Windows.SystemParameters]::WorkArea
          if ($script:Window.Left -lt $area.Left) { $script:Window.Left = $area.Left }
          if ($script:Window.Top -lt $area.Top) { $script:Window.Top = $area.Top }
          if ($script:Window.Left + $script:Window.Width -gt $area.Right) { $script:Window.Left = $area.Right - $script:Window.Width }
          if ($script:Window.Top + $script:Window.Height -gt $area.Bottom) { $script:Window.Top = $area.Bottom - $script:Window.Height }
        } catch { }
      })
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
    try { $notify.Visible = $false; $notify.Dispose() } catch { }
  })

  $script:Window.ShowDialog() | Out-Null
} catch {
  Write-PetLog $_.Exception.ToString()
}
