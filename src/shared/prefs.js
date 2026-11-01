/**
 * Preference schema, defaults, normalization and merge. Preferences are a
 * plain JSON document in localStorage; every field is validated on load so a
 * hand-edited or stale value cannot break the pet.
 * @module dsh-pet/shared/prefs
 */
import { clamp } from './format.js'

/** Current preferences schema version. */
export const PREFS_VERSION = 1

/** Default preferences. */
export const DEFAULT_PREFS = {
  version: PREFS_VERSION,
  size: 120,
  opacity: 1,
  visible: true,
  showPlaque: true,
  showTasks: true,
  desktopWindow: false,
  randomLines: true,
  language: 'auto',
  skinId: 'kuro',
  petName: '',
  position: { x: null, y: null, right: 24, bottom: 110 },
  account: { refreshSeconds: 60 },
  alerts: {
    lowBalance: true,
    lowBalanceThreshold: 10,
    lowBalanceCurrency: 'auto',
    context: true,
    contextWarn: 80,
    contextDanger: 90,
    completion: true,
    background: true,
    waiting: true,
    notifications: false,
    sound: false,
  },
  focus: {
    enabled: true,
    focusMinutes: 25,
    breakMinutes: 5,
    autoBreak: true,
    waterMinutes: 45,
  },
  stats: { enabled: true },
}

/**
 * Clamp an integer setting.
 * @param value - raw value.
 * @param fallback - default.
 * @param min - lower bound.
 * @param max - upper bound.
 * @returns clamp-enabled integer.
 */
function intSetting(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.round(clamp(number, min, max))
}

/**
 * Keep a boolean when present, otherwise the fallback.
 * @param value - raw value.
 * @param fallback - default.
 * @returns boolean.
 */
function booleanSetting(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Normalize an arbitrary value into the exact preference shape.
 * @param raw - parsed localStorage value or a partial patch.
 * @returns a fully populated preference object.
 */
export function normalizePrefs(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const sourceAlerts = source.alerts !== null && typeof source.alerts === 'object' ? source.alerts : {}
  const sourceFocus = source.focus !== null && typeof source.focus === 'object' ? source.focus : {}
  const sourceAccount = source.account !== null && typeof source.account === 'object' ? source.account : {}
  const sourcePosition = source.position !== null && typeof source.position === 'object' ? source.position : {}
  const sourceStats = source.stats !== null && typeof source.stats === 'object' ? source.stats : {}
  const warn = intSetting(sourceAlerts.contextWarn, DEFAULT_PREFS.alerts.contextWarn, 50, 95)
  const danger = intSetting(sourceAlerts.contextDanger, DEFAULT_PREFS.alerts.contextDanger, warn + 1, 99)
  const language = source.language === 'zh' || source.language === 'en' ? source.language : 'auto'
  const currency = sourceAlerts.lowBalanceCurrency === 'CNY' || sourceAlerts.lowBalanceCurrency === 'USD'
    ? sourceAlerts.lowBalanceCurrency
    : 'auto'
  const threshold = Number(sourceAlerts.lowBalanceThreshold)
  const refresh = Number(sourceAccount.refreshSeconds)
  const refreshSeconds = refresh === 0 || refresh === 30 || refresh === 60 || refresh === 300
    ? refresh
    : DEFAULT_PREFS.account.refreshSeconds
  return {
    version: PREFS_VERSION,
    size: intSetting(source.size, DEFAULT_PREFS.size, 80, 200),
    opacity: Number.isFinite(Number(source.opacity)) ? clamp(Number(source.opacity), 0.3, 1) : DEFAULT_PREFS.opacity,
    visible: booleanSetting(source.visible, DEFAULT_PREFS.visible),
    showPlaque: booleanSetting(source.showPlaque, DEFAULT_PREFS.showPlaque),
    showTasks: booleanSetting(source.showTasks, DEFAULT_PREFS.showTasks),
    desktopWindow: booleanSetting(source.desktopWindow, DEFAULT_PREFS.desktopWindow),
    randomLines: booleanSetting(source.randomLines, DEFAULT_PREFS.randomLines),
    language,
    skinId: typeof source.skinId === 'string' && /^[a-z0-9-]{1,40}$/.test(source.skinId) ? source.skinId : DEFAULT_PREFS.skinId,
    petName: typeof source.petName === 'string' ? source.petName.slice(0, 24) : '',
    position: {
      x: sourcePosition.x === null || sourcePosition.x === undefined || sourcePosition.x === ''
        ? null
        : Number.isFinite(Number(sourcePosition.x)) ? Number(sourcePosition.x) : null,
      y: sourcePosition.y === null || sourcePosition.y === undefined || sourcePosition.y === ''
        ? null
        : Number.isFinite(Number(sourcePosition.y)) ? Number(sourcePosition.y) : null,
      right: Number.isFinite(Number(sourcePosition.right)) ? Math.max(0, Number(sourcePosition.right)) : DEFAULT_PREFS.position.right,
      bottom: Number.isFinite(Number(sourcePosition.bottom)) ? Math.max(0, Number(sourcePosition.bottom)) : DEFAULT_PREFS.position.bottom,
    },
    account: { refreshSeconds },
    alerts: {
      lowBalance: booleanSetting(sourceAlerts.lowBalance, DEFAULT_PREFS.alerts.lowBalance),
      lowBalanceThreshold: Number.isFinite(threshold) ? clamp(threshold, 0, 1e9) : DEFAULT_PREFS.alerts.lowBalanceThreshold,
      lowBalanceCurrency: currency,
      context: booleanSetting(sourceAlerts.context, DEFAULT_PREFS.alerts.context),
      contextWarn: warn,
      contextDanger: danger,
      completion: booleanSetting(sourceAlerts.completion, DEFAULT_PREFS.alerts.completion),
      background: booleanSetting(sourceAlerts.background, DEFAULT_PREFS.alerts.background),
      waiting: booleanSetting(sourceAlerts.waiting, DEFAULT_PREFS.alerts.waiting),
      notifications: booleanSetting(sourceAlerts.notifications, DEFAULT_PREFS.alerts.notifications),
      sound: booleanSetting(sourceAlerts.sound, DEFAULT_PREFS.alerts.sound),
    },
    focus: {
      enabled: booleanSetting(sourceFocus.enabled, DEFAULT_PREFS.focus.enabled),
      focusMinutes: intSetting(sourceFocus.focusMinutes, DEFAULT_PREFS.focus.focusMinutes, 1, 120),
      breakMinutes: intSetting(sourceFocus.breakMinutes, DEFAULT_PREFS.focus.breakMinutes, 1, 60),
      autoBreak: booleanSetting(sourceFocus.autoBreak, DEFAULT_PREFS.focus.autoBreak),
      waterMinutes: intSetting(sourceFocus.waterMinutes, DEFAULT_PREFS.focus.waterMinutes, 0, 240),
    },
    stats: { enabled: booleanSetting(sourceStats.enabled, DEFAULT_PREFS.stats.enabled) },
  }
}

/**
 * Shallow-merge a patch into the current preferences, then re-normalize.
 * `alerts`, `focus`, `account`, `stats` and `position` merge one level deep.
 * @param base - current preferences.
 * @param patch - partial preferences.
 * @returns normalized result.
 */
export function mergePrefs(base, patch) {
  if (patch === null || typeof patch !== 'object') return normalizePrefs(base)
  const next = { ...base, ...patch }
  if (patch.alerts !== undefined) next.alerts = { ...base.alerts, ...patch.alerts }
  if (patch.focus !== undefined) next.focus = { ...base.focus, ...patch.focus }
  if (patch.account !== undefined) next.account = { ...base.account, ...patch.account }
  if (patch.stats !== undefined) next.stats = { ...base.stats, ...patch.stats }
  if (patch.position !== undefined) next.position = { ...base.position, ...patch.position }
  return normalizePrefs(next)
}

/**
 * Resolve the display name: explicit pet name, then the active skin name.
 * @param prefs - preferences.
 * @param skin - active skin.
 * @param language - `zh` or `en`.
 * @returns display name.
 */
export function petDisplayName(prefs, skin, language) {
  if (prefs.petName !== '') return prefs.petName
  if (skin !== null && typeof skin === 'object') {
    if (typeof skin.name === 'string') return skin.name
    if (skin.name !== null && typeof skin.name === 'object') return skin.name[language] || skin.name.en || 'DSH Pet'
  }
  return 'DSH Pet'
}
