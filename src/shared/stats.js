/**
 * Durable daily statistics: provider token buckets per day and balance
 * first/last observations. Pure and immutable so tests can drive it with a
 * fixed clock.
 * @module dsh-pet/shared/stats
 */

/** Current stats schema version. */
export const STATS_VERSION = 1

/** Days kept in history. */
export const MAX_STATS_DAYS = 60

/**
 * Local calendar day key (YYYY-MM-DD), not UTC.
 * @param now - epoch ms.
 * @returns day key.
 */
export function dayKey(now) {
  const date = new Date(now)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return date.getFullYear() + '-' + month + '-' + day
}

/**
 * An empty four-bucket token usage object.
 * @returns zeroed buckets.
 */
export function createBuckets() {
  return { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
}

/**
 * Normalize a raw bucket object.
 * @param raw - candidate.
 * @returns non-negative integer buckets.
 */
export function normalizeBuckets(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    uncachedInputTokens: nonNegative(source.uncachedInputTokens),
    outputTokens: nonNegative(source.outputTokens),
    cacheReadTokens: nonNegative(source.cacheReadTokens),
    cacheWriteTokens: nonNegative(source.cacheWriteTokens),
  }
}

/**
 * Convert any finite value into a non-negative integer.
 * @param value - candidate.
 * @returns count.
 */
function nonNegative(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 0
  return Math.round(number)
}

/**
 * Fresh statistics.
 * @param now - epoch ms.
 * @returns empty stats document.
 */
export function createStats(now) {
  return {
    version: STATS_VERSION,
    today: { date: dayKey(now), tokens: createBuckets(), balance: {} },
    baselines: {},
    history: [],
  }
}

/**
 * Deep-copy the mutable parts before editing.
 * @param stats - current stats.
 * @returns a copy.
 */
function copyStats(stats) {
  const balance = {}
  if (stats.today.balance !== null && typeof stats.today.balance === 'object') {
    for (const [currency, value] of Object.entries(stats.today.balance)) {
      if (value !== null && typeof value === 'object') {
        balance[currency] = { first: Number(value.first) || 0, last: Number(value.last) || 0 }
      }
    }
  }
  return {
    version: STATS_VERSION,
    today: { date: stats.today.date, tokens: { ...stats.today.tokens }, balance },
    baselines: { ...stats.baselines },
    history: stats.history.slice(),
  }
}

/**
 * Validate a stored stats document, preserving valid buckets and history.
 * @param raw - parsed localStorage value.
 * @param now - epoch ms used for a fresh document.
 * @returns a usable stats document.
 */
export function normalizeStats(raw, now) {
  if (raw === null || typeof raw !== 'object' || raw.version !== STATS_VERSION) return createStats(now)
  const fresh = createStats(now)
  const date = typeof raw.today?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.today.date)
    ? raw.today.date
    : fresh.today.date
  const balance = {}
  if (raw.today?.balance !== null && typeof raw.today?.balance === 'object') {
    for (const [currency, value] of Object.entries(raw.today.balance)) {
      if (currency !== 'CNY' && currency !== 'USD') continue
      if (value === null || typeof value !== 'object') continue
      balance[currency] = { first: Number(value.first) || 0, last: Number(value.last) || 0 }
    }
  }
  const baselines = {}
  if (raw.baselines !== null && typeof raw.baselines === 'object') {
    for (const [sessionId, value] of Object.entries(raw.baselines)) {
      if (typeof sessionId !== 'string') continue
      baselines[sessionId] = normalizeBuckets(value)
    }
  }
  const history = []
  if (Array.isArray(raw.history)) {
    for (const item of raw.history.slice(-MAX_STATS_DAYS)) {
      if (item === null || typeof item !== 'object') continue
      if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) continue
      const dayBalance = {}
      if (item.balance !== null && typeof item.balance === 'object') {
        for (const [currency, value] of Object.entries(item.balance)) {
          if (value === null || typeof value !== 'object') continue
          dayBalance[currency] = { first: Number(value.first) || 0, last: Number(value.last) || 0 }
        }
      }
      history.push({ date: item.date, tokens: normalizeBuckets(item.tokens), balance: dayBalance })
    }
  }
  return { version: STATS_VERSION, today: { date, tokens: normalizeBuckets(raw.today?.tokens), balance }, baselines, history }
}

/**
 * Archive yesterday and start a new day, keeping baselines so post-midnight
 * deltas are still counted correctly.
 * @param stats - current stats.
 * @param now - epoch ms.
 * @returns stats for today.
 */
export function rollStats(stats, now) {
  const date = dayKey(now)
  if (stats.today.date === date) return stats
  const history = stats.history.concat([{
    date: stats.today.date,
    tokens: { ...stats.today.tokens },
    balance: stats.today.balance,
  }]).slice(-MAX_STATS_DAYS)
  return {
    version: STATS_VERSION,
    today: { date, tokens: createBuckets(), balance: {} },
    baselines: { ...stats.baselines },
    history,
  }
}

/**
 * Add the provider-reported delta for one session to today's totals.
 *
 * The projection is cumulative, so a per-session baseline turns it into a
 * delta. A first observation only seeds the baseline; a shrinking total (for
 * example a different log) reseeds without subtracting.
 * @param stats - current stats.
 * @param sessionId - session identity.
 * @param usage - `tokenUsage` projection.
 * @param now - epoch ms.
 * @returns new stats.
 */
export function addUsage(stats, sessionId, usage, now) {
  if (usage === null || typeof usage !== 'object') return stats
  const current = normalizeBuckets(usage)
  const next = copyStats(rollStats(stats, now))
  const previous = next.baselines[sessionId]
  if (previous === undefined) {
    next.baselines[sessionId] = current
    return next
  }
  const delta = {
    uncachedInputTokens: Math.max(0, current.uncachedInputTokens - previous.uncachedInputTokens),
    outputTokens: Math.max(0, current.outputTokens - previous.outputTokens),
    cacheReadTokens: Math.max(0, current.cacheReadTokens - previous.cacheReadTokens),
    cacheWriteTokens: Math.max(0, current.cacheWriteTokens - previous.cacheWriteTokens),
  }
  if (delta.uncachedInputTokens === 0 && delta.outputTokens === 0
    && delta.cacheReadTokens === 0 && delta.cacheWriteTokens === 0) {
    if (sameBuckets(previous, current)) return next
    next.baselines[sessionId] = current
    return next
  }
  next.today.tokens = {
    uncachedInputTokens: next.today.tokens.uncachedInputTokens + delta.uncachedInputTokens,
    outputTokens: next.today.tokens.outputTokens + delta.outputTokens,
    cacheReadTokens: next.today.tokens.cacheReadTokens + delta.cacheReadTokens,
    cacheWriteTokens: next.today.tokens.cacheWriteTokens + delta.cacheWriteTokens,
  }
  next.baselines[sessionId] = current
  return next
}

/**
 * Compare two bucket objects.
 * @param left - buckets.
 * @param right - buckets.
 * @returns whether every count matches.
 */
export function sameBuckets(left, right) {
  return left.uncachedInputTokens === right.uncachedInputTokens
    && left.outputTokens === right.outputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
}

/**
 * Record one balance observation for today.
 * @param stats - current stats.
 * @param currency - CNY or USD.
 * @param amount - balance number.
 * @param now - epoch ms.
 * @returns new stats.
 */
export function observeBalance(stats, currency, amount, now) {
  if (currency !== 'CNY' && currency !== 'USD') return stats
  if (amount === null || !Number.isFinite(amount)) return stats
  const next = copyStats(rollStats(stats, now))
  const previous = next.today.balance[currency]
  next.today.balance[currency] = previous === undefined
    ? { first: amount, last: amount }
    : { first: previous.first, last: amount }
  return next
}

/**
 * Today's balance movement for one currency.
 * @param stats - stats.
 * @param currency - CNY or USD.
 * @returns last - first, or null when unobserved.
 */
export function todayBalanceDelta(stats, currency) {
  const value = stats.today.balance[currency]
  if (value === undefined) return null
  return value.last - value.first
}

/**
 * Total tokens counted today.
 * @param stats - stats.
 * @returns sum of the four buckets.
 */
export function todayTokenTotal(stats) {
  const tokens = stats.today.tokens
  return tokens.uncachedInputTokens + tokens.outputTokens + tokens.cacheReadTokens + tokens.cacheWriteTokens
}

/**
 * The last N days for the panel, newest first, including today.
 * @param stats - stats.
 * @param limit - number of days.
 * @returns day rows.
 */
export function recentDays(stats, limit = 7) {
  const rows = []
  for (let index = stats.history.length - 1; index >= 0 && rows.length < limit - 1; index -= 1) {
    rows.push(stats.history[index])
  }
  rows.push({ date: stats.today.date, tokens: stats.today.tokens, balance: stats.today.balance })
  return rows
}
