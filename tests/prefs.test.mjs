import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFS, mergePrefs, normalizePrefs, petDisplayName } from '../src/shared/prefs.js'

test('normalizePrefs fills defaults from junk', () => {
  const prefs = normalizePrefs(null)
  assert.equal(prefs.size, DEFAULT_PREFS.size)
  assert.equal(prefs.alerts.contextWarn, 80)
  assert.equal(prefs.alerts.contextDanger, 90)
  assert.equal(prefs.language, 'auto')
  assert.equal(prefs.position.right, 24)
  assert.equal(prefs.account.refreshSeconds, 60)
})

test('normalizePrefs clamps ranges and repairs threshold order', () => {
  const prefs = normalizePrefs({
    size: 1000,
    opacity: 9,
    language: 'xx',
    position: { right: -5, bottom: 'nope' },
    alerts: { contextWarn: 90, contextDanger: 50, lowBalanceThreshold: -3 },
    account: { refreshSeconds: 45 },
    focus: { focusMinutes: 0, breakMinutes: 999, waterMinutes: -1 },
  })
  assert.equal(prefs.size, 200)
  assert.equal(prefs.opacity, 1)
  assert.equal(prefs.language, 'auto')
  assert.equal(prefs.position.right, 0)
  assert.equal(prefs.position.bottom, DEFAULT_PREFS.position.bottom)
  assert.equal(prefs.alerts.contextWarn, 90)
  assert.equal(prefs.alerts.contextDanger, 91)
  assert.equal(prefs.alerts.lowBalanceThreshold, 0)
  assert.equal(prefs.account.refreshSeconds, 60)
  assert.equal(prefs.focus.focusMinutes, 1)
  assert.equal(prefs.focus.breakMinutes, 60)
  assert.equal(prefs.focus.waterMinutes, 0)
})

test('mergePrefs merges nested groups without dropping siblings', () => {
  const base = normalizePrefs(null)
  const next = mergePrefs(base, { alerts: { sound: true }, size: 90 })
  assert.equal(next.alerts.sound, true)
  assert.equal(next.alerts.contextWarn, 80)
  assert.equal(next.size, 90)
  assert.equal(next.focus.focusMinutes, 25)
})

test('mergePrefs ignores a non-object patch', () => {
  const base = normalizePrefs(null)
  assert.deepEqual(mergePrefs(base, null), base)
})

test('petDisplayName prefers the explicit name', () => {
  const prefs = normalizePrefs({ petName: 'Bob' })
  const skin = { name: { en: 'Kuro', zh: '小黑' } }
  assert.equal(petDisplayName(prefs, skin, 'zh'), 'Bob')
  assert.equal(petDisplayName(normalizePrefs(null), skin, 'zh'), '小黑')
  assert.equal(petDisplayName(normalizePrefs(null), null, 'en'), 'DSH Pet')
})
