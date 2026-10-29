import test from 'node:test'
import assert from 'node:assert/strict'
import { clampPetPosition, panelPlacement } from '../src/shared/geometry.js'

test('clampPetPosition keeps the pet inside the viewport', () => {
  assert.deepEqual(clampPetPosition({ right: 10, bottom: 20 }, { width: 1000, height: 800 }, 120), { right: 10, bottom: 20 })
  assert.deepEqual(clampPetPosition({ right: 5000, bottom: -5 }, { width: 1000, height: 800 }, 120), { right: 880, bottom: 0 })
  assert.deepEqual(clampPetPosition({}, { width: 100, height: 80 }, 120), { right: 0, bottom: 0 })
})

test('panelPlacement prefers the left side when there is room', () => {
  const placement = panelPlacement({ right: 40, bottom: 120 }, { width: 1400, height: 900 }, 120, { width: 320, height: 520 })
  assert.equal(placement.width, 320)
  assert.equal(placement.left, 1400 - 40 - 120 - 320 - 12)
  assert.ok(placement.top >= 12)
})

test('panelPlacement flips to the right at the left edge', () => {
  const placement = panelPlacement({ right: 1000, bottom: 120 }, { width: 1200, height: 900 }, 120, { width: 320, height: 520 })
  assert.ok(placement.left >= 12)
  assert.equal(placement.width, 320)
})

test('panelPlacement clamps a tall panel to the viewport', () => {
  const placement = panelPlacement({ right: 40, bottom: 0 }, { width: 800, height: 400 }, 120, { width: 320, height: 800 })
  assert.equal(placement.maxHeight, 376)
  assert.equal(placement.top, 12)
})
