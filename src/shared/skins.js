/**
 * Skin registry and validation.
 *
 * Built-in skins are parameterized vector mascots; imported skins are image
 * packs stored in localStorage. Only `idle` is required — every other state
 * falls back to it, so a two-image pack is still usable.
 * @module dsh-pet/shared/skins
 */
import { SKIN_STATES } from './constants.js'

/** Built-in vector skins. Palettes are tuned for both DSH color schemes. */
export const BUILTIN_SKINS = [
  {
    id: 'kuro',
    kind: 'vector',
    builtin: true,
    name: { en: 'Kuro', zh: '小黑' },
    accessory: 'scarf',
    palette: {
      fur: '#262b3d',
      furDark: '#171b2a',
      belly: '#3b435c',
      ear: '#f3a7bc',
      eye: '#a9ecff',
      pupil: '#101522',
      accent: '#6da8ff',
      blush: '#ff9fb6',
    },
  },
  {
    id: 'mochi',
    kind: 'vector',
    builtin: true,
    name: { en: 'Mochi', zh: '奶团' },
    accessory: 'bow',
    palette: {
      fur: '#f4e7d3',
      furDark: '#dfc9a9',
      belly: '#fffaf0',
      ear: '#f7b7c8',
      eye: '#5f6b8a',
      pupil: '#262c3d',
      accent: '#f29f6b',
      blush: '#ffb3c4',
    },
  },
  {
    id: 'pixel',
    kind: 'vector',
    builtin: true,
    name: { en: 'Pixel', zh: '像素' },
    accessory: 'headband',
    palette: {
      fur: '#b9c2d6',
      furDark: '#8e99b2',
      belly: '#e8edf7',
      ear: '#9fb4e8',
      eye: '#7ef0c8',
      pupil: '#14202b',
      accent: '#59d6b0',
      blush: '#ffa9b8',
    },
  },
]

/** IDs reserved by built-ins. */
export const BUILTIN_SKIN_IDS = BUILTIN_SKINS.map(skin => skin.id)

/** Maximum bytes for one imported image. */
export const MAX_IMAGE_BYTES = 512 * 1024

/** Maximum bytes for all images in one pack. */
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024

/** Maximum custom packs. */
export const MAX_CUSTOM_SKINS = 20

const IMAGE_DATA_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i
const HTTPS_URL_RE = /^https:\/\/[^\s"']+$/i
const SKIN_ID_RE = /^[a-z0-9-]{1,40}$/

/**
 * Whether an image reference is one of the two allowed forms.
 * @param value - data URL or https URL.
 * @returns true when safe to put in an `<img src>`.
 */
export function isSafeImageUrl(value) {
  if (typeof value !== 'string') return false
  return IMAGE_DATA_RE.test(value) || HTTPS_URL_RE.test(value)
}

/**
 * Approximate decoded byte length of an image reference.
 * @param value - data URL or https URL.
 * @returns bytes, or 0.
 */
export function imageByteLength(value) {
  if (typeof value !== 'string') return 0
  if (HTTPS_URL_RE.test(value)) return value.length
  const comma = value.indexOf(',')
  if (comma < 0) return 0
  return Math.floor((value.length - comma - 1) * 3 / 4)
}

/**
 * Validate one imported skin pack.
 * @param raw - parsed JSON value.
 * @returns `{ ok: true, skin }` or `{ ok: false, error }` where error is a dictionary key.
 */
export function validateSkinPack(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'skin.invalid' }
  if (raw.format !== 1) return { ok: false, error: 'skin.format' }
  if (raw.kind !== 'image') return { ok: false, error: 'skin.kind' }
  if (typeof raw.id !== 'string' || !SKIN_ID_RE.test(raw.id)) return { ok: false, error: 'skin.id' }
  if (BUILTIN_SKIN_IDS.indexOf(raw.id) >= 0) return { ok: false, error: 'skin.reservedId' }
  if (typeof raw.name !== 'string' || raw.name.trim() === '' || raw.name.length > 40) return { ok: false, error: 'skin.name' }
  if (raw.images === null || typeof raw.images !== 'object' || Array.isArray(raw.images)) return { ok: false, error: 'skin.images' }
  const images = {}
  let total = 0
  for (const state of SKIN_STATES) {
    const value = raw.images[state]
    if (value === undefined || value === null) continue
    if (!isSafeImageUrl(value)) return { ok: false, error: 'skin.imageType' }
    const bytes = imageByteLength(value)
    if (bytes > MAX_IMAGE_BYTES) return { ok: false, error: 'skin.imageTooLarge' }
    total += bytes
    images[state] = value
  }
  if (images.idle === undefined) return { ok: false, error: 'skin.images' }
  if (total > MAX_TOTAL_BYTES) return { ok: false, error: 'skin.totalTooLarge' }
  const bubble = raw.bubble !== null && typeof raw.bubble === 'object' ? raw.bubble : {}
  const style = bubble.style === 'dark' ? 'dark' : 'light'
  return {
    ok: true,
    skin: {
      format: 1,
      id: raw.id,
      kind: 'image',
      builtin: false,
      name: raw.name.trim(),
      images,
      bubble: { style },
    },
  }
}

/**
 * Normalize the stored custom-skin array.
 * @param raw - parsed localStorage value.
 * @returns valid custom skins, deduplicated and capped.
 */
export function normalizeCustomSkins(raw) {
  if (!Array.isArray(raw)) return []
  const result = []
  const seen = new Set()
  for (const item of raw) {
    if (result.length >= MAX_CUSTOM_SKINS) break
    const checked = validateSkinPack(item)
    if (!checked.ok || seen.has(checked.skin.id)) continue
    seen.add(checked.skin.id)
    result.push(checked.skin)
  }
  return result
}

/**
 * All selectable skins: built-ins first, then customs.
 * @param custom - custom skins.
 * @returns ordered skins.
 */
export function allSkins(custom) {
  return BUILTIN_SKINS.concat(Array.isArray(custom) ? custom : [])
}

/**
 * Find a skin by id, falling back to the first built-in.
 * @param skins - all skins.
 * @param id - desired id.
 * @returns the skin.
 */
export function findSkin(skins, id) {
  for (const skin of skins) if (skin.id === id) return skin
  return skins[0] || BUILTIN_SKINS[0]
}

/**
 * Resolve the image for one state, falling back to idle.
 * @param skin - image or vector skin.
 * @param state - presentation state.
 * @returns image reference, or the idle image.
 */
export function skinStateImage(skin, state) {
  if (skin === null || typeof skin !== 'object' || skin.images === null || typeof skin.images !== 'object') return ''
  return skin.images[state] || skin.images.idle || ''
}

/**
 * Localized skin label.
 * @param skin - skin.
 * @param language - `zh` or `en`.
 * @returns label.
 */
export function skinLabel(skin, language) {
  if (skin === null || typeof skin !== 'object') return 'DSH Pet'
  if (typeof skin.name === 'string') return skin.name
  return skin.name[language] || skin.name.en || 'DSH Pet'
}

/**
 * Serialize one custom skin for export/download.
 * @param skin - custom skin.
 * @returns pretty JSON, or '' for a built-in.
 */
export function exportSkin(skin) {
  if (skin === null || typeof skin !== 'object' || skin.kind !== 'image') return ''
  return JSON.stringify({
    format: 1,
    kind: 'image',
    id: skin.id,
    name: skin.name,
    images: skin.images,
    bubble: skin.bubble || { style: 'light' },
  }, null, 2)
}
