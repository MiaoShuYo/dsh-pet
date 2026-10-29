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
  const width = Math.max(160, Math.min(Number(panel.width) || 320, (Number(viewport.width) || 0) - 24))
  const height = Math.max(160, Number(panel.height) || 520)
  const maxHeight = Math.max(160, (Number(viewport.height) || 0) - 24)
  const effectiveHeight = Math.min(height, maxHeight)
  const petLeft = (Number(viewport.width) || 0) - (Number(position.right) || 0) - petSize
  const petRight = (Number(viewport.width) || 0) - (Number(position.right) || 0)
  const leftCandidate = petLeft - width - 12
  const left = leftCandidate >= 12
    ? leftCandidate
    : Math.min(petRight + 12, (Number(viewport.width) || 0) - width - 12)
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
