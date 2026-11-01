import test from 'node:test'
import assert from 'node:assert/strict'
import { clampPetPosition, clampScreenPosition, panelPlacement, screenLayout } from '../src/shared/geometry.js'

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

test('panelPlacement never lets a normal panel run past the bottom edge', () => {
  const placement = panelPlacement({ right: 40, bottom: 120 }, { width: 1440, height: 900 }, 120, { width: 336, height: 560 })
  assert.equal(placement.maxHeight, 560)
  assert.ok(placement.top + placement.maxHeight <= 900 - 11)
})

test('clampScreenPosition keeps the pet inside the window content frame', () => {
  const frame = { contentX: 100, contentY: 80, width: 800, height: 600 }
  assert.deepEqual(clampScreenPosition({ x: 300, y: 300 }, frame, 120), { x: 300, y: 300 })
  assert.deepEqual(clampScreenPosition({ x: -500, y: 9999 }, frame, 120), { x: 100, y: 560 })
})

test('screenLayout converts a desktop anchor into viewport coordinates', () => {
  const frame = { contentX: 100, contentY: 80, width: 800, height: 600 }
  const layout = screenLayout({ x: 300, y: 300 }, frame, 120)
  assert.equal(layout.left, 200)
  assert.equal(layout.top, 220)
  assert.equal(layout.screenX, 300)
  assert.equal(layout.screenY, 300)
  assert.equal(layout.visible, true)
  assert.equal(screenLayout({ x: -500, y: 300 }, frame, 120).visible, false)
  assert.equal(screenLayout({ x: 300, y: 9999 }, frame, 120).visible, false)
})
