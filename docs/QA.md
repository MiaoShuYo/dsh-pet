# Manual QA

Run `npm run check && npm test` first. Then install the plugin into a disposable
profile and verify the matrix below. Use **Data → Demo state** to simulate
conditions without spending tokens or changing the account.

## Setup

```bash
# from this repository
dsh plugin --profile pet-qa add ./
dsh --profile pet-qa
```

The pet appears in the bottom-right corner on top of the conversation. If it
does not, open the browser console and check the plugin load report, then
restart the Host (Host modules are cached).

## Matrix

| Area | Steps | Expected |
|---|---|---|
| First run | Open a conversation | Pet appears bottom-right; plaque shows balance or `—`, session tokens, context ring. |
| No session | Open the home screen / close all sessions | Plaque shows `—`; pet stays idle; panel status explains no session. |
| Signed out | Sign out of the account in Settings | Balance shows `—`/未登录; no balance feed errors; quick links still work. |
| Balance | Open panel → Status → Refresh | Balance appears; last-refresh time updates; wallets and bonus wallets are listed. |
| Tokens | Send one prompt | Session token total grows; four buckets and system/tools/message breakdown match the host projections. |
| Context | Force long context or use demo `Context 90%` | Ring turns orange/red; one 80% and one 90% bubble per session; bubble does not repeat until the level resets. |
| Tasks | Run a background command, then use demo `Tasks running` to preview | Pet shows a task card with label + progress and the laptop busy pose; stopping jobs read `Stopping`; the card disappears when no live jobs remain; the Look toggle hides it without changing the busy state. |
| Low balance | Panel → Alerts → threshold above current balance; wait or refresh | Balance bubble appears once; clicking opens the top-up page; raising the threshold resets the latch. |
| Turn done | Let a turn finish | `happy` state and completion bubble; optional chime if sound is on. |
| Turn error | Force a model error | `sad` state and error bubble. |
| Background done | Run a second session in another tab; finish it | Background completion bubble names that session; clicking jumps to it. |
| Waiting | Trigger an approval or an AskUserQuestion | `waiting` state with `!`; sticky bubble until the request is answered; clicking opens the session. |
| Drag | Drag the pet around, reload | Position follows the pointer, clamps to the viewport, survives reload and resize. |
| Hide/show | Panel → Look → Hide pet | Pet collapses to a paw handle at the edge; clicking restores it. |
| Panel | Double-click, right-click, click plaque | Panel opens beside the pet, flips at screen edges, closes on Escape/outside click. |
| Themes | Switch DSH light/dark | Surfaces, text and ring remain readable; no hard-coded white panels in dark mode. |
| Narrow window | Resize to < 760 px wide | Pet shrinks; panel stays inside the viewport and scrolls; plaque does not overflow. |
| Reduced motion | Enable OS reduce-motion | Idle/working animations stop; state colours and bubbles remain. |
| Skins | Switch built-ins | Each skin renders in all states; no layout shift. |
| Skin import | Import a valid pack | Pack appears in the grid, becomes active, persists after reload. |
| Skin rejection | Import SVG data URL, `javascript:`, >512KB image, bad id, built-in id | Rejected with a specific message; active skin unchanged. |
| Export | Export the active custom skin, re-import it | Round-trips; same id updates the existing pack. |
| Settings export/import | Export settings, change language/size, import | Preferences and custom skins restore; stats are not part of the export. |
| Stats | Send prompts, observe today, reload | Today's tokens/balance change persist; last-7-days list is newest first; clear resets. |
| Notification | Enable notifications, allow permission, hide the tab, finish a turn | One OS notification; click focuses the page and opens the session. Denying permission shows an in-app note and does not break bubbles. |
| Sound | Enable sound, finish a turn / focus timer | Short chime; no audio errors when the tab has never been clicked (gesture policy). |
| Focus | Start 1-minute focus (set minutes to 1) | Pet focuses, countdown matches; pause/resume keeps remaining; completion starts break if enabled. |
| Water | Set water to 1 minute and wait | One bubble; interval resets; 0 disables it. |
| Teardown | Disable the plugin / remove it / reload | No duplicate pet, no leftover style tag, no console errors; timers stop. |
| Storage failure | Block localStorage for the origin | Pet still works in memory; no crash; a panel note may appear. |
| Disconnect | Stop the Host and reopen the page | Last known balance is shown; pet recovers after reconnect without duplicate bubbles. |

## Automated coverage

- `tests/*.test.mjs` — formatting, thresholds, geometry, preferences, skin
  validation, stats folds, pomodoro, bubble priority, store transitions and a
  built-bundle smoke render of every panel tab.
- `node scripts/check.mjs` — manifest, version sync, syntax, bundle freshness
  and wrapper invariants.

Report a failing row with the plugin version, DSH version, OS, and whether the
account was signed in.
