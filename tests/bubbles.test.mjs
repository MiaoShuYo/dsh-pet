import test from 'node:test'
import assert from 'node:assert/strict'
import { bubbleRank, isBubbleExpired, makeBubble, shouldReplaceBubble } from '../src/shared/bubbles.js'

function bubble(tone, seq, extra = {}) {
  return makeBubble({ seq, tone, key: 'k' + seq, now: 1000, ttlMs: 5000, ...extra })
}

test('ranks order the tones', () => {
  assert.ok(bubbleRank('waiting') > bubbleRank('danger'))
  assert.ok(bubbleRank('danger') > bubbleRank('completion'))
  assert.ok(bubbleRank('completion') > bubbleRank('idle'))
  assert.equal(bubbleRank('nope'), bubbleRank('idle'))
})

test('a higher tone replaces a lower one', () => {
  assert.equal(shouldReplaceBubble(bubble('completion', 1), bubble('danger', 2)), true)
  assert.equal(shouldReplaceBubble(bubble('danger', 1), bubble('completion', 2)), false)
})

test('same tone is last-write-wins', () => {
  assert.equal(shouldReplaceBubble(bubble('completion', 1), bubble('completion', 2)), true)
  assert.equal(shouldReplaceBubble(bubble('completion', 2), bubble('completion', 1)), false)
})

test('a sticky waiting bubble survives lower tones but can be replaced by another waiting', () => {
  const waiting = bubble('waiting', 1, { sticky: true })
  assert.equal(shouldReplaceBubble(waiting, bubble('danger', 2)), false)
  assert.equal(shouldReplaceBubble(waiting, bubble('waiting', 3, { sticky: true, key: 'other' })), true)
})

test('a sticky incoming replaces a transient bubble', () => {
  assert.equal(shouldReplaceBubble(bubble('completion', 1), bubble('waiting', 2, { sticky: true })), true)
})

test('expiry only applies to non-sticky bubbles', () => {
  const transient = bubble('completion', 1)
  assert.equal(isBubbleExpired(transient, 5000), false)
  assert.equal(isBubbleExpired(transient, 7000), true)
  assert.equal(isBubbleExpired(bubble('waiting', 1, { sticky: true }), 1e9), false)
})
