import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BALANCE_ALERT_COOLDOWN_MS, contextOccupancy, contextTone, decideBalanceAlert, decideContextAlert,
} from '../src/shared/thresholds.js'

test('contextOccupancy prefers projected tokens', () => {
  assert.equal(contextOccupancy({ pressureTokens: 50, projectedTokens: 60, contextWindow: 200 }), 30)
  assert.equal(contextOccupancy({ pressureTokens: 50, contextWindow: 200 }), 25)
  assert.equal(contextOccupancy({ pressureTokens: 50 }), null)
  assert.equal(contextOccupancy({ contextWindow: 0, pressureTokens: 1 }), null)
  assert.equal(contextOccupancy(null), null)
  assert.equal(contextOccupancy({ projectedTokens: 500, contextWindow: 100 }), 100)
})

test('decideContextAlert latches each level once', () => {
  assert.deepEqual(decideContextAlert(50, 'ok', 80, 90), { level: 'ok', alert: null })
  assert.deepEqual(decideContextAlert(82, 'ok', 80, 90), { level: 'warn', alert: 'warn' })
  assert.deepEqual(decideContextAlert(85, 'warn', 80, 90), { level: 'warn', alert: null })
  assert.deepEqual(decideContextAlert(95, 'warn', 80, 90), { level: 'danger', alert: 'danger' })
  assert.deepEqual(decideContextAlert(99, 'danger', 80, 90), { level: 'danger', alert: null })
  assert.deepEqual(decideContextAlert(60, 'danger', 80, 90), { level: 'ok', alert: null })
  assert.deepEqual(decideContextAlert(null, 'warn', 80, 90), { level: 'ok', alert: null })
})

test('decideBalanceAlert honours the threshold and cooldown', () => {
  const now = 1_000_000
  assert.equal(decideBalanceAlert(5, 10, 0, now), true)
  assert.equal(decideBalanceAlert(15, 10, 0, now), false)
  assert.equal(decideBalanceAlert(5, 10, now - 1000, now), false)
  assert.equal(decideBalanceAlert(5, 10, now - BALANCE_ALERT_COOLDOWN_MS - 1, now), true)
  assert.equal(decideBalanceAlert(null, 10, 0, now), false)
  assert.equal(decideBalanceAlert(5, 0, 0, now), false)
})

test('contextTone classifies the ring colour', () => {
  assert.equal(contextTone(null, 80, 90), 'none')
  assert.equal(contextTone(10, 80, 90), 'ok')
  assert.equal(contextTone(80, 80, 90), 'warn')
  assert.equal(contextTone(90, 80, 90), 'danger')
})
