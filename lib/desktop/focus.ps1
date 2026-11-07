$shell = New-Object -ComObject WScript.Shell
Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like '*DeepSeek*' -or $_.MainWindowTitle -like '*DeepSeek*')
} | ForEach-Object {
  try { $shell.AppActivate($_.Id) | Out-Null } catch { }
}
