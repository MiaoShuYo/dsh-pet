/**
 * Browser side effects: storage, clipboard, downloads, audio chimes and OS
 * notifications. Every function degrades quietly when a capability is absent
 * or denied, because the pet must never break the host UI.
 * @module dsh-pet/client/effects
 */

let chimeContext = null

/**
 * Read one localStorage value.
 * @param key - storage key.
 * @returns string value, or null.
 */
export function readStorage(key) {
  try {
    const storage = globalThis.localStorage
    if (storage === null || storage === undefined) return null
    return storage.getItem(key)
  } catch (_error) {
    return null
  }
}

/**
 * Write one localStorage value.
 * @param key - storage key.
 * @param value - string value.
 * @returns whether the write succeeded.
 */
export function writeStorage(key, value) {
  try {
    const storage = globalThis.localStorage
    if (storage === null || storage === undefined) return false
    storage.setItem(key, value)
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Open an http(s) URL in a new tab.
 * @param url - candidate URL.
 * @returns whether a tab was requested.
 */
export function openExternal(url) {
  if (typeof url !== 'string' || url === '') return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    if (typeof window === 'undefined') return false
    window.open(parsed.href, '_blank', 'noopener,noreferrer')
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Copy text to the clipboard, with a legacy fallback.
 * @param text - text to copy.
 * @returns whether the copy succeeded.
 */
export async function copyText(text) {
  if (typeof text !== 'string') return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined
      && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (_error) {
    // Fall through to the textarea path.
  }
  if (typeof document === 'undefined') return false
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', 'readonly')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    area.style.pointerEvents = 'none'
    document.body.appendChild(area)
    area.select()
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false
    area.remove()
    return ok
  } catch (_error) {
    return false
  }
}

/**
 * Download a text file.
 * @param filename - file name.
 * @param text - file contents.
 * @param mime - media type.
 * @returns whether the download was requested.
 */
export function downloadText(filename, text, mime = 'application/json') {
  if (typeof document === 'undefined') return false
  try {
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => { URL.revokeObjectURL(url) }, 1000)
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Read a user-selected file as text.
 * @param file - File object.
 * @returns file text.
 */
export function readTextFile(file) {
  if (file !== null && file !== undefined && typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => { resolve(String(reader.result || '')) }
      reader.onerror = () => { reject(reader.error) }
      reader.readAsText(file)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Play a short two-note chime.
 * @param tone - alert tone.
 * @returns undefined
 */
export function playChime(tone) {
  if (typeof window === 'undefined') return
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (Ctor === undefined) return
    if (chimeContext === null) chimeContext = new Ctor()
    if (chimeContext.state === 'suspended') {
      chimeContext.resume().catch(() => {})
    }
    const notes = tone === 'danger' || tone === 'error'
      ? [392, 311]
      : tone === 'completion'
        ? [523, 659]
        : [440, 554]
    const start = chimeContext.currentTime
    notes.forEach((frequency, index) => {
      const oscillator = chimeContext.createOscillator()
      const gain = chimeContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const at = start + index * 0.09
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.07, at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
      oscillator.connect(gain)
      gain.connect(chimeContext.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.2)
    })
  } catch (_error) {
    // Audio is optional.
  }
}

/**
 * Whether the browser exposes notifications.
 * @returns boolean.
 */
export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Request notification permission.
 * @returns `granted`, `denied` or `unsupported`.
 */
export async function requestNotifications() {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch (_error) {
    return 'denied'
  }
}

/**
 * Send one OS notification.
 * @param title - notification title.
 * @param body - notification body.
 * @param onClick - click callback.
 * @returns whether a notification was shown.
 */
export function sendNotification(title, body, onClick) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  try {
    const notification = new Notification(title, { body, tag: 'dsh-pet', silent: true })
    notification.onclick = () => {
      notification.close()
      if (typeof onClick === 'function') onClick()
    }
    setTimeout(() => { notification.close() }, 9000)
    return true
  } catch (_error) {
    return false
  }
}

/**
 * Format an epoch timestamp as local time.
 * @param timestamp - epoch ms.
 * @param locale - BCP 47 locale.
 * @returns time text, or ''.
 */
export function formatTime(timestamp, locale) {
  if (!timestamp) return ''
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp))
  } catch (_error) {
    return new Date(timestamp).toLocaleTimeString()
  }
}
