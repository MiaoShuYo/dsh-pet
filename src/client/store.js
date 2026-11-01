/**
 * Non-React pet state container.
 *
 * It owns everything that is not presentation: the current session selection,
 * projection subscriptions, account polling, alert latches, daily statistics,
 * the focus timer, and the one-visible-bubble policy. React reads it through
 * the slot `hooks.pet` source and never owns this state.
 *
 * @module dsh-pet/client/store
 */
import { PET_VERSION, SNAPSHOT_VERSION, STORAGE_KEYS } from '../shared/constants.js'
import {
  clamp, formatClock, formatCompactNumber, formatMoney, formatPercent, formatTemplate,
  parseAmount, resolveLanguage, totalTokens,
} from '../shared/format.js'
import { contextOccupancy, contextTone, decideBalanceAlert, decideContextAlert } from '../shared/thresholds.js'
import { clampScreenPosition, screenLayout } from '../shared/geometry.js'
import { DEFAULT_PREFS, mergePrefs, normalizePrefs, petDisplayName } from '../shared/prefs.js'
import {
  allSkins, exportSkin, findSkin, normalizeCustomSkins, skinLabel, validateSkinPack,
} from '../shared/skins.js'
import {
  addUsage, createStats, dayKey, normalizeStats, observeBalance, recentDays, rollStats,
  todayBalanceDelta, todayTokenTotal,
} from '../shared/stats.js'
import {
  createFocusState, focusRemaining, pauseFocus, resetFocus, resumeFocus, startFocus, tickFocus,
} from '../shared/pomodoro.js'
import { isBubbleExpired, makeBubble, shouldReplaceBubble } from '../shared/bubbles.js'
import { sameTasks, sortTasks, taskFromToolCall, tasksFromJobs } from '../shared/tasks.js'
import { en, zh } from './locales.js'
import {
  copyText, openExternal, playChime, readStorage, sendNotification, writeStorage,
} from './effects.js'

const IDEA_KEYS = ['bubble.idle1', 'bubble.idle2', 'bubble.idle3', 'bubble.idle4', 'bubble.idle5']
const DEMO_TASKS = [
  { id: 'demo-task-1', label: '创建 V1.6.4 分支', status: 'running', progress: '正在运行命令', kind: 'bash', source: 'job', toolName: '', command: false, startedAt: 1 },
  { id: 'demo-task-2', label: '运行单元测试', status: 'running', progress: 'pwsh · 12s', kind: 'bash', source: 'job', toolName: '', command: false, startedAt: 2 },
]
const TONE_TTL = {
  waiting: 0,
  danger: 15000,
  warn: 10000,
  balance: 60000,
  error: 8000,
  completion: 6000,
  focus: 6000,
  water: 6000,
  idle: 5000,
}

/**
 * Parse a JSON value from localStorage.
 * @param key - storage key.
 * @returns parsed value, or null.
 */
function loadStoredJson(key) {
  const raw = readStorage(key)
  if (raw === null || raw === '') return null
  try {
    return JSON.parse(raw)
  } catch (_error) {
    return null
  }
}

/**
 * Save a JSON value, ignoring storage failures.
 * @param key - storage key.
 * @param value - JSON-serializable value.
 * @returns whether the write succeeded.
 */
function saveStoredJson(key, value) {
  try {
    return writeStorage(key, JSON.stringify(value))
  } catch (_error) {
    return false
  }
}

/**
 * Whether a status map contains a key.
 * @param map - Map or object.
 * @param key - candidate key.
 * @returns boolean.
 */
function mapHas(map, key) {
  if (map === null || map === undefined) return false
  return typeof map.has === 'function' ? map.has(key) : Object.prototype.hasOwnProperty.call(map, key)
}

/**
 * Read one entry from a status map.
 * @param map - Map or object.
 * @param key - candidate key.
 * @returns entry, or undefined.
 */
function mapGet(map, key) {
  if (map === null || map === undefined) return undefined
  return typeof map.get === 'function' ? map.get(key) : map[key]
}

/**
 * Whether a value is a real finite number (null/undefined/'' are not 0 here).
 * @param value - candidate.
 * @returns boolean.
 */
function hasNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
}

/** The pet state container. */
export class PetStore {
  /**
   * @param options - client context and clock.
   */
  constructor(options) {
    this.ctx = options.ctx
    this.now = typeof options.now === 'function' ? options.now : () => Date.now()
    this.listeners = new Set()
    this.disposed = false
    this.snapshot = null

    this.prefs = normalizePrefs(loadStoredJson(STORAGE_KEYS.prefs))
    this.customSkins = normalizeCustomSkins(loadStoredJson(STORAGE_KEYS.skins))
    this.stats = normalizeStats(loadStoredJson(STORAGE_KEYS.stats), this.now())

    this.accountApi = null
    this.workspace = null
    this.jobsApi = null
    this.jobsUnsub = null
    this.jobRelease = null
    this.jobTasks = []
    this.toolCalls = new Map()
    this.tasks = []
    this.account = {
      phase: 'idle',
      primary: null,
      wallets: [],
      bonus: [],
      links: null,
      refreshedAt: 0,
      errorCode: null,
    }
    this.accountInFlight = false
    this.accountFailures = 0
    this.lastAccountAttempt = 0
    this.accountAllowed = true

    this.currentId = null
    this.projections = { tokenUsage: null, contextPressure: null, contextBreakdown: null }
    this.liveKeys = new Set()
    this.sessionUnsubs = []
    this.listUnsub = null

    this.statusIndex = {}
    this.statusPrev = new Map()
    this.backgroundAlerted = new Set()
    this.waitingAlerted = new Set()
    this.contextLevels = new Map()

    this.lastBalanceAlertAt = 0
    this.happyUntil = 0
    this.sadUntil = 0
    this.lastActivityAt = this.now()
    this.lastWaterAt = this.now()
    this.focus = createFocusState()
    this.bubble = null
    this.bubbleSeq = 0
    this.demo = null

    this.tickHandle = null
    this.frameRaf = null
    this.frame = this.readFrame()
    this.windowHandlers = null
    this.started = false
  }

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Subscribe to the session catalog, start timers and account polling.
   * @returns undefined
   */
  start() {
    if (this.started || this.disposed) return
    this.started = true
    const sessions = this.ctx.sessions
    if (sessions !== null && sessions !== undefined && sessions.list !== undefined) {
      this.listUnsub = sessions.list.subscribe(() => { this.syncSession() })
      this.syncSession()
    }
    const interval = typeof this.ctx.interval === 'function'
      ? this.ctx.interval.bind(this.ctx)
      : (callback, milliseconds) => {
        const handle = setInterval(callback, milliseconds)
        return () => clearInterval(handle)
      }
    this.tickHandle = interval(() => { this.tick() }, 1000)
    this.ensureScreenPosition()
    this.startFrameLoop()
    this.bindWindow()
    this.refreshAccount(true)
    this.publish()
  }

  /** Release every subscription, timer and window listener. */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.tickHandle !== null) {
      try { this.tickHandle() } catch (_error) { /* already gone */ }
      this.tickHandle = null
    }
    if (this.frameRaf !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frameRaf)
      this.frameRaf = null
    }
    if (this.listUnsub !== null) {
      try { this.listUnsub() } catch (_error) { /* already gone */ }
      this.listUnsub = null
    }
    this.unsubscribeSession()
    this.detachJobs()
    this.unbindWindow()
    this.persistAll()
    this.listeners.clear()
  }

  /** Bind browser-level listeners. */
  bindWindow() {
    if (typeof window === 'undefined' || this.windowHandlers !== null) return
    const onResize = () => {
      this.syncFrame()
      this.publish()
    }
    const onFocus = () => { this.refreshAccount(false) }
    const onOnline = () => { this.refreshAccount(true) }
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') this.refreshAccount(false)
    }
    const onActivity = () => { this.markActivity() }
    const onStorage = (event) => {
      if (event === null || event === undefined) return
      if (event.key === STORAGE_KEYS.prefs) {
        this.prefs = normalizePrefs(loadStoredJson(STORAGE_KEYS.prefs))
        this.publish()
      }
    }
    const handlers = { onResize, onFocus, onOnline, onVisibility, onActivity, onStorage }
    this.windowHandlers = handlers
    window.addEventListener('resize', onResize)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    window.addEventListener('pointerdown', onActivity, true)
    window.addEventListener('keydown', onActivity, true)
    window.addEventListener('storage', onStorage)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  }

  /** Remove browser-level listeners. */
  unbindWindow() {
    if (typeof window === 'undefined' || this.windowHandlers === null) return
    const handlers = this.windowHandlers
    this.windowHandlers = null
    window.removeEventListener('resize', handlers.onResize)
    window.removeEventListener('focus', handlers.onFocus)
    window.removeEventListener('online', handlers.onOnline)
    window.removeEventListener('pointerdown', handlers.onActivity, true)
    window.removeEventListener('keydown', handlers.onActivity, true)
    window.removeEventListener('storage', handlers.onStorage)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handlers.onVisibility)
  }

  /* ------------------------------------------------------------------ */
  /* observable contract                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Stable observable source for the slot renderer.
   * @returns current snapshot.
   */
  getSnapshot() {
    if (this.snapshot === null) this.snapshot = this.buildSnapshot()
    return this.snapshot
  }

  /**
   * Subscribe to snapshot changes.
   * @param listener - change callback.
   * @returns unsubscribe.
   */
  subscribe(listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Replace the snapshot and notify subscribers. */
  publish() {
    if (this.disposed) return
    this.snapshot = this.buildSnapshot()
    for (const listener of [...this.listeners]) {
      try { listener() } catch (_error) { /* a broken observer must not stop others */ }
    }
  }

  /* ------------------------------------------------------------------ */
  /* data sources                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Attach the account Remote namespace once it becomes available.
   * @param api - generated `remote.account` face.
   * @returns detach callback.
   */
  attachAccount(api) {
    this.accountApi = api
    this.lastAccountAttempt = 0
    this.refreshAccount(true)
    return () => { if (this.accountApi === api) this.accountApi = null }
  }

  /**
   * Attach the workspace client service used by jump-to-session.
   * @param workspace - `ctx.uiWorkspace` face.
   * @returns undefined
   */
  attachWorkspace(workspace) {
    this.workspace = workspace === undefined ? null : workspace
  }

  /**
   * Attach the client jobs service. The roster stream starts only while a main
   * session is selected, and its model subscription is released on detach.
   * @param jobs - `ctx.jobs` face.
   * @returns detach callback.
   */
  attachJobs(jobs) {
    this.detachJobs()
    this.jobsApi = jobs === undefined ? null : jobs
    const state = this.jobsApi !== null ? this.jobsApi.state || this.jobsApi.model : null
    if (state !== null && state !== undefined && typeof state.subscribe === 'function') {
      this.jobsUnsub = state.subscribe(() => { this.syncJobs() })
    }
    this.watchJobs(this.currentId)
    return () => { if (this.jobsApi === jobs) this.detachJobs() }
  }

  /**
   * Release the current roster stream and its model subscription.
   * @returns undefined
   */
  detachJobs() {
    if (this.jobRelease !== null) {
      try { this.jobRelease() } catch (_error) { /* already gone */ }
      this.jobRelease = null
    }
    if (this.jobsUnsub !== null) {
      try { this.jobsUnsub() } catch (_error) { /* already gone */ }
      this.jobsUnsub = null
    }
    this.jobsApi = null
    this.jobTasks = []
    this.rebuildTasks()
  }

  /**
   * Watch one session's job roster.
   * @param id - session identity, or null.
   * @returns undefined
   */
  watchJobs(id) {
    if (this.jobRelease !== null) {
      try { this.jobRelease() } catch (_error) { /* already gone */ }
      this.jobRelease = null
    }
    this.jobTasks = []
    if (this.jobsApi !== null && id !== null && typeof this.jobsApi.watchRows === 'function') {
      try {
        this.jobRelease = this.jobsApi.watchRows(id)
      } catch (_error) {
        this.jobRelease = null
      }
    }
    this.syncJobs()
    this.rebuildTasks()
  }

  /** Re-project the live job rows for the selected session. */
  syncJobs() {
    let rows = []
    if (this.jobsApi !== null && this.currentId !== null) {
      const state = this.jobsApi.state || this.jobsApi.model
      const snapshot = state !== null && state !== undefined && typeof state.getSnapshot === 'function'
        ? state.getSnapshot()
        : null
      const bySession = snapshot !== null && snapshot !== undefined ? snapshot.rows : null
      if (bySession !== null && bySession !== undefined) {
        const key = String(this.currentId)
        if (Array.isArray(bySession[key])) rows = bySession[key]
      }
    }
    const next = tasksFromJobs(rows)
    if (!sameTasks(this.jobTasks, next)) {
      this.jobTasks = next
      this.rebuildTasks()
    }
  }

  /**
   * Merge job tasks and live tool calls into the task list.
   * @returns undefined
   */
  rebuildTasks() {
    const next = sortTasks([...this.jobTasks, ...this.toolCalls.values()])
    if (!sameTasks(this.tasks, next)) {
      this.tasks = next
      this.publish()
    }
  }

  /** Recompute the current main session and rewire projection subscriptions. */
  syncSession() {
    const sessions = this.ctx.sessions
    if (sessions === null || sessions === undefined || sessions.list === undefined) return
    const list = sessions.list.getSnapshot()
    let id = null
    for (const candidate of list.ids) {
      const row = list.byId[candidate]
      if (row !== undefined && (row.retainedBy?.mainView || 0) > 0) { id = candidate; break }
    }
    if (id !== this.currentId) {
      this.unsubscribeSession()
      this.currentId = id
      this.projections = { tokenUsage: null, contextPressure: null, contextBreakdown: null }
      this.liveKeys.clear()
      if (id !== null) this.subscribeSession(id)
      this.watchJobs(id)
    } else if (id !== null && this.sessionUnsubs.length === 0) {
      // A retained generation may appear after the list row did; retry once the
      // binding exists so live projections replace the summary fallback.
      this.subscribeSession(id)
    }
    this.consumeSummary(list)
    this.publish()
  }

  /**
   * Subscribe to the live projection faces of one retained session.
   * @param id - session identity.
   * @returns undefined
   */
  subscribeSession(id) {
    const sessions = this.ctx.sessions
    const binding = typeof sessions.binding === 'function' ? sessions.binding(id) : undefined
    if (binding === undefined || binding === null) return
    this.subscribeEvents(binding)
    const projections = binding.session?.projections
    if (projections === null || projections === undefined || typeof projections.faceOf !== 'function') return
    for (const key of ['tokenUsage', 'contextPressure', 'contextBreakdown']) {
      const source = projections.faceOf(key)
      if (source === null || source === undefined) continue
      this.projections[key] = source.getSnapshot() ?? null
      this.liveKeys.add(key)
      const unsubscribe = source.subscribe(() => {
        this.projections[key] = source.getSnapshot() ?? null
        this.onProjection(key)
      })
      this.sessionUnsubs.push(unsubscribe)
    }
    this.onProjection('tokenUsage')
    this.onProjection('contextPressure')
  }

  /**
   * Subscribe to the current session's tool-call event window. The event feed
   * is the only source for synchronous tool calls; `ctx.jobs` only carries
   * durable background jobs.
   * @param binding - session binding.
   * @returns undefined
   */
  subscribeEvents(binding) {
    const source = binding.eventSource
    if (source === null || source === undefined
      || typeof source.getSnapshot !== 'function' || typeof source.subscribe !== 'function') return
    const snapshot = source.getSnapshot()
    this.foldEvents(snapshot !== null && snapshot !== undefined ? snapshot.entries : [], true)
    const unsubscribe = source.subscribe(() => {
      const next = source.getSnapshot()
      if (next === null || next === undefined) return
      const change = next.change
      if (change !== null && change !== undefined && change.kind === 'append'
        && Array.isArray(change.entries)) {
        this.foldEvents(change.entries, false)
        return
      }
      this.foldEvents(Array.isArray(next.entries) ? next.entries : [], true)
    })
    this.sessionUnsubs.push(unsubscribe)
  }

  /**
   * Fold tool/call and tool/result events into the live call map.
   * @param entries - event window entries.
   * @param reset - rebuild from scratch instead of applying a live append.
   * @returns undefined
   */
  foldEvents(entries, reset) {
    if (!Array.isArray(entries)) return
    if (reset) this.toolCalls.clear()
    for (const entry of entries) {
      const event = entry !== null && entry !== undefined && entry.event !== undefined ? entry.event : entry
      if (event === null || event === undefined || typeof event.type !== 'string') continue
      if (event.type === 'tool/call') {
        const task = taskFromToolCall(event)
        if (task !== null) this.toolCalls.set(task.id, task)
      } else if (event.type === 'tool/result') {
        const callId = event.data?.message?.source?.callId
        if (typeof callId === 'string' && callId !== '') this.toolCalls.delete(`tool-${callId}`)
      } else if (event.type === 'turn/start' || event.type === 'turn/end') {
        this.toolCalls.clear()
      }
    }
    this.rebuildTasks()
  }

  /** Tear down the current session projection subscriptions. */
  unsubscribeSession() {
    for (const unsubscribe of this.sessionUnsubs) {
      try { unsubscribe() } catch (_error) { /* already gone */ }
    }
    this.sessionUnsubs = []
    this.liveKeys.clear()
    this.toolCalls.clear()
    this.rebuildTasks()
  }

  /**
   * Use list-summary projection values for keys without a live face.
   * @param list - session list snapshot.
   * @returns undefined
   */
  consumeSummary(list) {
    if (this.currentId === null) return
    const row = list.byId[this.currentId]
    const values = row?.projectionValues
    if (values === null || values === undefined) return
    for (const key of ['tokenUsage', 'contextPressure', 'contextBreakdown']) {
      if (this.liveKeys.has(key)) continue
      if (values[key] === undefined) continue
      const changed = this.projections[key] !== values[key]
      this.projections[key] = values[key]
      if (key === 'tokenUsage' && changed) this.onProjection('tokenUsage')
      if (key === 'contextPressure' && changed) this.onProjection('contextPressure')
    }
  }

  /**
   * React to one projection value.
   * @param key - projection key.
   * @returns undefined
   */
  onProjection(key) {
    const now = this.now()
    if (key === 'tokenUsage' && this.currentId !== null && this.prefs.stats.enabled) {
      const next = addUsage(this.stats, this.currentId, this.projections.tokenUsage, now)
      if (next !== this.stats) {
        this.stats = next
        saveStoredJson(STORAGE_KEYS.stats, this.stats)
      }
    }
    if (key === 'contextPressure') this.checkContext(now)
    this.publish()
  }

  /**
   * Apply a root `useSessionStatus` snapshot. Called from a React effect; the
   * store itself never calls hooks.
   * @param statuses - SessionStatusSnapshot map.
   * @returns undefined
   */
  applyStatuses(statuses) {
    if (statuses === null || statuses === undefined || this.disposed) return
    const now = this.now()
    const nextIndex = {}
    const previous = this.statusPrev
    statuses.forEach((status, id) => {
      const pendingKey = status.pendingInteraction !== null && status.pendingInteraction !== undefined
        ? String(status.pendingInteraction.key || '')
        : null
      const pendingKind = status.pendingInteraction !== null && status.pendingInteraction !== undefined
        ? String(status.pendingInteraction.kind || '')
        : ''
      nextIndex[id] = {
        running: status.running === true,
        waiting: pendingKey !== null,
        completionUnread: status.completionUnread === true,
        pendingKey,
        pendingKind,
      }
      const before = mapGet(previous, id)
      const lastError = this.sessionLastError(id)
      const isCurrent = id === this.currentId
      if (before !== undefined && before.running === true && status.running !== true) {
        if (isCurrent) {
          if (lastError !== null && lastError !== '') {
            this.sadUntil = now + 8000
            this.pushBubble('error', 'turn-error', { title: this.sessionTitle(id) }, {
              ttl: 8000, keyText: 'bubble.turnError',
            })
          } else if (this.prefs.alerts.completion) {
            this.happyUntil = now + 6000
            this.pushBubble('completion', 'turn-done', { title: this.sessionTitle(id) }, {
              ttl: 6000, sound: true, keyText: 'bubble.turnDone',
            })
          }
        } else if (this.prefs.alerts.background && status.completionUnread === true) {
          this.alertBackground(id, now)
        }
      }
      if (id !== this.currentId && status.completionUnread === true && (before === undefined || before.completionUnread !== true)) {
        if (this.prefs.alerts.background) this.alertBackground(id, now)
      }
      if (status.completionUnread !== true) this.backgroundAlerted.delete(id)
      if (pendingKey !== null && (before === undefined || before.pendingKey !== pendingKey)) {
        if (this.prefs.alerts.waiting) this.alertWaiting(id, pendingKey, pendingKind, isCurrent, now)
      }
      if (pendingKey === null && before !== undefined && before.pendingKey !== null) {
        this.waitingAlerted.delete(waitingToken(id, before.pendingKey))
        if (this.bubble !== null && this.bubble.key === 'waiting:' + id + ':' + before.pendingKey) {
          this.bubble = null
        }
      }
    })
    for (const id of previous.keys()) {
      if (!mapHas(statuses, id)) {
        const before = previous.get(id)
        if (before !== undefined && before.pendingKey !== null) this.waitingAlerted.delete(waitingToken(id, before.pendingKey))
      }
    }
    this.statusPrev = new Map(Object.entries(nextIndex))
    this.statusIndex = nextIndex
    this.publish()
  }

  /**
   * Push a background completion alert once per completion generation.
   * @param id - session identity.
   * @param now - epoch ms.
   * @returns undefined
   */
  alertBackground(id, now) {
    if (this.backgroundAlerted.has(id)) return
    this.backgroundAlerted.add(id)
    this.pushBubble('completion', 'background:' + id, { title: this.sessionTitle(id) }, {
      ttl: 7000,
      action: 'openSession',
      sessionId: id,
      sound: true,
      keyText: 'bubble.backgroundDone',
    })
    void now
  }

  /**
   * Push a waiting-for-user alert once per interaction key.
   * @param id - session identity.
   * @param pendingKey - interaction key.
   * @param pendingKind - interaction kind.
   * @param isCurrent - whether this is the current main session.
   * @param now - epoch ms.
   * @returns undefined
   */
  alertWaiting(id, pendingKey, pendingKind, isCurrent, now) {
    const token = waitingToken(id, pendingKey)
    if (this.waitingAlerted.has(token)) return
    this.waitingAlerted.add(token)
    const key = pendingKind.indexOf('plan') >= 0 ? 'bubble.waitingApproval' : 'bubble.waitingQuestion'
    this.pushBubble('waiting', 'waiting:' + id + ':' + pendingKey, {}, {
      keyText: key,
      sticky: isCurrent,
      action: 'openSession',
      sessionId: id,
      ttl: isCurrent ? 0 : 9000,
      sound: isCurrent,
    })
    void now
  }

  /**
   * Read a session's latest agent error.
   * @param id - session identity.
   * @returns error text, or null.
   */
  sessionLastError(id) {
    const sessions = this.ctx.sessions
    const binding = typeof sessions.binding === 'function' ? sessions.binding(id) : undefined
    const face = binding?.session
    if (face === null || face === undefined || typeof face.getSnapshot !== 'function') return null
    const value = face.getSnapshot()?.lastAgentError
    return value === null || value === undefined ? null : String(value)
  }

  /**
   * Read a session display title.
   * @param id - session identity.
   * @returns title.
   */
  sessionTitle(id) {
    const row = this.ctx.sessions.list.getSnapshot().byId[id]
    return row === undefined ? this.translate('status.session') : row.displayTitle
  }

  /* ------------------------------------------------------------------ */
  /* account                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Refresh account state and balance.
   * @param force - bypass the polling interval.
   * @returns completion.
   */
  async refreshAccount(force) {
    const api = this.accountApi
    if (api === null || api === undefined || this.disposed) return
    if (this.accountInFlight) return
    if (!force && !this.accountAllowed) return
    if (!force && !this.accountDue()) return
    this.accountInFlight = true
    this.lastAccountAttempt = this.now()
    try {
      const stateResult = await api.getState()
      if (stateResult === null || stateResult === undefined || stateResult.ok !== true) {
        this.failAccount(stateResult?.error?.code)
        return
      }
      const view = stateResult.value
      const links = view?.links || null
      if (view?.status !== 'credential-stored') {
        this.account = {
          phase: 'signed-out', primary: null, wallets: [], bonus: [], links,
          refreshedAt: this.now(), errorCode: null,
        }
        this.accountFailures = 0
        return
      }
      const balanceResult = await api.getBalance(this.clientMeta())
      if (balanceResult === null || balanceResult === undefined || balanceResult.ok !== true) {
        this.failAccount(balanceResult?.error?.code)
        return
      }
      const value = balanceResult.value
      if (value === null || value === undefined) {
        this.account = {
          phase: 'unavailable', primary: null, wallets: [], bonus: [], links,
          refreshedAt: this.now(), errorCode: null,
        }
        this.accountFailures = 0
        return
      }
      if (value.status === 'failed') {
        this.failAccount('balance')
        return
      }
      const wallets = mapWallets(value.value)
      const bonus = mapWallets(value.bonusWallets)
      this.account = {
        phase: 'ready',
        primary: pickPrimary(wallets),
        wallets,
        bonus,
        links,
        refreshedAt: this.now(),
        errorCode: null,
      }
      this.accountFailures = 0
      if (this.account.primary !== null) {
        this.stats = observeBalance(this.stats, this.account.primary.currency, this.account.primary.amount, this.now())
        saveStoredJson(STORAGE_KEYS.stats, this.stats)
        this.checkLowBalance()
      }
    } catch (_error) {
      this.accountFailures += 1
      this.account = {
        ...this.account,
        phase: 'error',
        refreshedAt: this.now(),
        errorCode: 'network',
      }
    } finally {
      this.accountInFlight = false
      this.publish()
    }
  }

  /**
   * Record one failed account read.
   * @param code - remote error code.
   * @returns undefined
   */
  failAccount(code) {
    this.accountFailures += 1
    this.account = {
      ...this.account,
      phase: 'error',
      refreshedAt: this.now(),
      errorCode: code === undefined || code === null ? 'unknown' : String(code),
    }
  }

  /**
   * Whether the polling interval has elapsed.
   * @returns boolean.
   */
  accountDue() {
    const seconds = this.prefs.account.refreshSeconds
    if (seconds <= 0) return false
    const base = seconds * 1000
    const backoff = Math.min(5 * 60 * 1000, base * Math.pow(2, this.accountFailures))
    return this.now() - this.lastAccountAttempt >= backoff
  }

  /**
   * Client identity for the account Remote.
   * @returns metadata.
   */
  clientMeta() {
    const release = globalThis.__DSH_BOOT__ !== undefined && globalThis.__DSH_BOOT__ !== null
      ? globalThis.__DSH_BOOT__.release
      : undefined
    const version = release !== undefined && release !== null && typeof release.version === 'string' && release.version !== ''
      ? release.version
      : '0.0.0'
    return {
      version,
      locale: this.localeActive(),
      timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    }
  }

  /**
   * Fire a low-balance bubble when the primary wallet crosses the threshold.
   * @returns undefined
   */
  checkLowBalance() {
    if (!this.prefs.alerts.lowBalance) return
    const primary = this.account.primary
    if (primary === null) return
    const configured = this.prefs.alerts.lowBalanceCurrency
    const wallet = configured === 'auto'
      ? primary
      : this.account.wallets.find(item => item.currency === configured) || null
    if (wallet === null) return
    const threshold = this.prefs.alerts.lowBalanceThreshold
    if (wallet.amount >= threshold) {
      this.lastBalanceAlertAt = 0
      return
    }
    const now = this.now()
    if (!decideBalanceAlert(wallet.amount, threshold, this.lastBalanceAlertAt, now)) return
    this.lastBalanceAlertAt = now
    this.pushBubble('balance', 'low-balance', {
      amount: formatMoney(wallet.currency, wallet.amount, this.localeActive()),
    }, { ttl: 60000, action: 'topUp', force: true, keyText: 'bubble.lowBalance' })
  }

  /* ------------------------------------------------------------------ */
  /* alerts and bubbles                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Evaluate context thresholds for the current session.
   * @param now - epoch ms.
   * @returns undefined
   */
  checkContext(now) {
    if (!this.prefs.alerts.context) return
    const percent = contextOccupancy(this.projections.contextPressure)
    if (percent === null) return
    const id = this.currentId === null ? 'none' : this.currentId
    const previous = this.contextLevels.get(id) || 'ok'
    const decision = decideContextAlert(
      percent, previous, this.prefs.alerts.contextWarn, this.prefs.alerts.contextDanger,
    )
    this.contextLevels.set(id, decision.level)
    if (decision.alert === 'warn') {
      this.pushBubble('warn', 'context-warn:' + id, { percent: formatPercent(percent) }, {
        ttl: 10000,
        action: 'copyCompact',
        keyText: 'bubble.contextWarn',
      })
    }
    if (decision.alert === 'danger') {
      this.pushBubble('danger', 'context-danger:' + id, { percent: formatPercent(percent) }, {
        ttl: 15000,
        action: 'copyCompact',
        keyText: 'bubble.contextDanger',
      })
    }
    void now
  }

  /**
   * Offer one bubble according to the priority policy.
   * @param tone - bubble tone.
   * @param key - stable dedupe key.
   * @param params - interpolation values.
   * @param options - ttl, action, session, sticky, keyText, force, sound.
   * @returns undefined
   */
  pushBubble(tone, key, params, options) {
    const settings = options || {}
    const now = this.now()
    const bubble = makeBubble({
      seq: ++this.bubbleSeq,
      key,
      tone,
      params,
      action: settings.action || null,
      sessionId: settings.sessionId || null,
      sticky: settings.sticky === true,
      ttlMs: settings.ttl !== undefined ? settings.ttl : TONE_TTL[tone],
      now,
    })
    bubble.textKey = settings.keyText || 'bubble.' + tone
    const replace = settings.force === true
      ? !(this.bubble !== null && this.bubble.sticky)
      : shouldReplaceBubble(this.bubble, bubble)
    if (!replace) return
    this.bubble = bubble
    if (settings.sound === true && this.prefs.alerts.sound) playChime(tone)
    this.maybeNotify(bubble)
    this.publish()
  }

  /**
   * Send an OS notification for a bubble when enabled and the page is hidden.
   * @param bubble - bubble.
   * @returns undefined
   */
  maybeNotify(bubble) {
    if (!this.prefs.alerts.notifications) return
    if (bubble.tone === 'idle' || bubble.tone === 'warn') return
    if (typeof document === 'undefined' || !document.hidden) return
    const text = this.bubbleText(bubble)
    sendNotification(this.translate('notify.title'), text, () => {
      if (typeof window !== 'undefined') window.focus()
      this.runAction(bubble.action, bubble.sessionId)
    })
  }

  /**
   * Render a bubble's localized text.
   * @param bubble - bubble.
   * @returns text.
   */
  bubbleText(bubble) {
    if (bubble === null) return ''
    return this.translate(bubble.textKey, bubble.params)
  }

  /**
   * Execute a bubble action.
   * @param action - action id.
   * @param sessionId - optional session target.
   * @returns undefined
   */
  runAction(action, sessionId) {
    if (action === 'topUp') {
      openExternal(this.account.links?.topUpUrl)
      return
    }
    if (action === 'usage') {
      openExternal(this.account.links?.usageUrl)
      return
    }
    if (action === 'copyCompact') {
      void copyText('/compact').then((ok) => {
        if (ok) this.pushBubble('idle', 'copied-compact', {}, { ttl: 3000, force: true, keyText: 'bubble.copiedCompact' })
      })
      return
    }
    if (action === 'openSession') this.openSession(sessionId)
  }

  /**
   * Dismiss one bubble by sequence number.
   * @param seq - bubble sequence.
   * @returns undefined
   */
  dismissBubble(seq) {
    if (this.bubble !== null && this.bubble.seq === seq) {
      this.bubble = null
      this.publish()
    }
  }

  /* ------------------------------------------------------------------ */
  /* timers                                                             */
  /* ------------------------------------------------------------------ */

  /** One-second tick: expiry, focus, water, polling, rollover. */
  tick() {
    if (this.disposed) return
    const now = this.now()
    this.syncFrame()
    let changed = false
    if (this.bubble !== null && isBubbleExpired(this.bubble, now)) {
      this.bubble = null
      changed = true
    }
    if (this.demo !== null && now >= this.demo.until) {
      this.demo = null
      if (this.bubble !== null && this.bubble.key === 'demo-waiting') this.bubble = null
      changed = true
    }
    const focusResult = tickFocus(this.focus, now)
    if (focusResult.completed !== null) {
      this.focus = focusResult.state
      if (focusResult.completed === 'focus') {
        this.pushBubble('focus', 'focus-done', {}, { ttl: 6000, sound: true, keyText: 'bubble.focusDone' })
        if (this.prefs.focus.enabled && this.prefs.focus.autoBreak) {
          this.focus = startFocus('break', this.prefs.focus.breakMinutes, now)
        }
      } else {
        this.pushBubble('focus', 'break-done', {}, { ttl: 6000, sound: true, keyText: 'bubble.breakDone' })
      }
      changed = true
    }
    if (this.prefs.focus.enabled && this.prefs.focus.waterMinutes > 0) {
      if (now - this.lastWaterAt >= this.prefs.focus.waterMinutes * 60 * 1000) {
        this.lastWaterAt = now
        this.pushBubble('water', 'water', {}, { ttl: 6000, keyText: 'bubble.water' })
      }
    }
    const rolled = rollStats(this.stats, now)
    if (rolled !== this.stats) {
      this.stats = rolled
      saveStoredJson(STORAGE_KEYS.stats, this.stats)
      changed = true
    }
    if (this.accountApi !== null && !this.accountInFlight && this.accountDue()) {
      void this.refreshAccount(false)
    }
    this.publish()
  }

  /* ------------------------------------------------------------------ */
  /* actions                                                            */
  /* ------------------------------------------------------------------ */

  /** Record user activity, waking a sleepy pet. */
  markActivity() {
    this.lastActivityAt = this.now()
  }

  /** Interact with the pet: a random line and a short happy reaction. */
  interact() {
    this.markActivity()
    this.happyUntil = this.now() + 1500
    const key = this.prefs.randomLines
      ? IDEA_KEYS[Math.floor(Math.random() * IDEA_KEYS.length)]
      : 'bubble.idle1'
    this.pushBubble('idle', 'idle:' + this.bubbleSeq, {}, { ttl: 4500, keyText: key, force: true })
  }

  /**
   * Persist a preference patch.
   * @param patch - partial preferences.
   * @returns undefined
   */
  setPrefs(patch) {
    this.prefs = mergePrefs(this.prefs, patch)
    saveStoredJson(STORAGE_KEYS.prefs, this.prefs)
    this.publish()
  }

  /**
   * Persist the pet's desktop position. The stored coordinate is the pet's
   * top-left in screen space, so moving the DSH window does not move the pet.
   * Legacy `{ right, bottom }` calls are converted once, for old tests and
   * settings.
   * @param position - screen `{ x, y }`, or legacy viewport `{ right, bottom }`.
   * @returns undefined
   */
  setPosition(position) {
    const size = this.petSize()
    const frame = this.readFrame()
    let next
    if (position !== null && position !== undefined
      && hasNumber(position.x) && hasNumber(position.y)) {
      next = { x: Number(position.x), y: Number(position.y) }
    } else {
      next = {
        x: frame.contentX + frame.width - (Number(position?.right) || 0) - size,
        y: frame.contentY + frame.height - (Number(position?.bottom) || 0) - size,
      }
    }
    const clamped = clampScreenPosition(next, frame, size)
    this.frame = frame
    this.prefs = mergePrefs(this.prefs, {
      position: {
        x: clamped.x,
        y: clamped.y,
        right: Math.max(0, frame.width - (clamped.x - frame.contentX) - size),
        bottom: Math.max(0, frame.height - (clamped.y - frame.contentY) - size),
      },
    })
    saveStoredJson(STORAGE_KEYS.prefs, this.prefs)
    this.publish()
  }

  /** Reset the pet to the current window's bottom-right corner. */
  resetPosition() {
    const frame = this.readFrame()
    const size = this.petSize()
    this.setPosition({
      x: frame.contentX + frame.width - DEFAULT_PREFS.position.right - size,
      y: frame.contentY + frame.height - DEFAULT_PREFS.position.bottom - size,
    })
    this.pushBubble('idle', 'position-reset', {}, { ttl: 2500, force: true, keyText: 'bubble.positionReset' })
  }

  /**
   * Import a custom skin pack from JSON text.
   * @param text - JSON text.
   * @returns `{ ok, error? }`.
   */
  importSkin(text) {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (_error) {
      return { ok: false, error: this.translate('skin.invalid') }
    }
    const checked = validateSkinPack(parsed)
    if (!checked.ok) return { ok: false, error: this.translate(checked.error) }
    const existing = this.customSkins.findIndex(skin => skin.id === checked.skin.id)
    if (existing >= 0) this.customSkins = this.customSkins.map((skin, index) => index === existing ? checked.skin : skin)
    else this.customSkins = this.customSkins.concat([checked.skin])
    saveStoredJson(STORAGE_KEYS.skins, this.customSkins)
    this.setPrefs({ skinId: checked.skin.id })
    this.pushBubble('completion', 'skin-imported', {}, { ttl: 3000, force: true, keyText: 'bubble.skinImported' })
    return { ok: true }
  }

  /**
   * Remove one custom skin.
   * @param id - skin id.
   * @returns undefined
   */
  removeSkin(id) {
    this.customSkins = this.customSkins.filter(skin => skin.id !== id)
    saveStoredJson(STORAGE_KEYS.skins, this.customSkins)
    if (this.prefs.skinId === id) this.setPrefs({ skinId: 'kuro' })
    this.pushBubble('idle', 'skin-removed', {}, { ttl: 3000, force: true, keyText: 'bubble.skinRemoved' })
    this.publish()
  }

  /**
   * Serialize one skin for download.
   * @param id - skin id.
   * @returns JSON text, or ''.
   */
  exportSkin(id) {
    const skin = allSkins(this.customSkins).find(item => item.id === id)
    return skin === undefined ? '' : exportSkin(skin)
  }

  /**
   * Export preferences and custom skins as one JSON document.
   * @returns JSON text.
   */
  exportSettings() {
    return JSON.stringify({ format: 1, prefs: this.prefs, skins: this.customSkins }, null, 2)
  }

  /**
   * Import preferences and skins from one JSON document.
   * @param text - JSON text.
   * @returns `{ ok, error? }`.
   */
  importSettings(text) {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (_error) {
      return { ok: false, error: this.translate('skin.invalid') }
    }
    if (parsed === null || typeof parsed !== 'object' || parsed.format !== 1) {
      return { ok: false, error: this.translate('skin.format') }
    }
    this.prefs = normalizePrefs(parsed.prefs)
    this.customSkins = normalizeCustomSkins(parsed.skins)
    saveStoredJson(STORAGE_KEYS.prefs, this.prefs)
    saveStoredJson(STORAGE_KEYS.skins, this.customSkins)
    this.pushBubble('completion', 'settings-imported', {}, { ttl: 3000, force: true, keyText: 'bubble.settingsImported' })
    this.publish()
    return { ok: true }
  }

  /** Clear daily statistics and per-session baselines. */
  resetStats() {
    this.stats = createStats(this.now())
    saveStoredJson(STORAGE_KEYS.stats, this.stats)
    this.pushBubble('idle', 'stats-cleared', {}, { ttl: 3000, force: true, keyText: 'bubble.statsCleared' })
    this.publish()
  }

  /**
   * Focus timer action.
   * @param action - start, pause, resume or reset.
   * @returns undefined
   */
  focusAction(action) {
    const now = this.now()
    if (action === 'start') {
      this.focus = startFocus('focus', this.prefs.focus.focusMinutes, now)
      this.lastWaterAt = now
      this.pushBubble('idle', 'focus-start', {}, { ttl: 3000, force: true, keyText: 'bubble.focusStart' })
    } else if (action === 'pause') {
      this.focus = pauseFocus(this.focus, now)
      this.pushBubble('idle', 'focus-pause', {}, { ttl: 2500, force: true, keyText: 'bubble.focusPause' })
    } else if (action === 'resume') {
      this.focus = resumeFocus(this.focus, now)
      this.pushBubble('idle', 'focus-start', {}, { ttl: 2500, force: true, keyText: 'bubble.focusStart' })
    } else if (action === 'reset') {
      this.focus = resetFocus()
      this.pushBubble('idle', 'focus-reset', {}, { ttl: 2500, force: true, keyText: 'bubble.focusReset' })
    }
    this.publish()
  }

  /**
   * Turn on a demo override for screenshots and QA.
   * @param kind - demo kind, or `stop`.
   * @returns undefined
   */
  demoMode(kind) {
    if (kind === 'stop') {
      this.demo = null
    } else {
      this.demo = { kind, until: this.now() + 30000 }
      if (kind === 'waiting') this.pushBubble('waiting', 'demo-waiting', {}, {
        sticky: true, force: true, keyText: 'bubble.waitingQuestion',
      })
      if (kind === 'lowBalance') {
        this.lastBalanceAlertAt = 0
        this.pushBubble('balance', 'demo-balance', { amount: '¥1.00' }, {
          force: true, ttl: 30000, keyText: 'bubble.lowBalance',
        })
      }
    }
    this.publish()
  }

  /**
   * Open an external account page from the quick menu.
   * @param kind - topUp or usage.
   * @returns undefined
   */
  openLink(kind) {
    this.runAction(kind)
  }

  /**
   * Jump to a session in the workspace UI.
   * @param id - session identity.
   * @returns undefined
   */
  openSession(id) {
    if (id === null || id === undefined || id === '') return
    const workspace = this.workspace
    if (workspace !== null && workspace !== undefined && typeof workspace.openSession === 'function') {
      Promise.resolve(workspace.openSession(id)).catch(() => {})
    }
    if (this.bubble !== null) {
      this.bubble = null
      this.publish()
    }
  }

  /**
   * Copy a compact Markdown summary of the session and today's stats.
   * @returns completion.
   */
  async copySummary() {
    const snap = this.getSnapshot()
    const lines = []
    lines.push('# ' + snap.name + ' \u00b7 ' + dayKey(this.now()))
    if (snap.session !== null) {
      lines.push('- ' + this.translate('status.session') + ': ' + snap.session.title)
      if (snap.session.tokens !== null) {
        lines.push('- ' + this.translate('status.tokens') + ': ' + formatCompactNumber(snap.session.tokens.total)
          + ' (' + this.translate('panel.uncachedInput') + ' ' + formatCompactNumber(snap.session.tokens.uncachedInputTokens)
          + ', ' + this.translate('panel.output') + ' ' + formatCompactNumber(snap.session.tokens.outputTokens) + ')')
      }
      if (snap.contextPercent !== null) lines.push('- ' + this.translate('status.context') + ': ' + formatPercent(snap.contextPercent))
    } else {
      lines.push('- ' + this.translate('status.noSession'))
    }
    if (snap.account.primary !== null) {
      lines.push('- ' + this.translate('status.balance') + ': ' + formatMoney(snap.account.primary.currency, snap.account.primary.amount, snap.language))
    }
    lines.push('- ' + this.translate('status.todayTokens') + ': ' + formatCompactNumber(snap.stats.total))
    const ok = await copyText(lines.join('\n'))
    this.pushBubble('idle', ok ? 'copied-summary' : 'copy-failed', {}, {
      ttl: 3000, force: true, keyText: ok ? 'bubble.copiedSummary' : 'bubble.copyFailed',
    })
  }

  /* ------------------------------------------------------------------ */
  /* snapshot                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Build the immutable snapshot consumed by React.
   * @returns snapshot.
   */
  buildSnapshot() {
    const now = this.now()
    const language = resolveLanguage(this.prefs.language, this.localeActive())
    const skins = allSkins(this.customSkins)
    const skin = findSkin(skins, this.prefs.skinId)
    const session = this.sessionSnapshot(now)
    const account = this.accountSnapshot()
    const focus = this.focusSnapshot(now)
    const demo = this.demo !== null && now < this.demo.until ? this.demo.kind : null
    const state = this.deriveState(session, account, focus, demo, now)
    const contextPercent = session === null ? null : session.contextPercent
    const todayTokens = this.stats.today.tokens
    return {
      version: SNAPSHOT_VERSION,
      petVersion: PET_VERSION,
      language,
      prefs: this.prefs,
      skins,
      skin,
      skinName: skinLabel(skin, language),
      name: petDisplayName(this.prefs, skin, language),
      state,
      session,
      account,
      stats: {
        today: this.stats.today,
        total: todayTokenTotal(this.stats),
        tokens: todayTokens,
        balanceDelta: this.balanceDelta(),
        history: recentDays(this.stats, 7),
      },
      focus,
      bubble: this.bubble,
      tasks: demo === 'tasks' ? DEMO_TASKS : this.prefs.showTasks ? this.tasks : [],
      taskCount: demo === 'tasks' ? DEMO_TASKS.length : this.tasks.length,
      contextPercent,
      contextTone: contextTone(contextPercent, this.prefs.alerts.contextWarn, this.prefs.alerts.contextDanger),
      lowBalance: this.isLowBalance(account),
      demo,
      compact: this.isCompact(),
      layout: this.layoutSnapshot(),
      updatedAt: now,
    }
  }

  /**
   * Build the current-session snapshot, applying demo overrides.
   * @param now - epoch ms.
   * @returns session snapshot, or null.
   */
  sessionSnapshot(now) {
    if (this.currentId === null) return null
    const list = this.ctx.sessions.list.getSnapshot()
    const row = list.byId[this.currentId]
    let tokens = this.projections.tokenUsage
    let pressure = this.projections.contextPressure
    let breakdown = this.projections.contextBreakdown
    if (tokens === null && row?.projectionValues?.tokenUsage !== undefined) tokens = row.projectionValues.tokenUsage
    if (pressure === null && row?.projectionValues?.contextPressure !== undefined) pressure = row.projectionValues.contextPressure
    if (breakdown === null && row?.projectionValues?.contextBreakdown !== undefined) breakdown = row.projectionValues.contextBreakdown
    const status = this.statusIndex[this.currentId]
    let running = status !== undefined ? status.running : Boolean(row?.running)
    let waiting = status !== undefined ? status.waiting : false
    if (this.demo !== null && now < this.demo.until) {
      if (this.demo.kind === 'running') running = true
      if (this.demo.kind === 'waiting') waiting = true
      if (this.demo.kind === 'context90') {
        pressure = { pressureTokens: 90000, projectedTokens: 90000, contextWindow: 100000 }
        tokens = { uncachedInputTokens: 78000, outputTokens: 12000, cacheReadTokens: 41000, cacheWriteTokens: 3000 }
        breakdown = { systemTokens: 6000, toolsTokens: 9000, messageTokens: 96000 }
      }
    }
    return {
      id: this.currentId,
      title: row === undefined ? '' : row.displayTitle,
      running,
      waiting,
      tokens: tokens === null ? null : Object.assign({}, tokens, { total: totalTokens(tokens) }),
      pressure,
      breakdown,
      contextPercent: contextOccupancy(pressure),
    }
  }

  /**
   * Build the account snapshot, applying the low-balance demo.
   * @returns account snapshot.
   */
  accountSnapshot() {
    const account = this.account
    if (this.demo !== null && this.demo.kind === 'lowBalance') {
      return {
        ...account,
        phase: 'ready',
        primary: { currency: 'CNY', amount: 1, text: formatMoney('CNY', 1, this.localeActive()) },
        wallets: [{ currency: 'CNY', amount: 1, text: formatMoney('CNY', 1, this.localeActive()) }],
      }
    }
    return account
  }

  /**
   * Build the focus snapshot.
   * @param now - epoch ms.
   * @returns focus snapshot.
   */
  focusSnapshot(now) {
    const remaining = focusRemaining(this.focus, now)
    return {
      phase: this.focus.phase,
      paused: this.focus.paused,
      enabled: this.prefs.focus.enabled,
      remaining,
      clock: formatClock(remaining),
      label: this.translate(
        this.focus.phase === 'focus' ? 'focus.running' : this.focus.phase === 'break' ? 'focus.breaking' : 'focus.idle',
      ),
    }
  }

  /**
   * Derive the presentation state.
   * @param session - session snapshot.
   * @param account - account snapshot.
   * @param focus - focus snapshot.
   * @param demo - demo kind.
   * @param now - epoch ms.
   * @returns state key.
   */
  deriveState(session, account, focus, demo, now) {
    if (demo === 'happy') return 'happy'
    if (demo === 'sad') return 'sad'
    if (demo === 'running') return 'working'
    if (demo === 'tasks') return 'working'
    if (demo === 'waiting') return 'waiting'
    if (session !== null && session.waiting) return 'waiting'
    if (this.tasks.length > 0) return 'working'
    if (focus.phase === 'focus') return 'focusing'
    if (session !== null && session.running) return 'working'
    if (now < this.sadUntil) return 'sad'
    if (this.isLowBalance(account)) return 'sad'
    if (now < this.happyUntil) return 'happy'
    if (now - this.lastActivityAt > 10 * 60 * 1000) return 'sleepy'
    return 'idle'
  }

  /**
   * Whether the primary wallet is below the alert threshold.
   * @param account - account snapshot.
   * @returns boolean.
   */
  isLowBalance(account) {
    if (!this.prefs.alerts.lowBalance) return false
    if (account.phase !== 'ready' || account.primary === null) return false
    return account.primary.amount < this.prefs.alerts.lowBalanceThreshold
  }

  /**
   * Today's balance movement label value.
   * @returns delta, or null.
   */
  balanceDelta() {
    const primary = this.account.primary
    if (primary === null) return null
    return todayBalanceDelta(this.stats, primary.currency)
  }

  /**
   * Read the current window content frame in screen coordinates.
   * `screenX`/`screenY` are the outer window origin; the content box starts
   * below the title bar and inside any border. Both are DIPs, matching CSS px.
   * @returns content frame.
   */
  readFrame() {
    if (typeof window === 'undefined') {
      return { screenX: 0, screenY: 0, contentX: 0, contentY: 0, width: 1280, height: 800 }
    }
    const width = Number(window.innerWidth) || 0
    const height = Number(window.innerHeight) || 0
    const outerWidth = Number(window.outerWidth) || width
    const outerHeight = Number(window.outerHeight) || height
    const border = Math.max(0, (outerWidth - width) / 2)
    const chrome = Math.max(0, outerHeight - height)
    const screenX = Number(window.screenX) || 0
    const screenY = Number(window.screenY) || 0
    return {
      screenX,
      screenY,
      contentX: screenX + border,
      contentY: screenY + chrome,
      width,
      height,
    }
  }

  /** Start the frame watcher that keeps the pet on its desktop coordinate. */
  startFrameLoop() {
    if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') return
    const loop = () => {
      if (this.disposed) return
      this.syncFrame()
      this.frameRaf = requestAnimationFrame(loop)
    }
    this.frameRaf = requestAnimationFrame(loop)
  }

  /** Republish the layout only when the window content frame moved or resized. */
  syncFrame() {
    const next = this.readFrame()
    const current = this.frame || next
    if (next.contentX !== current.contentX || next.contentY !== current.contentY
      || next.width !== current.width || next.height !== current.height) {
      this.frame = next
      this.publish()
    } else {
      this.frame = next
    }
  }

  /**
   * Migrate legacy right/bottom preferences into desktop coordinates once.
   * @returns undefined
   */
  ensureScreenPosition() {
    const position = this.prefs.position
    if (hasNumber(position.x) && hasNumber(position.y)) return
    const frame = this.readFrame()
    const size = this.petSize()
    this.setPosition({
      x: frame.contentX + frame.width - (Number(position.right) || 0) - size,
      y: frame.contentY + frame.height - (Number(position.bottom) || 0) - size,
    })
  }

  /**
   * Resolve the stored screen position, converting legacy right/bottom once if
   * a snapshot is requested before start().
   * @returns screen `{ x, y }`.
   */
  resolvedScreenPosition() {
    const position = this.prefs.position
    if (hasNumber(position.x) && hasNumber(position.y)) {
      return { x: Number(position.x), y: Number(position.y) }
    }
    const frame = this.readFrame()
    const size = this.petSize()
    return {
      x: frame.contentX + frame.width - (Number(position.right) || 0) - size,
      y: frame.contentY + frame.height - (Number(position.bottom) || 0) - size,
    }
  }

  /**
   * Current pet layout in viewport coordinates plus its screen anchor.
   * @returns layout.
   */
  layoutSnapshot() {
    const frame = this.frame || this.readFrame()
    const size = this.petSize()
    const layout = screenLayout(this.resolvedScreenPosition(), frame, size)
    return {
      ...layout,
      size,
      contentX: frame.contentX,
      contentY: frame.contentY,
      width: frame.width,
      height: frame.height,
    }
  }

  /**
   * Current viewport.
   * @returns width/height.
   */
  viewport() {
    if (typeof window === 'undefined') return { width: 1280, height: 800 }
    return { width: window.innerWidth, height: window.innerHeight }
  }

  /**
   * Rendered pet size, including the compact scale.
   * @returns pixels.
   */
  petSize() {
    return Math.round(this.prefs.size * (this.isCompact() ? 0.75 : 1))
  }

  /**
   * Whether the window is too small for the full presentation.
   * @returns boolean.
   */
  isCompact() {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 760 || window.innerHeight < 560
  }

  /**
   * Active DSH locale.
   * @returns locale string.
   */
  localeActive() {
    const locale = this.ctx.locale
    if (locale !== null && locale !== undefined && typeof locale.getSnapshot === 'function') {
      const value = locale.getSnapshot()
      if (value !== null && value !== undefined && typeof value.active === 'string') return value.active
    }
    if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') return navigator.language
    return 'en'
  }

  /**
   * Translate a dictionary key for the current preferences.
   * @param key - dictionary key.
   * @param params - placeholders.
   * @returns localized text.
   */
  translate(key, params) {
    const language = resolveLanguage(this.prefs.language, this.localeActive())
    const dictionary = language === 'zh' ? zh : en
    const template = dictionary[key] !== undefined ? dictionary[key] : en[key]
    if (template === undefined) return key
    return formatTemplate(template, params)
  }

  /** Flush everything to localStorage. */
  persistAll() {
    saveStoredJson(STORAGE_KEYS.prefs, this.prefs)
    saveStoredJson(STORAGE_KEYS.skins, this.customSkins)
    saveStoredJson(STORAGE_KEYS.stats, this.stats)
  }
}

/**
 * Stable key for one pending interaction.
 * @param id - session id.
 * @param key - interaction key.
 * @returns token.
 */
function waitingToken(id, key) {
  return id + ':' + key
}

/**
 * Map wallet rows into a display shape.
 * @param rows - provider wallet rows.
 * @returns wallets.
 */
function mapWallets(rows) {
  if (!Array.isArray(rows)) return []
  const result = []
  for (const row of rows) {
    if (row === null || row === undefined) continue
    if (row.currency !== 'CNY' && row.currency !== 'USD') continue
    const amount = parseAmount(row.balance)
    if (amount === null) continue
    result.push({ currency: row.currency, amount, text: formatMoney(row.currency, amount, undefined) })
  }
  return result
}

/**
 * Pick the primary wallet: CNY, then USD, then first.
 * @param wallets - wallets.
 * @returns primary wallet, or null.
 */
function pickPrimary(wallets) {
  if (!Array.isArray(wallets) || wallets.length === 0) return null
  return wallets.find(wallet => wallet.currency === 'CNY')
    || wallets.find(wallet => wallet.currency === 'USD')
    || wallets[0]
}
