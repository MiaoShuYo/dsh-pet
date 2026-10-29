import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUILTIN_SKINS, allSkins, exportSkin, findSkin, imageByteLength, isSafeImageUrl,
  normalizeCustomSkins, skinLabel, skinStateImage, validateSkinPack,
} from '../src/shared/skins.js'

const TINY = 'data:image/png;base64,iVBORw0KGgo='

function pack(overrides = {}) {
  return {
    format: 1,
    kind: 'image',
    id: 'my-cat',
    name: 'My Cat',
    images: { idle: TINY },
    ...overrides,
  }
}

test('image references only accept png/jpeg/webp/gif data URLs or https', () => {
  assert.equal(isSafeImageUrl(TINY), true)
  assert.equal(isSafeImageUrl('https://example.com/cat.png'), true)
  assert.equal(isSafeImageUrl('data:image/svg+xml;base64,PHN2Zz4='), false)
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false)
  assert.equal(isSafeImageUrl('http://example.com/cat.png'), false)
  assert.equal(isSafeImageUrl(42), false)
})

test('imageByteLength estimates base64 payload size', () => {
  assert.ok(imageByteLength(TINY) > 0)
  assert.equal(imageByteLength('https://example.com/cat.png'), 27)
  assert.equal(imageByteLength(null), 0)
})

test('validateSkinPack accepts a minimal pack', () => {
  const result = validateSkinPack(pack())
  assert.equal(result.ok, true)
  assert.equal(result.skin.id, 'my-cat')
  assert.equal(result.skin.builtin, false)
  assert.equal(result.skin.bubble.style, 'light')
})

test('validateSkinPack rejects malformed packs', () => {
  assert.equal(validateSkinPack(null).error, 'skin.invalid')
  assert.equal(validateSkinPack(pack({ format: 2 })).error, 'skin.format')
  assert.equal(validateSkinPack(pack({ kind: 'vector' })).error, 'skin.kind')
  assert.equal(validateSkinPack(pack({ id: 'Bad Id' })).error, 'skin.id')
  assert.equal(validateSkinPack(pack({ id: 'kuro' })).error, 'skin.reservedId')
  assert.equal(validateSkinPack(pack({ name: '' })).error, 'skin.name')
  assert.equal(validateSkinPack(pack({ images: {} })).error, 'skin.images')
  assert.equal(validateSkinPack(pack({ images: { idle: 'javascript:alert(1)' } })).error, 'skin.imageType')
  assert.equal(validateSkinPack(pack({ images: { idle: 'data:image/svg+xml;base64,PHN2Zz4=' } })).error, 'skin.imageType')
  const huge = 'data:image/png;base64,' + 'A'.repeat(800_000)
  assert.equal(validateSkinPack(pack({ images: { idle: huge } })).error, 'skin.imageTooLarge')
})

test('normalizeCustomSkins deduplicates and ignores invalid entries', () => {
  const valid = validateSkinPack(pack()).skin
  const result = normalizeCustomSkins([valid, valid, { nope: true }, null])
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'my-cat')
  assert.equal(normalizeCustomSkins('nope').length, 0)
})

test('allSkins appends customs after built-ins', () => {
  const custom = validateSkinPack(pack({ id: 'second' })).skin
  const skins = allSkins([custom])
  assert.equal(skins.length, BUILTIN_SKINS.length + 1)
  assert.equal(skins[skins.length - 1].id, 'second')
})

test('findSkin falls back to the first built-in', () => {
  assert.equal(findSkin(allSkins([]), 'mochi').id, 'mochi')
  assert.equal(findSkin(allSkins([]), 'missing').id, 'kuro')
})

test('skinStateImage falls back to idle', () => {
  const skin = validateSkinPack(pack()).skin
  assert.equal(skinStateImage(skin, 'sleepy'), TINY)
  assert.equal(skinStateImage(skin, 'idle'), TINY)
  assert.equal(skinStateImage(null, 'idle'), '')
})

test('skinLabel localizes built-ins and passes custom names', () => {
  assert.equal(skinLabel(BUILTIN_SKINS[0], 'zh'), '小黑')
  assert.equal(skinLabel({ name: 'Plain' }, 'en'), 'Plain')
})

test('exportSkin round-trips through validateSkinPack', () => {
  const skin = validateSkinPack(pack()).skin
  const text = exportSkin(skin)
  const parsed = JSON.parse(text)
  const again = validateSkinPack(parsed)
  assert.equal(again.ok, true)
  assert.equal(again.skin.id, 'my-cat')
  assert.equal(exportSkin(BUILTIN_SKINS[0]), '')
})
