import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addUsage, createStats, dayKey, normalizeStats, observeBalance, recentDays, rollStats,
  todayBalanceDelta, todayTokenTotal,
} from '../src/shared/stats.js'

const NOON = new Date(2026, 9, 30, 12, 0, 0).getTime()
const NEXT_NOON = new Date(2026, 9, 31, 12, 0, 0).getTime()

function usage(input, output, read = 0, write = 0) {
  return { uncachedInputTokens: input, outputTokens: output, cacheReadTokens: read, cacheWriteTokens: write }
}

test('createStats starts empty for today', () => {
  const stats = createStats(NOON)
  assert.equal(stats.today.date, dayKey(NOON))
  assert.equal(todayTokenTotal(stats), 0)
  assert.equal(todayBalanceDelta(stats, 'CNY'), null)
})

test('addUsage seeds a baseline, then accumulates deltas', () => {
  let stats = createStats(NOON)
  stats = addUsage(stats, 's1', usage(100, 20, 10, 5), NOON)
  assert.equal(todayTokenTotal(stats), 0)
  stats = addUsage(stats, 's1', usage(150, 30, 20, 5), NOON)
  assert.deepEqual(stats.today.tokens, usage(50, 10, 10, 0))
  stats = addUsage(stats, 's1', usage(150, 30, 20, 5), NOON)
  assert.equal(todayTokenTotal(stats), 70)
  stats = addUsage(stats, 's2', usage(7, 3), NOON)
  assert.equal(todayTokenTotal(stats), 70)
})

test('a shrinking cumulative total reseeds without subtracting', () => {
  let stats = createStats(NOON)
  stats = addUsage(stats, 's1', usage(100, 50), NOON)
  stats = addUsage(stats, 's1', usage(120, 60), NOON)
  assert.equal(todayTokenTotal(stats), 30)
  stats = addUsage(stats, 's1', usage(10, 5), NOON)
  assert.equal(todayTokenTotal(stats), 30)
  stats = addUsage(stats, 's1', usage(20, 10), NOON)
  assert.equal(todayTokenTotal(stats), 45)
})

test('rollStats archives yesterday and keeps baselines', () => {
  let stats = createStats(NOON)
  stats = addUsage(stats, 's1', usage(100, 0), NOON)
  stats = addUsage(stats, 's1', usage(160, 0), NOON)
  assert.equal(todayTokenTotal(stats), 60)
  const rolled = rollStats(stats, NEXT_NOON)
  assert.equal(rolled.today.date, dayKey(NEXT_NOON))
  assert.equal(todayTokenTotal(rolled), 0)
  assert.equal(rolled.history.length, 1)
  assert.equal(rolled.history[0].tokens.uncachedInputTokens, 60)
  const next = addUsage(rolled, 's1', usage(200, 0), NEXT_NOON)
  assert.equal(todayTokenTotal(next), 40)
})

test('observeBalance records first and last, and the delta', () => {
  let stats = createStats(NOON)
  stats = observeBalance(stats, 'CNY', 50, NOON)
  stats = observeBalance(stats, 'CNY', 42.5, NOON + 1000)
  assert.equal(todayBalanceDelta(stats, 'CNY'), -7.5)
  stats = observeBalance(stats, 'USD', 3, NOON)
  assert.equal(todayBalanceDelta(stats, 'USD'), 0)
  assert.equal(todayBalanceDelta(stats, 'EUR'), null)
})

test('recentDays returns newest first and includes today', () => {
  let stats = createStats(NOON)
  stats = addUsage(stats, 's1', usage(10, 0), NOON)
  stats = addUsage(stats, 's1', usage(20, 0), NOON)
  stats = rollStats(stats, NEXT_NOON)
  const rows = recentDays(stats, 7)
  assert.equal(rows.length, 2)
  assert.equal(rows[rows.length - 1].date, dayKey(NEXT_NOON))
})

test('normalizeStats rejects junk and keeps valid data', () => {
  const fresh = normalizeStats(null, NOON)
  assert.equal(fresh.today.date, dayKey(NOON))
  const restored = normalizeStats({
    version: 1,
    today: { date: dayKey(NOON), tokens: usage(1, 2, 3, 4), balance: { CNY: { first: 10, last: 5 }, EUR: { first: 1, last: 1 } } },
    baselines: { s1: usage(1, 1) },
    history: [{ date: '2026-10-29', tokens: usage(5, 5), balance: {} }, { date: 'bad' }],
  }, NOON)
  assert.deepEqual(restored.today.tokens, usage(1, 2, 3, 4))
  assert.equal(restored.today.balance.CNY.last, 5)
  assert.equal(restored.today.balance.EUR, undefined)
  assert.equal(restored.history.length, 1)
  assert.equal(normalizeStats({ version: 99 }, NOON).version, 1)
})
