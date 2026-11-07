Add-Type -AssemblyName System.Windows.Forms
Add-Type -MemberDefinition '[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName); [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);' -Name Win32 -Namespace DshPet -PassThru | Out-Null

$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$left = $area.Right - 440
$top = $area.Bottom - 800
for ($index = 0; $index -lt 20; $index += 1) {
  $handle = [DshPet.Win32]::FindWindow($null, 'DSH Pet')
  if ($handle -ne [IntPtr]::Zero) {
    [DshPet.Win32]::SetWindowPos($handle, [IntPtr](-1), $left, $top, 420, 760, 0x0040) | Out-Null
  }
  Start-Sleep -Milliseconds 400
}
