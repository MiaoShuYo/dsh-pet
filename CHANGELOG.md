# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
