import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clamp, formatClock, formatCompactNumber, formatMoney, formatPercent, formatTemplate, formatTokens,
  parseAmount, resolveLanguage, totalTokens, trimZero,
} from '../src/shared/format.js'

test('formatCompactNumber keeps small counts and compacts large ones', () => {
  assert.equal(formatCompactNumber(0), '0')
  assert.equal(formatCompactNumber(7), '7')
  assert.equal(formatCompactNumber(999), '999')
  assert.equal(formatCompactNumber(1000), '1K')
  assert.equal(formatCompactNumber(1234), '1.2K')
  assert.equal(formatCompactNumber(12345), '12K')
  assert.equal(formatCompactNumber(1234567), '1.2M')
  assert.equal(formatCompactNumber(2e9), '2B')
  assert.equal(formatCompactNumber(-4), '0')
})

test('trimZero removes only trailing zeros', () => {
  assert.equal(trimZero('1.0'), '1')
  assert.equal(trimZero('1.20'), '1.2')
  assert.equal(trimZero('1.25'), '1.25')
  assert.equal(trimZero('10'), '10')
})

test('formatTokens adds the unit', () => {
  assert.equal(formatTokens(12345), '12K tok')
  assert.equal(formatTokens(0), '0 tok')
})

test('parseAmount accepts separators and rejects junk', () => {
  assert.equal(parseAmount('1,234.50'), 1234.5)
  assert.equal(parseAmount('0'), 0)
  assert.equal(parseAmount(''), null)
  assert.equal(parseAmount('abc'), null)
  assert.equal(parseAmount(null), null)
})

test('formatMoney uses the currency and falls back safely', () => {
  assert.match(formatMoney('CNY', '12.3', 'zh-CN'), /12\.3/)
  assert.equal(formatMoney('CNY', 'oops'), '\u2014')
  assert.match(formatMoney('USD', 3, 'en-US'), /3/)
})

test('formatPercent rounds and guards non-finite values', () => {
  assert.equal(formatPercent(42.6), '43%')
  assert.equal(formatPercent(null), '\u2014')
})

test('clamp guards non-finite input', () => {
  assert.equal(clamp(5, 0, 10), 5)
  assert.equal(clamp(-1, 0, 10), 0)
  assert.equal(clamp(11, 0, 10), 10)
  assert.equal(clamp('nope', 2, 10), 2)
})

test('totalTokens sums all four buckets', () => {
  assert.equal(totalTokens({ uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 }), 10)
  assert.equal(totalTokens(null), 0)
})

test('formatClock formats remaining duration', () => {
  assert.equal(formatClock(0), '00:00')
  assert.equal(formatClock(1500 * 1000), '25:00')
  assert.equal(formatClock(61_000), '01:01')
  assert.equal(formatClock(-10), '00:00')
})

test('formatTemplate replaces known placeholders', () => {
  assert.equal(formatTemplate('hi {name}, {count} left', { name: 'Kuro', count: 3 }), 'hi Kuro, 3 left')
  assert.equal(formatTemplate('hi {name}', {}), 'hi {name}')
  assert.equal(formatTemplate(null, {}), '')
})

test('resolveLanguage follows the override and the DSH locale', () => {
  assert.equal(resolveLanguage('zh', 'en-US'), 'zh')
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en')
  assert.equal(resolveLanguage('auto', 'zh-TW'), 'zh')
  assert.equal(resolveLanguage('auto', 'fr-FR'), 'en')
  assert.equal(resolveLanguage('auto', ''), 'en')
})
