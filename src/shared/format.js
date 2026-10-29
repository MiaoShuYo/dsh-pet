/**
 * Pure formatting helpers. No DOM, no Cordis, no React: importable from Node
 * tests and inlined verbatim into the browser bundle.
 * @module dsh-pet/shared/format
 */

/**
 * Format an integer token count compactly: 999, 1.2K, 12.3K, 1.2M.
 * @param value - raw count.
 * @param digits - decimals for the 1x–9x range.
 * @returns the compact label.
 */
export function formatCompactNumber(value, digits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '0'
  if (number >= 1e9) return trimZero((number / 1e9).toFixed(digits)) + 'B'
  if (number >= 1e6) return trimZero((number / 1e6).toFixed(digits)) + 'M'
  if (number >= 1e4) return trimZero((number / 1e3).toFixed(0)) + 'K'
  if (number >= 1e3) {
    const scaled = number / 1e3
    return trimZero(scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(digits)) + 'K'
  }
  return String(Math.round(number))
}

/**
 * Drop a trailing `.0` / `.00` from a fixed decimal string.
 * @param text - fixed decimal text.
 * @returns trimmed text.
 */
export function trimZero(text) {
  return text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

/**
 * Format a token count with a unit suffix.
 * @param value - raw count.
 * @returns e.g. `12.3K tok`.
 */
export function formatTokens(value) {
  return formatCompactNumber(value) + ' tok'
}

/**
 * Parse a provider balance string (which may include thousands separators).
 * @param value - number or decimal string.
 * @returns finite number, or null.
 */
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

/**
 * Format money with the active locale, falling back to a plain currency label.
 * @param currency - ISO 4217 code.
 * @param amount - number or decimal string.
 * @param locale - BCP 47 locale, optional.
 * @returns formatted money, or an em dash.
 */
export function formatMoney(currency, amount, locale) {
  const number = parseAmount(amount)
  if (number === null) return '\u2014'
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(number)
  } catch (_error) {
    return currency + ' ' + number.toFixed(2)
  }
}

/**
 * Format one percentage with no decimals.
 * @param value - percentage number.
 * @returns `43%`, or an em dash.
 */
export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '\u2014'
  const number = Number(value)
  if (!Number.isFinite(number)) return '\u2014'
  return Math.round(number) + '%'
}

/**
 * Clamp a number into an inclusive range. Non-finite input yields `min`.
 * @param value - candidate.
 * @param min - lower bound.
 * @param max - upper bound.
 * @returns clamped number.
 */
export function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(max, Math.max(min, number))
}

/**
 * Sum the four provider usage buckets.
 * @param usage - token usage projection.
 * @returns total tokens, or 0.
 */
export function totalTokens(usage) {
  if (usage === null || typeof usage !== 'object') return 0
  return (usage.uncachedInputTokens || 0) + (usage.outputTokens || 0)
    + (usage.cacheReadTokens || 0) + (usage.cacheWriteTokens || 0)
}

/**
 * Format a duration as mm:ss.
 * @param milliseconds - remaining duration.
 * @returns `25:00`; clamps negatives to 00:00.
 */
export function formatClock(milliseconds) {
  const total = Math.max(0, Math.ceil(Number(milliseconds) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
}

/**
 * Substitute `{name}` placeholders in a localized template.
 * @param template - dictionary text.
 * @param params - placeholder values.
 * @returns interpolated text.
 */
export function formatTemplate(template, params) {
  if (typeof template !== 'string') return ''
  if (params === null || typeof params !== 'object') return template
  return template.replace(/\{(\w+)\}/g, function replace(_match, name) {
    const value = params[name]
    return value === undefined || value === null ? '{' + name + '}' : String(value)
  })
}

/**
 * Resolve the active UI language from a preference and the DSH locale.
 * @param preference - `auto`, `zh` or `en`.
 * @param active - DSH active locale.
 * @returns `zh` or `en`.
 */
export function resolveLanguage(preference, active) {
  const value = preference === 'zh' || preference === 'en' ? preference : String(active || 'en')
  return value.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
}
