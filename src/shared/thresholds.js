/**
 * Alert decision helpers. They are pure so the latch rules can be unit-tested
 * without timers or a DOM.
 * @module dsh-pet/shared/thresholds
 */
import { clamp } from './format.js'

/** Default cooldown between two low-balance bubbles. */
export const BALANCE_ALERT_COOLDOWN_MS = 30 * 60 * 1000

/**
 * Compute context-window occupancy as a 0–100 percentage.
 * `projectedTokens` (today's estimate for the next request) wins over the last
 * provider-reported `pressureTokens`.
 * @param pressure - `contextPressure` projection value.
 * @returns percentage, or null when either side is missing.
 */
export function contextOccupancy(pressure) {
  if (pressure === null || typeof pressure !== 'object') return null
  const contextWindow = Number(pressure.contextWindow)
  const used = Number(pressure.projectedTokens !== undefined ? pressure.projectedTokens : pressure.pressureTokens)
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return null
  if (!Number.isFinite(used)) return null
  return clamp(used / contextWindow * 100, 0, 100)
}

/**
 * Decide whether a new occupancy level deserves an alert.
 *
 * The caller stores `level` per session. A level only moves forward while the
 * value climbs; dropping below the warning threshold resets it to `ok`, so a
 * later climb can alert again.
 * @param percent - current occupancy, or null.
 * @param previousLevel - `ok`, `warn` or `danger`.
 * @param warn - warning threshold percentage.
 * @param danger - danger threshold percentage.
 * @returns the level to store and an optional alert kind.
 */
export function decideContextAlert(percent, previousLevel, warn, danger) {
  if (percent === null || !Number.isFinite(percent)) return { level: 'ok', alert: null }
  if (percent >= danger) {
    return { level: 'danger', alert: previousLevel === 'danger' ? null : 'danger' }
  }
  if (percent >= warn) {
    const already = previousLevel === 'warn' || previousLevel === 'danger'
    return { level: 'warn', alert: already ? null : 'warn' }
  }
  return { level: 'ok', alert: null }
}

/**
 * Decide whether a low-balance bubble should fire now.
 * @param balance - current primary balance, or null.
 * @param threshold - configured threshold; null/<=0 disables.
 * @param lastAlertAt - epoch ms of the previous alert, 0 when none.
 * @param now - current epoch ms.
 * @param cooldown - minimum gap between alerts.
 * @returns whether to fire.
 */
export function decideBalanceAlert(balance, threshold, lastAlertAt, now, cooldown = BALANCE_ALERT_COOLDOWN_MS) {
  if (balance === null || !Number.isFinite(balance)) return false
  if (threshold === null || !Number.isFinite(threshold) || threshold <= 0) return false
  if (balance >= threshold) return false
  if (lastAlertAt > 0 && now - lastAlertAt < cooldown) return false
  return true
}

/**
 * Classify an occupancy percentage for CSS and labels.
 * @param percent - occupancy, or null.
 * @param warn - warning threshold.
 * @param danger - danger threshold.
 * @returns `ok`, `warn`, `danger` or `none`.
 */
export function contextTone(percent, warn, danger) {
  if (percent === null) return 'none'
  if (percent >= danger) return 'danger'
  if (percent >= warn) return 'warn'
  return 'ok'
}
