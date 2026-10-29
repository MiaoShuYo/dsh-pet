/**
 * Pomodoro / focus-session state machine. Time is always derived from an
 * absolute `endsAt` deadline, so background timer throttling cannot drift.
 * @module dsh-pet/shared/pomodoro
 */

/**
 * A fresh, idle focus state.
 * @returns idle state.
 */
export function createFocusState() {
  return { phase: 'idle', endsAt: 0, remainingMs: 0, paused: false }
}

/**
 * Reset back to idle.
 * @returns idle state.
 */
export function resetFocus() {
  return createFocusState()
}

/**
 * Start a focus or break phase.
 * @param phase - `focus` or `break`.
 * @param minutes - duration in minutes.
 * @param now - epoch ms.
 * @returns running state.
 */
export function startFocus(phase, minutes, now) {
  const duration = Math.max(1, Math.round(Number(minutes) || 1)) * 60 * 1000
  return { phase, endsAt: now + duration, remainingMs: duration, paused: false }
}

/**
 * Pause a running phase.
 * @param state - current state.
 * @param now - epoch ms.
 * @returns paused state, or the same state when idle/already paused.
 */
export function pauseFocus(state, now) {
  if (state.phase === 'idle' || state.paused) return state
  return { ...state, remainingMs: Math.max(0, state.endsAt - now), endsAt: 0, paused: true }
}

/**
 * Resume a paused phase.
 * @param state - current state.
 * @param now - epoch ms.
 * @returns running state, or the same state when not paused.
 */
export function resumeFocus(state, now) {
  if (state.phase === 'idle' || !state.paused) return state
  return { ...state, endsAt: now + state.remainingMs, paused: false }
}

/**
 * Remaining milliseconds at a given time.
 * @param state - current state.
 * @param now - epoch ms.
 * @returns non-negative remaining time.
 */
export function focusRemaining(state, now) {
  if (state.phase === 'idle') return 0
  if (state.paused) return Math.max(0, state.remainingMs)
  return Math.max(0, state.endsAt - now)
}

/**
 * Advance the clock. Returns a completed phase exactly once when the deadline
 * has passed; the store decides whether to start the break automatically.
 * @param state - current state.
 * @param now - epoch ms.
 * @returns the next state and a completed phase (or null).
 */
export function tickFocus(state, now) {
  if (state.phase === 'idle' || state.paused) return { state, completed: null }
  if (now < state.endsAt) return { state, completed: null }
  return { state: createFocusState(), completed: state.phase }
}

/**
 * Format the focus phase as a short label key.
 * @param phase - phase.
 * @returns dictionary key.
 */
export function focusPhaseKey(phase) {
  if (phase === 'focus') return 'focus.running'
  if (phase === 'break') return 'focus.breaking'
  return 'focus.idle'
}
