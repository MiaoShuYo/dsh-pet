import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createFocusState, focusRemaining, pauseFocus, resetFocus, resumeFocus, startFocus, tickFocus,
} from '../src/shared/pomodoro.js'

const MINUTE = 60 * 1000

test('startFocus sets an absolute deadline', () => {
  const state = startFocus('focus', 25, 1000)
  assert.equal(state.phase, 'focus')
  assert.equal(state.endsAt, 1000 + 25 * MINUTE)
  assert.equal(focusRemaining(state, 1000 + 10 * MINUTE), 15 * MINUTE)
})

test('tickFocus completes exactly when the deadline passes', () => {
  const state = startFocus('focus', 25, 0)
  assert.equal(tickFocus(state, 24 * MINUTE).completed, null)
  const done = tickFocus(state, 25 * MINUTE)
  assert.equal(done.completed, 'focus')
  assert.equal(done.state.phase, 'idle')
})

test('pause and resume preserve the remaining duration', () => {
  const running = startFocus('focus', 25, 0)
  const paused = pauseFocus(running, 10 * MINUTE)
  assert.equal(paused.paused, true)
  assert.equal(focusRemaining(paused, 99 * MINUTE), 15 * MINUTE)
  const resumed = resumeFocus(paused, 20 * MINUTE)
  assert.equal(resumed.paused, false)
  assert.equal(resumed.endsAt, 20 * MINUTE + 15 * MINUTE)
  assert.equal(tickFocus(resumed, 34 * MINUTE).completed, null)
  assert.equal(tickFocus(resumed, 35 * MINUTE).completed, 'focus')
})

test('pause on idle and resume on running are no-ops', () => {
  const idle = createFocusState()
  assert.equal(pauseFocus(idle, 10), idle)
  assert.equal(resumeFocus(idle, 10), idle)
})

test('resetFocus returns a fresh idle state', () => {
  assert.deepEqual(resetFocus(), createFocusState())
})
