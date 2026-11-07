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

  $source = Join-Path $PSScriptRoot 'webview2'
  $dllDir = Join-Path $env:LOCALAPPDATA 'dsh-pet\webview2'
  if (Test-Path -LiteralPath $source) {
    New-Item -ItemType Directory -Force $dllDir | Out-Null
    Get-ChildItem -LiteralPath $source -File | ForEach-Object {
      $target = Join-Path $dllDir $_.Name
      if (-not (Test-Path -LiteralPath $target)) {
        try {
          Copy-Item -LiteralPath $_.FullName -Destination $target -Force
          Unblock-File -LiteralPath $target
        } catch { }
      }
    }
  }
  Set-Location $dllDir
  Add-Type -Path (Join-Path $dllDir 'Microsoft.Web.WebView2.Core.dll')
  Add-Type -Path (Join-Path $dllDir 'Microsoft.Web.WebView2.Wpf.dll')

  $script:LaunchUrl = $LaunchUrl
  $script:Window = New-Object System.Windows.Window
  $script:Window.Width = 420
  $script:Window.Height = 760
  $script:Window.WindowStyle = 'None'
  $script:Window.ResizeMode = 'NoResize'
  $script:Window.AllowsTransparency = $false
  $script:Window.Background = [System.Windows.Media.BrushConverter]::new().ConvertFromString('#0c0c0e')
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
  $script:WebView.DefaultBackgroundColor = [System.Drawing.Color]::FromArgb(255, 12, 12, 14)
  $creation = New-Object Microsoft.Web.WebView2.Wpf.CoreWebView2CreationProperties
  $creation.UserDataFolder = Join-Path $env:LOCALAPPDATA 'dsh-pet\webview-profile'
  $script:WebView.CreationProperties = $creation
  [System.Windows.Controls.Grid]::SetRow($script:WebView, 1)
  $grid.Children.Add($script:WebView) | Out-Null

  $script:WebView.add_CoreWebView2InitializationCompleted({
    try {
      $eventArgs = $args[1]
      if ($null -eq $eventArgs -or -not $eventArgs.IsSuccess) {
        Write-PetLog ("WebView2 init failed: " + [string]$eventArgs.InitializationException)
        return
      }
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
    try { $notify.Visible = $false; $notify.Dispose() } catch { }
  })

  $script:Window.ShowDialog() | Out-Null
} catch {
  Write-PetLog $_.Exception.ToString()
}
