# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.9.0] - 2026-11-08

### Added

- The pet task card now watches every session's job roster, not just the
  selected session, so **background tasks** appear live.
- Background tasks show their session title; the task count includes all
  sessions.
- Job watchers are added/removed as the session catalog changes, and every
  completed/started job updates the card immediately.

## [0.8.1] - 2026-11-08

### Changed

- Reworked native window dragging: the helper moves the window and sends
  drag-move/end messages back to the page; the React layer keeps the pet
  anchored during the drag and persists its position on release.
- Panel placement now chooses the side with enough space instead of clipping
  against the window edge.
- Updated the bundled WebView2 SDK binaries.

## [0.8.0] - 2026-11-07

### Changed

- The desktop window is now truly transparent: WPF
  `AllowsTransparency=true` with a transparent window background, a transparent
  WebView2 default background, and a transparent desktop-mode page background.
- Removed the chroma-key capture path; the pet, bubble, plaque and panel no
  longer have a black body behind them.

## [0.7.9] - 2026-11-07

### Fixed

- Replaced the rectangular per-element window region with a **chroma-key
  capture mask**. The desktop page paints its background magenta; the host
  captures the WebView2 surface and builds a native region from every
  non-magenta pixel. The black body and black box behind the bubble/plaque are
  now gone; only the actual UI pixels remain.
- Region construction runs in a small C# helper (GDI region) for speed.

## [0.7.8] - 2026-11-07

### Fixed

- Dragging the pet in the desktop window now moves the **native window** via
  `WebMessage` events instead of changing the pet's internal absolute position.
  Previously the pet could slide outside the window region while moving,
  leaving black areas. Window and region now move together.

## [0.7.7] - 2026-11-07

### Changed

- Removed the dark rectangular window background from the visible result.
  The React layer now reports the pet SVG alpha mask and the plaque, bubble,
  task and settings rectangles; the host applies a Win32 window region so only
  those pixels are visible. The pet now floats without a black frame.
- The window still resizes to the reported UI bounds and stays anchored at the
  bottom-right.

## [0.7.6] - 2026-11-07

### Fixed

- Restored the UTF-8 BOM on `webview-window.ps1`. Without it Windows
  PowerShell 5.1 read the Chinese string `退出` as mojibake, failed with
  `The string is missing the terminator`, and exited before showing the pet.
- The compact window now repositions the pet to its own bottom-right after each
  resize; previously the window shrank but the pet could remain outside the
  clipped bounds, leaving an empty dark card.
- Removed the `desktop-launch` cleanup match so the running helper is not
  killed by stale-window cleanup.

## [0.7.5] - 2026-11-07

### Changed

- The frameless WebView2 window now resizes itself to the actual UI bounds
  reported by the React layer (pet + plaque + task card, or an open settings
  panel), anchored at its bottom-right. This removes the huge 420x760 black
  rectangle; the window stays compact around the visible content.
- Window grows when settings open and shrinks back when it closes.

## [0.7.4] - 2026-11-07

### Fixed

- Removed `/diag`; calling `ctx.connection.authenticatedUrl()` inside an HTTP
  request could crash the DSH Host.
- The authenticated HTTP GUI URL is now resolved **once at plugin startup**,
  after declaring `inject: ['webServer', 'connection']`; request handlers and
  the desktop launcher only read the cached string.
- `/status` reports `guiResolved` without exposing the URL/token.
- This also fixes the desktop pet not opening because the DSH Desktop renderer
  uses `dsh-app://app/`, which is not a WebView2-loadable URL.

## [0.7.3] - 2026-11-07

### Fixed

- Fixed the desktop pet not opening in the **DSH Desktop app**. The renderer
  location is `dsh-app://app/`, which WebView2 cannot load. The host now builds
  the authenticated HTTP URL from `ctx.webServer.getOrigin()` and
  `ctx.connection.authenticatedUrl()` instead of using `location.href`.
- Added `/diag` for checking the resolved WebView2 target without exposing the
  token.

## [0.7.2] - 2026-11-07

### Fixed

- WebView2 assemblies are now copied into a per-process
  `%LOCALAPPDATA%\dsh-pet\webview2\run-<pid>` directory. Restarting the
  desktop window can no longer fail with
  `The process cannot access ... Microsoft.Web.WebView2.Core.dll because it is
  being used by another process.`
- Old per-run DLL directories are cleaned up after a day.

## [0.7.1] - 2026-11-07

### Fixed

- Fixed the desktop launcher showing `{"ok":false,"error":"invalid-target"}`.
  `/desktop-launch` now reads the current GUI URL, session and prefs from the
  host state instead of passing them through the WebView2 launch URL, so URL
  parsing/quoting can no longer corrupt the target.
- The launch URL no longer contains `&`/JSON query fragments.

## [0.7.0] - 2026-11-07

### Changed

- Replaced the Edge application window with a **frameless WPF + WebView2**
  window. Same React UI, no system titlebar.
- Bundled the WebView2 managed/native assemblies; the helper copies them to
  `%LOCALAPPDATA%\dsh-pet\webview2` before loading so the plugin works from a
  network-mapped workspace drive.
- Added a 22px invisible drag strip and a tray menu (show/hide, settings, exit).
- WebView2 content uses the exact DSH pet/settings renderer; DSH chrome remains
  hidden.
- Known limitation: the window is frameless but still opaque (not per-pixel
  transparent/click-through).

## [0.6.0] - 2026-11-07

### Changed

- Replaced the WPF-recreated pet/settings UI with the **exact React UI** running
  in a separate Edge app window. The host opens the DSH Web GUI through a
  loopback wrapper, sets `window.name`, and the client hides the DSH chrome and
  renders the original pet, task card and settings panel.
- The desktop window is launched automatically after the first state push, is
  marked with the current session, set topmost, and double-click focuses the
  main DSH window.
- Removed the old in-app rendering path; the normal DSH page is headless.
- Settings, skins, alerts, focus and data screens are now pixel-identical to
  the in-app React panel.

## [0.5.2] - 2026-11-01

### Changed

- Added a custom dark TabItem template so the selected settings tab no longer
  shows the default white WPF header. The settings surface now matches the
  dark in-app panel: rounded tabs, dark inputs, status rows and footer.
- Settings footer defaults to the current version.

## [0.5.1] - 2026-11-01

### Changed

- Restyled the native settings window to match the dark in-app pet UI: custom
  header/subtitle, dark tabs and controls, footer with version.
- Added the **状态** tab: balance, bonus, last refresh, current session, state,
  token buckets and context.
- State payload now carries account/session/token details for the status tab.
- Guarded settings-window close/drag handlers.

## [0.5.0] - 2026-11-01

### Changed

- Removed the in-app pet and settings panel entirely; the Web Client slot is
  now headless and only forwards session status. The pet exists only in the
  Windows companion window.
- The host auto-starts the companion; no in-app "open desktop window" switch.
- Added a native settings window with Appearance, Alerts, Focus, Data and
  Desktop tabs, backed by a loopback settings/action queue.
- **Double-click the pet opens/focuses DSH.**
- Added a tray icon: settings, show/hide the pet, exit.
- Main window applies size, opacity and plaque/task visibility from settings.

## [0.4.0] - 2026-11-01

### Added

- Optional **Windows desktop companion**: a separate transparent, borderless,
  always-on-top WPF window that can be dragged anywhere on the desktop,
  including outside the DSH window. It shows the pet, the live task card and a
  compact balance/token/context plaque, with a working bounce animation.
- A loopback bridge in the host half (`127.0.0.1:45873`) carries state from the
  Web Client to the companion and starts/stops the PowerShell helper.
- **Look → Desktop window** opens or closes the companion; the in-app pet
  collapses to a paw handle while the desktop window is active, and returns
  automatically when the companion closes.
- Original transparent PNG state assets for the three built-in skins.

### Notes

- The desktop companion is Windows-only. macOS and Linux keep the in-app pet.
- It is a separate window, not an OS-level click-through overlay; the whole
  window rectangle captures pointer input.

## [0.3.2] - 2026-11-01

### Fixed

- Portal the pet layer to `document.body` and raise its stacking level to the
  maximum. DSH chat cards, side panels and other in-page stacking contexts can
  no longer cover or clip the pet. The pet still lives inside the DSH window;
  window bounds remain the hard limit.

## [0.3.1] - 2026-11-01

### Fixed

- The task list now also consumes the current session event feed. Synchronous
  `tool/call` entries appear immediately, with their `description` (or first
  command line) as the title, and disappear on `tool/result` or `turn/end`.
  The previous implementation watched only `ctx.jobs`, so ordinary running
  commands (which are tool calls, not durable jobs) were invisible.

## [0.3.0] - 2026-11-01

### Changed

- Pet positions are now stored in **desktop screen coordinates**, not window
  coordinates. Moving the DSH window no longer moves the pet; it keeps the spot
  where the user put it while the window still covers that spot.
- Dragging is clamped to the visible window; the frame watcher translates the
  saved screen anchor back into viewport `left/top` every frame.
- Legacy `{ right, bottom }` settings migrate once at startup.
- If the DSH window is moved completely away from the pet, a paw handle appears
  at the window edge; clicking it brings the pet back to the current corner.

## [0.2.0] - 2026-11-01

### Added

- Live task list above the pet: watches the current session's `ctx.jobs`
  roster and shows running/stopping jobs with their progress line.
- Busy mascot pose: a small laptop, `^^` eyes, a bouncing work animation and a
  blinking terminal prompt; the pet switches to it whenever a task is running.
- Demo state **Tasks running** and a **Show task list** appearance toggle.
- Verified against DSH 0.2.1-rc.5.

## [0.1.0] - 2026-10-30

### Added

- In-app floating pet in the Web Client `shell.overlay` layer: draggable,
  collapsible, hideable, keyboard accessible, viewport-clamped and persistent.
- Account balance from the existing `account/getState` and `account/getBalance`
  Remotes, with wallets and bonus wallets.
- Session token totals and breakdowns from the `tokenUsage` and
  `contextBreakdown` projections; context occupancy from `contextPressure`.
- Low-balance, context 80%/90%, turn completion/failure, background completion,
  and waiting-for-approval/question bubbles.
- Optional OS notifications and WebAudio chimes.
- Quick menu on the plaque for top-up, usage, refresh, copy, settings and hide.
- Daily token/balance statistics in `localStorage` (60 days), copyable summary.
- Pomodoro focus/break timer and water reminders with absolute deadlines.
- Three original vector skins plus import/export of image skin packs and
  settings, with strict validation.
- Chinese and English dictionaries, DSH light/dark theme support, reduced-motion
  handling.
- GitHub-ready repository: zero-dependency build/check scripts, unit and bundle
  smoke tests, CI, release tarball, GitHub Pages market index and landing page.
