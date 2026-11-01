param(
  [int]$Port = 45873,
  [switch]$Settings
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
$script:ShowTasks = $true
$script:ShowPlaque = $true
$script:Plaque = $null
$script:LastState = $null
$script:SettingsWindow = $null
$script:SettingsControls = @{}
$script:SuppressSettings = $false

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
  if (-not $script:ShowTasks) {
    $script:TaskCard.Visibility = 'Collapsed'
    return
  }
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

function Apply-Prefs($Prefs) {
  if ($null -eq $Prefs) { return }
  try {
    $size = [double]$Prefs.size
    if ($size -gt 0) {
      $script:PetImage.Width = $size * 1.4
      $script:PetImage.Height = $size * 1.4
    }
    $opacity = [double]$Prefs.opacity
    if ($opacity -ge 0.3 -and $opacity -le 1) { $script:Window.Opacity = $opacity }
    $previousShowTasks = $script:ShowTasks
    $script:ShowTasks = $Prefs.showTasks -ne $false
    if ($script:ShowTasks -and -not $previousShowTasks) { $script:LastTaskKey = '' }
    $script:ShowPlaque = $Prefs.showPlaque -ne $false
    if ($null -ne $script:Plaque) {
      $script:Plaque.Visibility = if ($script:ShowPlaque) { 'Visible' } else { 'Collapsed' }
    }
    if (-not $script:ShowTasks) { $script:TaskCard.Visibility = 'Collapsed' }
  } catch { }
}

function Update-SettingsData($State) {
  if ($null -eq $script:SettingsWindow) { return }
  try {
    $script:TodayLabel.Text = '今日 token：' + [string]([double]$State.todayTokens)
    $script:BalanceLabel.Text = '今日余额变化：' + [string]$State.balanceDelta
  } catch { }
}

function Apply-State($State) {
  if ($null -eq $State -or $State.ok -ne $true) {
    $script:PlaqueText.Text = 'DSH 未连接'
    return
  }
  $script:LastState = $State
  if ($null -ne $State.prefs) { Apply-Prefs $State.prefs }
  $language = [string]$State.language
  if ($language -ne 'en') { $language = 'zh' }
  Set-PetImage ([string]$State.state) ([string]$State.skinId)
  Update-Tasks $State $language
  Update-Plaque $State $language
  if ($null -ne $script:SettingsWindow -and $null -ne $State.prefs) {
    Update-SettingsUI $State.prefs
  }
  Update-SettingsData $State
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
  $script:Plaque = $plaque

  $menu = New-Object System.Windows.Controls.ContextMenu
  $settingsItem = New-Object System.Windows.Controls.MenuItem
  $settingsItem.Header = '设置…'
  $settingsItem.Add_Click({ Open-Settings })
  $menu.Items.Add($settingsItem) | Out-Null
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
  $closeItem.Header = '隐藏到托盘'
  $closeItem.Add_Click({ $script:Window.Hide() })
  $menu.Items.Add($closeItem) | Out-Null
  $script:Window.ContextMenu = $menu

  $script:Window.Add_MouseLeftButtonDown({
    if ($_.ClickCount -ge 2) {
      Focus-DSH
      return
    }
    if ($_.ButtonState -eq [System.Windows.Input.MouseButtonState]::Pressed) {
      try { $script:Window.DragMove() } catch { }
    }
  })
  $script:Window.Add_MouseDoubleClick({ Focus-DSH })
  $script:Window.Add_LocationChanged({ Save-Position })
  $script:Window.Add_Closed({ Save-Position })
  $script:Window.Add_ContentRendered({ Initialize-Position })
}

function Get-PrefValue($Prefs, [string]$Key) {
  $current = $Prefs
  foreach ($part in $Key.Split('.')) {
    if ($null -eq $current) { return $null }
    $property = $current.PSObject.Properties[$part]
    if ($null -eq $property) { return $null }
    $current = $property.Value
  }
  return $current
}

function Patch-For([string]$Key, $Value) {
  $parts = $Key.Split('.')
  $inner = @{ $parts[$parts.Count - 1] = $Value }
  for ($index = $parts.Count - 2; $index -ge 0; $index -= 1) {
    $inner = @{ $parts[$index] = $inner }
  }
  return $inner
}

function Send-SettingsPatch($Patch) {
  if ($script:SuppressSettings) { return }
  try {
    $body = @{ patch = $Patch } | ConvertTo-Json -Depth 8 -Compress
    Invoke-RestMethod -Method Post -Uri ('http://127.0.0.1:' + $script:Port + '/settings') -ContentType 'application/json' -Body $body | Out-Null
  } catch { }
}

function Send-SettingsAction([string]$Action, $Params = @{}) {
  try {
    $body = @{ action = $Action; params = $Params } | ConvertTo-Json -Depth 8 -Compress
    Invoke-RestMethod -Method Post -Uri ('http://127.0.0.1:' + $script:Port + '/settings') -ContentType 'application/json' -Body $body | Out-Null
  } catch { }
}

function Register-Control([string]$Key, $Control, [string]$Kind, $Label = $null) {
  $script:SettingsControls[$Key] = @{ Control = $Control; Kind = $Kind; Label = $Label }
}

function New-TabPanel($Tabs, [string]$Title) {
  $tab = New-Object System.Windows.Controls.TabItem
  $tab.Header = $Title
  $scroll = New-Object System.Windows.Controls.ScrollViewer
  $scroll.VerticalScrollBarVisibility = 'Auto'
  $panel = New-Object System.Windows.Controls.StackPanel
  $panel.Margin = '14,12'
  $scroll.Content = $panel
  $tab.Content = $scroll
  $Tabs.Items.Add($tab) | Out-Null
  return $panel
}

function Add-SectionTitle($Panel, [string]$Text) {
  $block = New-Object System.Windows.Controls.TextBlock
  $block.Text = $Text
  $block.FontSize = 12
  $block.FontWeight = 'Bold'
  $block.Foreground = Brush '#8FB4FF'
  $block.Margin = '0,8,0,6'
  $Panel.Children.Add($block) | Out-Null
}

function Add-CheckSetting($Panel, [string]$Label, [string]$Key, [bool]$Value) {
  $check = New-Object System.Windows.Controls.CheckBox
  $check.Content = $Label
  $check.IsChecked = $Value
  $check.Margin = '0,4,0,8'
  $check.Add_Click({ Send-SettingsPatch (Patch-For $Key ([bool]$check.IsChecked)) })
  $Panel.Children.Add($check) | Out-Null
  Register-Control $Key $check 'check'
}

function Add-TextSetting($Panel, [string]$Label, [string]$Key, [string]$Value, [bool]$Numeric = $false) {
  $row = New-Object System.Windows.Controls.StackPanel
  $row.Orientation = 'Horizontal'
  $row.Margin = '0,3,0,8'
  $caption = New-Object System.Windows.Controls.TextBlock
  $caption.Text = $Label
  $caption.Width = 150
  $caption.VerticalAlignment = 'Center'
  $row.Children.Add($caption) | Out-Null
  $box = New-Object System.Windows.Controls.TextBox
  $box.Text = $Value
  $box.Width = 160
  $box.Padding = '4,3'
  $box.Add_LostFocus({
    if ($script:SuppressSettings) { return }
    if ($Numeric) {
      $number = 0
      if ([int]::TryParse($box.Text, [ref]$number)) { Send-SettingsPatch (Patch-For $Key $number) }
    } else {
      Send-SettingsPatch (Patch-For $Key ([string]$box.Text))
    }
  })
  $row.Children.Add($box) | Out-Null
  $Panel.Children.Add($row) | Out-Null
  Register-Control $Key $box 'text'
}

function Add-SliderSetting($Panel, [string]$Label, [string]$Key, [double]$Value, [double]$Min, [double]$Max, [double]$Step) {
  $row = New-Object System.Windows.Controls.StackPanel
  $row.Margin = '0,3,0,10'
  $caption = New-Object System.Windows.Controls.TextBlock
  $caption.Text = "$Label  $([int]$Value)"
  $caption.Margin = '0,0,0,3'
  $row.Children.Add($caption) | Out-Null
  $slider = New-Object System.Windows.Controls.Slider
  $slider.Minimum = $Min
  $slider.Maximum = $Max
  $slider.TickFrequency = $Step
  $slider.IsSnapToTickEnabled = $true
  $slider.Value = $Value
  $slider.Width = 360
  $slider.Add_ValueChanged({
    if ($script:SuppressSettings) { return }
    $rounded = [math]::Round($slider.Value)
    $caption.Text = "$Label  $rounded"
    if ($Key -eq 'opacity') { Send-SettingsPatch (Patch-For $Key ($rounded / 100)) }
    else { Send-SettingsPatch (Patch-For $Key $rounded) }
  })
  $row.Children.Add($slider) | Out-Null
  $Panel.Children.Add($row) | Out-Null
  $script:SettingsControls[$Key] = @{ Control = $slider; Kind = 'slider'; Label = $caption; LabelText = $Label }
}

function Add-ComboSetting($Panel, [string]$Label, [string]$Key, $Items, $Value) {
  $row = New-Object System.Windows.Controls.StackPanel
  $row.Orientation = 'Horizontal'
  $row.Margin = '0,3,0,8'
  $caption = New-Object System.Windows.Controls.TextBlock
  $caption.Text = $Label
  $caption.Width = 150
  $caption.VerticalAlignment = 'Center'
  $row.Children.Add($caption) | Out-Null
  $combo = New-Object System.Windows.Controls.ComboBox
  $combo.Width = 180
  $combo.DisplayMemberPath = 'Label'
  $combo.SelectedValuePath = 'Value'
  $combo.ItemsSource = $Items
  foreach ($item in $Items) {
    if ([string]$item.Value -eq [string]$Value) { $combo.SelectedItem = $item; break }
  }
  $combo.Add_SelectionChanged({
    if ($script:SuppressSettings) { return }
    if ($null -ne $combo.SelectedItem) { Send-SettingsPatch (Patch-For $Key ([string]$combo.SelectedItem.Value)) }
  })
  $row.Children.Add($combo) | Out-Null
  $Panel.Children.Add($row) | Out-Null
  Register-Control $Key $combo 'combo'
}

function Add-ActionButton($Panel, [string]$Label, [scriptblock]$OnClick) {
  $button = New-Object System.Windows.Controls.Button
  $button.Content = $Label
  $button.Padding = '10,5'
  $button.Margin = '0,4,0,8'
  $button.HorizontalAlignment = 'Left'
  $button.Add_Click($OnClick)
  $Panel.Children.Add($button) | Out-Null
}

function Build-Settings() {
  $settings = New-Object System.Windows.Window
  $settings.Title = 'DSH Pet 设置'
  $settings.Width = 560
  $settings.Height = 700
  $settings.WindowStartupLocation = 'CenterScreen'
  $settings.ResizeMode = 'NoResize'
  $settings.Topmost = $true
  $settings.ShowInTaskbar = $true

  $tabs = New-Object System.Windows.Controls.TabControl
  $settings.Content = $tabs
  $script:SuppressSettings = $true

  $appearance = New-TabPanel $tabs '外观'
  Add-SectionTitle $appearance '宠物'
  Add-ComboSetting $appearance '皮肤' 'skinId' @(
    [pscustomobject]@{ Label = '小黑'; Value = 'kuro' },
    [pscustomobject]@{ Label = '麻薯'; Value = 'mochi' },
    [pscustomobject]@{ Label = '像素'; Value = 'pixel' }
  ) 'kuro'
  Add-SliderSetting $appearance '大小' 'size' 120 80 200 5
  Add-SliderSetting $appearance '不透明度' 'opacity' 100 30 100 5
  Add-CheckSetting $appearance '显示状态牌' 'showPlaque' $true
  Add-CheckSetting $appearance '显示任务列表' 'showTasks' $true
  Add-CheckSetting $appearance '随机台词' 'randomLines' $true
  Add-TextSetting $appearance '名字（留空用皮肤名）' 'petName' ''
  Add-ComboSetting $appearance '语言' 'language' @(
    [pscustomobject]@{ Label = '跟随 DSH'; Value = 'auto' },
    [pscustomobject]@{ Label = '中文'; Value = 'zh' },
    [pscustomobject]@{ Label = 'English'; Value = 'en' }
  ) 'auto'

  $alerts = New-TabPanel $tabs '提醒'
  Add-CheckSetting $alerts '余额不足提醒' 'alerts.lowBalance' $true
  Add-TextSetting $alerts '低余额阈值' 'alerts.lowBalanceThreshold' '10' $true
  Add-TextSetting $alerts '币种（auto/CNY/USD）' 'alerts.lowBalanceCurrency' 'auto'
  Add-CheckSetting $alerts '上下文占用提醒' 'alerts.context' $true
  Add-TextSetting $alerts '警告阈值（%）' 'alerts.contextWarn' '80' $true
  Add-TextSetting $alerts '危险阈值（%）' 'alerts.contextDanger' '90' $true
  Add-CheckSetting $alerts '轮次完成/失败提醒' 'alerts.completion' $true
  Add-CheckSetting $alerts '后台会话完成提醒' 'alerts.background' $true
  Add-CheckSetting $alerts '等待审批/回答提醒' 'alerts.waiting' $true
  Add-CheckSetting $alerts '系统通知' 'alerts.notifications' $false
  Add-CheckSetting $alerts '提示音' 'alerts.sound' $false

  $focus = New-TabPanel $tabs '专注'
  Add-CheckSetting $focus '启用番茄钟' 'focus.enabled' $true
  Add-TextSetting $focus '专注时长（分钟）' 'focus.focusMinutes' '25' $true
  Add-TextSetting $focus '休息时长（分钟）' 'focus.breakMinutes' '5' $true
  Add-TextSetting $focus '喝水提醒（分钟，0 关闭）' 'focus.waterMinutes' '45' $true
  Add-CheckSetting $focus '专注结束后自动休息' 'focus.autoBreak' $true

  $data = New-TabPanel $tabs '数据'
  Add-CheckSetting $data '记录每日统计' 'stats.enabled' $true
  $script:TodayLabel = New-Object System.Windows.Controls.TextBlock
  $script:TodayLabel.Text = '今日 token：0'
  $script:TodayLabel.Margin = '0,4,0,4'
  $data.Children.Add($script:TodayLabel) | Out-Null
  $script:BalanceLabel = New-Object System.Windows.Controls.TextBlock
  $script:BalanceLabel.Text = '今日余额变化：0'
  $script:BalanceLabel.Margin = '0,0,0,8'
  $data.Children.Add($script:BalanceLabel) | Out-Null
  Add-ActionButton $data '刷新余额' { Send-SettingsAction 'refresh' }
  Add-ActionButton $data '重置今日统计' { Send-SettingsAction 'resetStats' }
  Add-SectionTitle $data '演示状态'
  Add-ActionButton $data '任务执行中' { Send-SettingsAction 'demo' @{ kind = 'tasks' } }
  Add-ActionButton $data '工作中' { Send-SettingsAction 'demo' @{ kind = 'running' } }
  Add-ActionButton $data '等待中' { Send-SettingsAction 'demo' @{ kind = 'waiting' } }
  Add-ActionButton $data '开心' { Send-SettingsAction 'demo' @{ kind = 'happy' } }
  Add-ActionButton $data '难过' { Send-SettingsAction 'demo' @{ kind = 'sad' } }

  $desktop = New-TabPanel $tabs '桌面'
  Add-ComboSetting $desktop '余额刷新间隔' 'account.refreshSeconds' @(
    [pscustomobject]@{ Label = '30 秒'; Value = 30 },
    [pscustomobject]@{ Label = '60 秒'; Value = 60 },
    [pscustomobject]@{ Label = '300 秒'; Value = 300 },
    [pscustomobject]@{ Label = '关闭'; Value = 0 }
  ) 60
  Add-ActionButton $desktop '把宠物移回屏幕右下角' { Set-DefaultPosition; Save-Position }
  Add-ActionButton $desktop '打开 DSH' { Focus-DSH }
  Add-ActionButton $desktop '导出设置' {
    try {
      $dialog = New-Object Microsoft.Win32.SaveFileDialog
      $dialog.Filter = 'JSON|*.json'
      $dialog.FileName = 'dsh-pet-settings.json'
      if ($dialog.ShowDialog() -eq $true -and $null -ne $script:LastState) {
        $script:LastState.prefs | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $dialog.FileName -Encoding UTF8
      }
    } catch { }
  }
  Add-ActionButton $desktop '导入设置' {
    try {
      $dialog = New-Object Microsoft.Win32.OpenFileDialog
      $dialog.Filter = 'JSON|*.json'
      if ($dialog.ShowDialog() -eq $true) {
        $value = Get-Content -LiteralPath $dialog.FileName -Raw | ConvertFrom-Json
        Send-SettingsPatch $value
        if ($null -ne $script:LastState) { Update-SettingsUI $value }
      }
    } catch { }
  }

  $settings.Add_Closed({ $script:SettingsWindow = $null })
  $script:SettingsWindow = $settings
  $script:SuppressSettings = $false
}

function Update-SettingsUI($Prefs) {
  if ($null -eq $Prefs) { return }
  $script:SuppressSettings = $true
  foreach ($key in $script:SettingsControls.Keys) {
    $entry = $script:SettingsControls[$key]
    $value = Get-PrefValue $Prefs $key
    if ($null -eq $value) { continue }
    if ($entry.Kind -eq 'check') {
      $entry.Control.IsChecked = [bool]$value
    } elseif ($entry.Kind -eq 'slider') {
      $sliderValue = [double]$value
      if ($key -eq 'opacity') { $sliderValue = $sliderValue * 100 }
      $entry.Control.Value = $sliderValue
      if ($null -ne $entry.Label) { $entry.Label.Text = "$($entry.LabelText)  $([int]$sliderValue)" }
    } elseif ($entry.Kind -eq 'text') {
      if (-not $entry.Control.IsKeyboardFocusWithin) { $entry.Control.Text = [string]$value }
    } elseif ($entry.Kind -eq 'combo') {
      foreach ($item in $entry.Control.ItemsSource) {
        if ([string]$item.Value -eq [string]$value) { $entry.Control.SelectedItem = $item; break }
      }
    }
  }
  $script:SuppressSettings = $false
}

function Open-Settings() {
  if ($null -eq $script:SettingsWindow) { Build-Settings }
  if ($null -ne $script:LastState -and $null -ne $script:LastState.prefs) {
    Update-SettingsUI $script:LastState.prefs
  }
  $script:SettingsWindow.Show()
  $script:SettingsWindow.Activate() | Out-Null
}

function Build-Tray() {
  try {
    $script:Tray = New-Object System.Windows.Forms.NotifyIcon
    $script:Tray.Icon = [System.Drawing.SystemIcons]::Application
    $script:Tray.Text = 'DSH Pet'
    $script:Tray.Visible = $true
    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $settingsItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $settingsItem.Text = '设置…'
    $settingsItem.Add_Click({ Open-Settings })
    $menu.Items.Add($settingsItem) | Out-Null
    $toggleItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $toggleItem.Text = '显示/隐藏宠物'
    $toggleItem.Add_Click({
      if ($script:Window.Visibility -eq 'Visible') { $script:Window.Hide() }
      else { $script:Window.Show(); $script:Window.Activate() | Out-Null }
    })
    $menu.Items.Add($toggleItem) | Out-Null
    $exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $exitItem.Text = '退出桌面宠物'
    $exitItem.Add_Click({
      $script:Tray.Visible = $false
      $script:Window.Close()
    })
    $menu.Items.Add($exitItem) | Out-Null
    $script:Tray.ContextMenuStrip = $menu
    $script:Tray.Add_DoubleClick({ Open-Settings })
    $script:Window.Add_Closed({
      try { $script:Tray.Visible = $false; $script:Tray.Dispose() } catch { }
    })
  } catch { }
}

try {
  Build-Window
  Build-Tray
  $script:Window.Add_ContentRendered({
    if ($Settings) { Open-Settings }
  })
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
