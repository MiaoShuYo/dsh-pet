# Manual QA

Run `npm run check && npm test` first. Then install the plugin into a disposable
Windows DSH desktop profile and verify the matrix below. The pet is a native
WPF companion now; it should not render inside the DSH page.

## Setup

1. Install the plugin and restart DSH completely.
2. Confirm the Host log contains `[dsh-pet] desktop bridge on http://127.0.0.1:45873`.
3. Confirm `%LOCALAPPDATA%\dsh-pet\last-error.txt` does not exist after startup.

## Matrix

| Area | Steps | Expected |
|---|---|---|
| First run | Restart DSH | A transparent, borderless, always-on-top pet appears at the bottom-right; no in-app pet is rendered. |
| No session | Open the home screen / close all sessions | Plaque shows `DSH Pet` or account-only data; pet stays idle. |
| Signed out | Sign out in DSH settings | Balance shows the account-unavailable state; no crash. |
| Tokens | Send one prompt | Plaque token total grows; task card reflects live work. |
| Tasks | Run a command/tool call, or Settings → Data → 任务执行中 | Task card shows the tool `description` or first command line + “正在运行命令”; it disappears on result/turn end. |
| Drag | Drag the pet around, restart DSH | Position follows the pointer and persists in `%LOCALAPPDATA%\dsh-pet\window.json`; restart restores it. |
| Double-click | Double-click the pet | DSH window is focused/opened. |
| Settings | Right-click pet → 设置, or tray → 设置 | Native settings opens with 外观/提醒/专注/数据/桌面 tabs and current values. |
| Appearance | Change skin, size, opacity, plaque/task toggles | Pet window updates immediately and changes survive restart. |
| Settings write-through | Change size/showPlaque; wait one poll | The client applies the patch; the native window and next restart keep the values. |
| Alerts | Change thresholds/toggles, click 导入/导出设置 | Values round-trip through the settings bridge; import replaces preferences. |
| Focus/Data | Change focus minutes; click 重置今日统计 / 刷新余额 / demos | Actions run in the client store; stats reset/refresh and demo state appear in the pet. |
| Tray | Right-click tray | 设置 / 显示隐藏宠物 / 退出 work; hide leaves the process alive. |
| Close | Tray → 退出桌面宠物, restart DSH | Pet disappears; restarting DSH auto-starts a new companion. |
| Window bounds | Move pet to another monitor and outside DSH | Pet stays at its screen position; it is a separate topmost window and is not clipped by DSH. |
| DPI | Run at 100% and 150% Windows scaling | Pet opens on-screen at the bottom-right in both; position remains usable. |
| Teardown | Disable/remove plugin, restart DSH | Companion process exits; no tray icon, no orphan PowerShell. |
| Failure | Rename/block `pet-window.ps1` and restart | No crash; settings unavailable; inspect `%LOCALAPPDATA%\dsh-pet\last-error.txt`. |

## Automated coverage

- `tests/*.test.mjs` — formatting, thresholds, geometry, preferences, skin
  validation, stats folds, pomodoro, bubble priority, task projection, store
  transitions, desktop settings patch application and a headless bundle smoke
  test.
- `node scripts/check.mjs` — manifest, version sync, syntax, bundle freshness
  and wrapper invariants.

Report a failing row with the plugin version, DSH version, Windows version,
scaling and whether the account was signed in.
