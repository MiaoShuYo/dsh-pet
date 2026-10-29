# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
- Daily token/balance statistics in `localStorage` (60 days), copyable summary.
- Pomodoro focus/break timer and water reminders with absolute deadlines.
- Three original vector skins plus import/export of image skin packs and
  settings, with strict validation.
- Chinese and English dictionaries, DSH light/dark theme support, reduced-motion
  handling.
- GitHub-ready repository: zero-dependency build/check scripts, unit and bundle
  smoke tests, CI, release tarball, GitHub Pages market index and landing page.
