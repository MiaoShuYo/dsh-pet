/**
 * Viewport placement helpers for the pet and its settings panel.
 * @module dsh-pet/shared/geometry
 */
import { clamp } from './format.js'

/**
 * Clamp a `{ right, bottom }` anchor so the pet stays fully on screen.
 * @param position - desired anchor.
 * @param viewport - `{ width, height }`.
 * @param size - rendered pet square size.
 * @returns clamped anchor.
 */
export function clampPetPosition(position, viewport, size) {
  const width = Math.max(0, Number(viewport.width) || 0)
  const height = Math.max(0, Number(viewport.height) || 0)
  const pet = Math.max(0, Number(size) || 0)
  const right = clamp(position && position.right, 0, Math.max(0, width - pet))
  const bottom = clamp(position && position.bottom, 0, Math.max(0, height - pet))
  return { right, bottom }
}

/**
 * Place the settings panel beside the pet, flipping sides and clamping to the
 * viewport when there is no room.
 * @param position - pet `{ right, bottom }`.
 * @param viewport - `{ width, height }`.
 * @param petSize - rendered pet square size.
 * @param panel - `{ width, height }`.
 * @returns an absolute `{ left, top, width, maxHeight }` style.
 */
export function panelPlacement(position, viewport, petSize, panel) {
  const viewportWidth = Math.max(0, Number(viewport.width) || 0)
  const petLeft = viewportWidth - (Number(position.right) || 0) - petSize
  const petRight = viewportWidth - (Number(position.right) || 0)
  const desiredWidth = Math.max(160, Math.min(Number(panel.width) || 320, viewportWidth - 24))
  const leftSpace = Math.max(0, petLeft - 24)
  const rightSpace = Math.max(0, viewportWidth - petRight - 24)
  const side = leftSpace >= desiredWidth
    ? 'left'
    : rightSpace >= desiredWidth
      ? 'right'
      : leftSpace >= rightSpace ? 'left' : 'right'
  const availableWidth = side === 'left' ? leftSpace : rightSpace
  const width = Math.max(160, Math.min(desiredWidth, availableWidth || desiredWidth))
  const height = Math.max(160, Number(panel.height) || 520)
  const maxHeight = Math.max(160, (Number(viewport.height) || 0) - 24)
  const effectiveHeight = Math.min(height, maxHeight)
  const left = side === 'left' ? petLeft - width - 12 : petRight + 12
  const top = clamp((Number(viewport.height) || 0) - (Number(position.bottom) || 0) - effectiveHeight,
    12, Math.max(12, (Number(viewport.height) || 0) - effectiveHeight - 12))
  const available = Math.max(160, (Number(viewport.height) || 0) - top - 12)
  return {
    left: Math.max(12, left),
    top,
    width,
    maxHeight: Math.max(160, Math.min(effectiveHeight, available)),
  }
}

/**
 * Clamp a screen-space pet position into the current window content box.
 * Used only while dragging: window movement never rewrites the stored screen
 * position, so the pet keeps the spot the user chose.
 * @param position - screen `{ x, y }` of the pet's top-left corner.
 * @param frame - window content frame `{ contentX, contentY, width, height }`.
 * @param size - rendered pet square size.
 * @returns clamped screen position.
 */
export function clampScreenPosition(position, frame, size) {
  const pet = Math.max(0, Number(size) || 0)
  const minX = Number(frame.contentX) || 0
  const minY = Number(frame.contentY) || 0
  const maxX = minX + Math.max(0, (Number(frame.width) || 0) - pet)
  const maxY = minY + Math.max(0, (Number(frame.height) || 0) - pet)
  return {
    x: clamp(position && position.x, minX, maxX),
    y: clamp(position && position.y, minY, maxY),
  }
}

/**
 * Convert a stored screen-space position into the viewport layout the page
 * paints. When the DSH window moves, `left`/`top` move by the opposite amount,
 * so the pet stays at the same desktop coordinate. `visible` is false only
 * when the pet is completely outside the window content box.
 * @param position - screen `{ x, y }` of the pet's top-left corner.
 * @param frame - window content frame `{ contentX, contentY, width, height }`.
 * @param size - rendered pet square size.
 * @returns `{ left, top, screenX, screenY, visible }`.
 */
export function screenLayout(position, frame, size) {
  const pet = Math.max(0, Number(size) || 0)
  const screenX = Number(position && position.x)
  const screenY = Number(position && position.y)
  const left = (Number.isFinite(screenX) ? screenX : 0) - (Number(frame.contentX) || 0)
  const top = (Number.isFinite(screenY) ? screenY : 0) - (Number(frame.contentY) || 0)
  const width = Number(frame.width) || 0
  const height = Number(frame.height) || 0
  const visible = left + pet > 0 && top + pet > 0 && left < width && top < height
  return {
    left,
    top,
    screenX: Number.isFinite(screenX) ? screenX : 0,
    screenY: Number.isFinite(screenY) ? screenY : 0,
    visible,
  }
}
