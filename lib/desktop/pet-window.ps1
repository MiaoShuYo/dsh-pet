param(
  [int]$Port = 45873
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:Port = $Port
$script:Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:AssetRoot = Join-Path $script:Root 'assets'
$script:ConfigDir = Join-Path $env:LOCALAPPDATA 'dsh-pet'
$script:ConfigPath = Join-Path $script:ConfigDir 'window.json'
$script:ErrorPath = Join-Path $script:ConfigDir 'last-error.txt'
$script:CurrentImage = ''
$script:LastTaskKey = ''
$script:LastPlaque = ''
$script:Bob = $null
$script:Ready = $false
$script:Scale = 1.0

New-Item -ItemType Directory -Force -Path $script:ConfigDir | Out-Null

function Brush([string]$Value) {
  return [System.Windows.Media.BrushConverter]::new().ConvertFromString($Value)
}

function Set-PetImage([string]$StateValue, [string]$SkinValue) {
  $stateKey = switch ($StateValue) {
    'working' { 'working' }
    'focusing' { 'working' }
    'waiting' { 'waiting' }
    'happy' { 'happy' }
    'sad' { 'sad' }
    default { 'idle' }
  }
  $skinKey = switch ($SkinValue) {
    'mochi' { 'mochi' }
    'pixel' { 'pixel' }
    default { 'kuro' }
  }
  $key = "$skinKey-$stateKey"
  if ($key -eq $script:CurrentImage) { return }
  $path = Join-Path $script:AssetRoot "$key.png"
  if (-not (Test-Path -LiteralPath $path)) {
    $path = Join-Path $script:AssetRoot 'kuro-idle.png'
  }
  if (-not (Test-Path -LiteralPath $path)) { return }
  try {
    $image = New-Object System.Windows.Media.Imaging.BitmapImage
    $image.BeginInit()
    $image.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    $image.UriSource = [Uri]::new($path)
    $image.EndInit()
    $image.Freeze()
    $script:PetImage.Source = $image
    $script:CurrentImage = $key
  } catch {
    # Keep the previous picture rather than blanking the window.
  }
}

function Start-Bob() {
  if ($null -ne $script:Bob) { return }
  $animation = New-Object System.Windows.Media.Animation.DoubleAnimation
  $animation.From = 0
  $animation.To = -5
  $animation.Duration = [System.Windows.Duration]::new([TimeSpan]::FromMilliseconds(550))
  $animation.AutoReverse = $true
  $animation.RepeatBehavior = [System.Windows.Media.Animation.RepeatBehavior]::Forever
  $script:PetImage.RenderTransform.BeginAnimation(
    [System.Windows.Media.TranslateTransform]::YProperty,
    $animation
  )
  $script:Bob = $animation
}

function Stop-Bob() {
  if ($null -eq $script:Bob) { return }
  $script:PetImage.RenderTransform.BeginAnimation(
    [System.Windows.Media.TranslateTransform]::YProperty,
    $null
  )
  $script:PetImage.RenderTransform.Y = 0
  $script:Bob = $null
}

function Add-Text([System.Windows.Controls.Panel]$Parent, [string]$Text, [double]$Size, [string]$Color, [string]$Weight = 'Normal') {
  $block = New-Object System.Windows.Controls.TextBlock
  $block.Text = $Text
  $block.FontSize = $Size
  $block.Foreground = Brush $Color
  $block.FontWeight = $Weight
  $block.TextTrimming = 'CharacterEllipsis'
  $block.TextWrapping = 'NoWrap'
  $block.MaxWidth = 250
  $block.Margin = '0,0,0,2'
  $Parent.Children.Add($block) | Out-Null
}

function Update-Tasks($State, [string]$Language) {
  $tasks = @($State.tasks | Where-Object { $null -ne $_ })
  $count = [int]$State.taskCount
  if ($count -lt $tasks.Count) { $count = $tasks.Count }
  $key = ($tasks | ForEach-Object { "$($_.id)|$($_.label)|$($_.status)|$($_.progress)|$($_.command)" }) -join '~'
  if ($key -eq $script:LastTaskKey) { return }
  $script:LastTaskKey = $key
  $script:TaskStack.Children.Clear()
  if ($tasks.Count -eq 0) {
    $script:TaskCard.Visibility = 'Collapsed'
    return
  }
  $title = if ($Language -eq 'en') { "Running tasks  $count" } else { "进行中的任务  $count" }
  Add-Text $script:TaskStack $title 11 '#9AA4B2' 'Bold'
  $shown = @($tasks | Select-Object -First 3)
  foreach ($task in $shown) {
    $item = New-Object System.Windows.Controls.Border
    $item.CornerRadius = 7
    $item.Padding = '7,5'
    $item.Margin = '0,3,0,0'
    $item.Background = Brush '#2A2A31'
    $accent = if ([string]$task.source -eq 'tool') { '#31B56A' } else { '#6DA8FF' }
    $item.BorderBrush = Brush $accent
    $item.BorderThickness = '2,0,0,0'
    $inner = New-Object System.Windows.Controls.StackPanel
    $item.Child = $inner
    Add-Text $inner ([string]$task.label) 12 '#F4F6FA' 'SemiBold'
    $statusText = if ([string]$task.status -eq 'stopping') {
      if ($Language -eq 'en') { 'Stopping' } else { '正在停止' }
    } elseif ([string]$task.progress -ne '') {
      [string]$task.progress
    } elseif ($task.command -eq $true) {
      if ($Language -eq 'en') { 'Running command' } else { '正在运行命令' }
    } else {
      if ($Language -eq 'en') { 'Running' } else { '运行中' }
    }
    Add-Text $inner $statusText 10 '#9AA4B2'
    $script:TaskStack.Children.Add($item) | Out-Null
  }
  if ($tasks.Count -gt $shown.Count) {
    $more = if ($Language -eq 'en') { "+$($tasks.Count - $shown.Count) more tasks" } else { "还有 $($tasks.Count - $shown.Count) 个任务" }
    Add-Text $script:TaskStack $more 10 '#9AA4B2'
  }
  $script:TaskCard.Visibility = 'Visible'
}

function Format-Tokens([double]$Value) {
  if ($Value -ge 1000000) { return ('{0:0.#}M tok' -f ($Value / 1000000)) }
  if ($Value -ge 1000) { return ('{0:0.#}k tok' -f ($Value / 1000)) }
  return ('{0:0} tok' -f $Value)
}

function Update-Plaque($State, [string]$Language) {
  $parts = @()
  if ([string]$State.accountText -ne '') { $parts += [string]$State.accountText }
  if ([double]$State.tokens -gt 0) { $parts += (Format-Tokens ([double]$State.tokens)) }
  if ([double]$State.contextPercent -ge 0) { $parts += ('{0:0}%' -f [double]$State.contextPercent) }
  $text = if ($parts.Count -gt 0) { $parts -join '  ·  ' } else { 'DSH Pet' }
  if ($text -eq $script:LastPlaque) { return }
  $script:LastPlaque = $text
  $script:PlaqueText.Text = $text
}

function Apply-State($State) {
  if ($null -eq $State -or $State.ok -ne $true) {
    $script:PlaqueText.Text = 'DSH 未连接'
    return
  }
  $language = [string]$State.language
  if ($language -ne 'en') { $language = 'zh' }
  Set-PetImage ([string]$State.state) ([string]$State.skinId)
  Update-Tasks $State $language
  Update-Plaque $State $language
  if ([string]$State.state -eq 'working' -or [string]$State.state -eq 'focusing') {
    Start-Bob
  } else {
    Stop-Bob
  }
}

function Save-Position() {
  if (-not $script:Ready) { return }
  try {
    $scale = $script:Scale
    if ($scale -le 0) { $scale = 1.0 }
    $value = @{
      left = [double]$script:Window.Left * $scale
      top = [double]$script:Window.Top * $scale
    } | ConvertTo-Json -Compress
    Set-Content -LiteralPath $script:ConfigPath -Value $value -Encoding UTF8
  } catch { }
}

function Set-DefaultPosition() {
  $scale = $script:Scale
  if ($scale -le 0) { $scale = 1.0 }
  $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $script:Window.Left = ($area.Right - ($script:Window.Width * $scale) - 36) / $scale
  $script:Window.Top = ($area.Bottom - ($script:Window.Height * $scale) - 36) / $scale
}

function Initialize-Position() {
  if ($script:Ready) { return }
  try {
    $source = [System.Windows.PresentationSource]::FromVisual($script:Window)
    if ($null -ne $source -and $null -ne $source.CompositionTarget) {
      $script:Scale = [double]$source.CompositionTarget.TransformToDevice.M11
    }
  } catch { }
  if ($script:Scale -le 0) { $script:Scale = 1.0 }
  $scale = $script:Scale
  $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $virtual = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $left = $area.Right - ($script:Window.Width * $scale) - 36
  $top = $area.Bottom - ($script:Window.Height * $scale) - 36
  if (Test-Path -LiteralPath $script:ConfigPath) {
    try {
      $config = Get-Content -LiteralPath $script:ConfigPath -Raw | ConvertFrom-Json
      $candidateLeft = [double]$config.left
      $candidateTop = [double]$config.top
      if ($candidateLeft -ge $virtual.Left -and $candidateLeft -le ($virtual.Right - 40) -and
          $candidateTop -ge $virtual.Top -and $candidateTop -le ($virtual.Bottom - 40)) {
        $left = $candidateLeft
        $top = $candidateTop
      }
    } catch { }
  }
  $script:Window.Left = $left / $scale
  $script:Window.Top = $top / $scale
  $script:Ready = $true
  Save-Position
}

function Focus-DSH() {
  try {
    $candidate = Get-Process | Where-Object {
      $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like '*DeepSeek*' -or $_.MainWindowTitle -like '*DeepSeek*')
    } | Select-Object -First 1
    if ($null -ne $candidate) {
      $shell = New-Object -ComObject WScript.Shell
      $shell.AppActivate($candidate.Id) | Out-Null
    }
  } catch { }
}

function Build-Window() {
  $script:Window = New-Object System.Windows.Window
  $script:Window.Title = 'DSH Pet'
  $script:Window.Width = 300
  $script:Window.Height = 390
  $script:Window.WindowStyle = 'None'
  $script:Window.AllowsTransparency = $true
  $script:Window.Background = [System.Windows.Media.Brushes]::Transparent
  $script:Window.Topmost = $true
  $script:Window.ShowInTaskbar = $false
  $script:Window.ResizeMode = 'NoResize'
  $script:Window.WindowStartupLocation = 'Manual'
  $script:Window.SnapsToDevicePixels = $true

  $root = New-Object System.Windows.Controls.Grid
  $root.Background = Brush '#01000000'
  $script:Window.Content = $root

  $stack = New-Object System.Windows.Controls.StackPanel
  $stack.VerticalAlignment = 'Bottom'
  $stack.HorizontalAlignment = 'Center'
  $root.Children.Add($stack) | Out-Null

  $script:TaskCard = New-Object System.Windows.Controls.Border
  $script:TaskCard.CornerRadius = 12
  $script:TaskCard.Background = Brush '#EA18181D'
  $script:TaskCard.BorderBrush = Brush '#35FFFFFF'
  $script:TaskCard.BorderThickness = '1'
  $script:TaskCard.Padding = '10,8'
  $script:TaskCard.Margin = '8,0,8,8'
  $script:TaskCard.Visibility = 'Collapsed'
  $script:TaskStack = New-Object System.Windows.Controls.StackPanel
  $script:TaskCard.Child = $script:TaskStack
  $stack.Children.Add($script:TaskCard) | Out-Null

  $script:PetImage = New-Object System.Windows.Controls.Image
  $script:PetImage.Width = 170
  $script:PetImage.Height = 170
  $script:PetImage.Stretch = 'Uniform'
  $script:PetImage.Margin = '0,0,0,2'
  $script:PetImage.RenderTransform = New-Object System.Windows.Media.TranslateTransform
  $stack.Children.Add($script:PetImage) | Out-Null

  $plaque = New-Object System.Windows.Controls.Border
  $plaque.CornerRadius = 13
  $plaque.Background = Brush '#EA18181D'
  $plaque.BorderBrush = Brush '#35FFFFFF'
  $plaque.BorderThickness = '1'
  $plaque.Padding = '10,5'
  $plaque.Margin = '8,2,8,0'
  $script:PlaqueText = New-Object System.Windows.Controls.TextBlock
  $script:PlaqueText.FontSize = 11
  $script:PlaqueText.Foreground = Brush '#F4F6FA'
  $script:PlaqueText.Text = 'DSH Pet'
  $plaque.Child = $script:PlaqueText
  $stack.Children.Add($plaque) | Out-Null

  $menu = New-Object System.Windows.Controls.ContextMenu
  $openItem = New-Object System.Windows.Controls.MenuItem
  $openItem.Header = '打开 DSH'
  $openItem.Add_Click({ Focus-DSH })
  $menu.Items.Add($openItem) | Out-Null
  $resetItem = New-Object System.Windows.Controls.MenuItem
  $resetItem.Header = '回到屏幕右下角'
  $resetItem.Add_Click({ Set-DefaultPosition; Save-Position })
  $menu.Items.Add($resetItem) | Out-Null
  $menu.Items.Add((New-Object System.Windows.Controls.Separator)) | Out-Null
  $closeItem = New-Object System.Windows.Controls.MenuItem
  $closeItem.Header = '关闭桌面宠物'
  $closeItem.Add_Click({ $script:Window.Close() })
  $menu.Items.Add($closeItem) | Out-Null
  $script:Window.ContextMenu = $menu

  $script:Window.Add_MouseLeftButtonDown({
    if ($_.ButtonState -eq [System.Windows.Input.MouseButtonState]::Pressed) {
      try { $script:Window.DragMove() } catch { }
    }
  })
  $script:Window.Add_LocationChanged({ Save-Position })
  $script:Window.Add_Closed({ Save-Position })
  $script:Window.Add_ContentRendered({ Initialize-Position })
}

try {
  Build-Window
  $script:Timer = New-Object System.Windows.Threading.DispatcherTimer
  $script:Timer.Interval = [TimeSpan]::FromMilliseconds(700)
  $script:Timer.Add_Tick({
    try {
      $uri = 'http://127.0.0.1:' + $script:Port + '/state'
      $state = Invoke-RestMethod -Uri $uri -TimeoutSec 1
      Apply-State $state
    } catch {
      Apply-State $null
    }
  })
  $script:Timer.Start()
  $script:Window.ShowDialog() | Out-Null
} catch {
  try {
    $_ | Out-String | Set-Content -LiteralPath $script:ErrorPath -Encoding UTF8
  } catch { }
  exit 1
}
