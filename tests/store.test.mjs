import test from 'node:test'
import assert from 'node:assert/strict'
import { PetStore } from '../src/client/store.js'
import { createBuckets } from '../src/shared/stats.js'

function makeFace(value) {
  let current = value
  const listeners = new Set()
  return {
    getSnapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next) {
      current = next
      for (const listener of [...listeners]) listener()
    },
  }
}

function makeContext(options = {}) {
  const faces = options.faces || {
    tokenUsage: makeFace({ uncachedInputTokens: 100, outputTokens: 20, cacheReadTokens: 10, cacheWriteTokens: 5 }),
    contextPressure: makeFace({ pressureTokens: 20000, contextWindow: 100000 }),
    contextBreakdown: makeFace({ systemTokens: 1000, toolsTokens: 2000, messageTokens: 3000 }),
  }
  const list = {
    ids: ['s1'],
    byId: {
      s1: {
        id: 's1',
        displayTitle: 'Demo session',
        running: false,
        retainedBy: { mainView: 1 },
        projectionValues: {},
      },
    },
    phase: 'ready',
    projectionsBySession: {},
  }
  const intervalFns = []
  const ctx = {
    sessions: {
      list: {
        getSnapshot: () => list,
        subscribe: () => () => {},
      },
      binding: () => ({
        session: {
          projections: { faceOf: (key) => faces[key] },
          getSnapshot: () => ({ lastAgentError: null }),
        },
      }),
    },
    locale: { getSnapshot: () => ({ active: options.locale || 'en' }) },
    interval: (callback) => {
      intervalFns.push(callback)
      return () => {
        const index = intervalFns.indexOf(callback)
        if (index >= 0) intervalFns.splice(index, 1)
      }
    },
  }
  return { ctx, list, faces, intervalFns }
}

test('store derives a session snapshot from live projections and summary', () => {
  const { ctx, faces } = makeContext()
  const store = new PetStore({ ctx, now: () => 1000 })
  store.start()
  let snap = store.getSnapshot()
  assert.equal(snap.session.title, 'Demo session')
  assert.equal(snap.session.tokens.total, 135)
  assert.equal(snap.contextPercent, 20)
  assert.equal(snap.stats.total, 0)

  faces.tokenUsage.set({ uncachedInputTokens: 200, outputTokens: 30, cacheReadTokens: 10, cacheWriteTokens: 5 })
  snap = store.getSnapshot()
  assert.equal(snap.session.tokens.total, 245)
  assert.equal(snap.stats.total, 110)
  store.dispose()
})

test('store applies prefs, clamps position and translates by language', () => {
  const { ctx } = makeContext()
  const store = new PetStore({ ctx, now: () => 1000 })
  store.start()
  store.setPrefs({ size: 999, language: 'zh' })
  const snap = store.getSnapshot()
  assert.equal(snap.prefs.size, 200)
  assert.equal(snap.language, 'zh')
  assert.equal(store.translate('state.working'), '工作中')
  store.setPrefs({ language: 'en' })
  assert.equal(store.translate('state.working'), 'working')
  store.setPosition({ right: 99999, bottom: 99999 })
  assert.equal(store.getSnapshot().prefs.position.right, 1280 - 200)
  assert.equal(store.getSnapshot().prefs.position.bottom, 800 - 200)
  store.dispose()
})

test('store raises completion, waiting and context bubbles', () => {
  const { ctx, faces } = makeContext()
  const store = new PetStore({ ctx, now: () => 1000 })
  store.start()
  const statuses = new Map()
  statuses.set('s1', { running: true, pendingInteraction: undefined, completionUnread: false })
  store.applyStatuses(statuses)
  assert.equal(store.getSnapshot().state, 'working')
  statuses.set('s1', { running: false, pendingInteraction: undefined, completionUnread: false })
  store.applyStatuses(statuses)
  assert.equal(store.getSnapshot().state, 'happy')
  assert.equal(store.getSnapshot().bubble.textKey, 'bubble.turnDone')

  const waiting = new Map()
  waiting.set('s1', {
    running: false,
    pendingInteraction: { key: 'ask-1', kind: 'approval', sessionId: 's1' },
    completionUnread: false,
  })
  store.applyStatuses(waiting)
  assert.equal(store.getSnapshot().state, 'waiting')
  assert.equal(store.getSnapshot().bubble.tone, 'waiting')
  const resolved = new Map()
  resolved.set('s1', { running: false, pendingInteraction: undefined, completionUnread: false })
  store.applyStatuses(resolved)
  assert.equal(store.getSnapshot().bubble, null)

  faces.contextPressure.set({ pressureTokens: 92000, contextWindow: 100000 })
  assert.equal(store.getSnapshot().contextPercent, 92)
  assert.equal(store.getSnapshot().bubble.tone, 'danger')
  store.dispose()
})

test('store reads balance, observes it and alerts under the threshold', async () => {
  const { ctx } = makeContext()
  const store = new PetStore({ ctx, now: () => 1000 })
  const api = {
    getState: async () => ({
      ok: true,
      value: {
        status: 'credential-stored',
        links: { topUpUrl: 'https://example.com/topup', usageUrl: 'https://example.com/usage' },
        attempt: null,
      },
    }),
    getBalance: async () => ({
      ok: true,
      value: {
        status: 'ready',
        value: [{ currency: 'CNY', balance: '5.00' }],
        bonusWallets: [{ currency: 'CNY', balance: '2.00' }],
      },
    }),
  }
  store.start()
  store.attachAccount(api)
  await new Promise(resolve => setTimeout(resolve, 0))
  const snap = store.getSnapshot()
  assert.equal(snap.account.phase, 'ready')
  assert.equal(snap.account.primary.amount, 5)
  assert.equal(snap.account.bonus[0].amount, 2)
  assert.equal(snap.lowBalance, true)
  assert.equal(snap.bubble.tone, 'balance')
  assert.equal(snap.stats.balanceDelta, 0)
  store.dispose()
})

test('store demo mode overrides presentation and expires', () => {
  let now = 1000
  const { ctx } = makeContext()
  const store = new PetStore({ ctx, now: () => now })
  store.start()
  store.demoMode('context90')
  let snap = store.getSnapshot()
  assert.equal(snap.demo, 'context90')
  assert.equal(snap.contextPercent, 90)
  assert.equal(snap.session.tokens.total, 134000)
  now += 31_000
  store.tick()
  snap = store.getSnapshot()
  assert.equal(snap.demo, null)
  store.dispose()
})

test('store starts empty and survives a missing session', () => {
  const { ctx, list } = makeContext()
  list.ids = []
  list.byId = {}
  const store = new PetStore({ ctx, now: () => 1000 })
  store.start()
  const snap = store.getSnapshot()
  assert.equal(snap.session, null)
  assert.equal(snap.state, 'idle')
  assert.equal(snap.contextPercent, null)
  store.dispose()
})

test('tick rolls the stats day and keeps the pet responsive', () => {
  let now = new Date(2026, 9, 30, 12).getTime()
  const { ctx } = makeContext()
  const store = new PetStore({ ctx, now: () => now })
  store.start()
  store.demoMode('happy')
  now += 31_000
  store.tick()
  assert.equal(store.getSnapshot().demo, null)
  assert.deepEqual(store.getSnapshot().stats.tokens, createBuckets())
  store.dispose()
})

function makeJobs(initialRows) {
  let rows = initialRows
  let watchedId = null
  let released = false
  const listeners = new Set()
  return {
    state: {
      getSnapshot: () => ({ rows, observed: {} }),
      subscribe: (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    watchRows(id) {
      watchedId = id
      return () => { released = true }
    },
    set(next) {
      rows = next
      for (const listener of [...listeners]) listener()
    },
    watched: () => watchedId,
    released: () => released,
  }
}

test('store projects running jobs into tasks and the busy state', () => {
  const { ctx } = makeContext()
  const store = new PetStore({ ctx, now: () => 1000 })
  store.start()
  const jobs = makeJobs({
    s1: [
      { id: 'job-1', kind: 'bash', label: '创建 V1.6.4 分支', status: 'running', progress: '正在运行命令', startedAt: 10 },
      { id: 'job-2', kind: 'bash', label: '完成', status: 'completed', startedAt: 20 },
    ],
  })
  store.attachJobs(jobs)
  assert.equal(jobs.watched(), 's1')
  let snap = store.getSnapshot()
  assert.equal(snap.tasks.length, 1)
  assert.equal(snap.tasks[0].label, '创建 V1.6.4 分支')
  assert.equal(snap.tasks[0].progress, '正在运行命令')
  assert.equal(snap.state, 'working')

  jobs.set({ s1: [{ id: 'job-1', kind: 'bash', label: '创建 V1.6.4 分支', status: 'stopping', progress: '', startedAt: 10 }] })
  snap = store.getSnapshot()
  assert.equal(snap.tasks[0].status, 'stopping')
  assert.equal(snap.state, 'working')

  jobs.set({ s1: [] })
  snap = store.getSnapshot()
  assert.equal(snap.tasks.length, 0)
  assert.equal(snap.state, 'idle')

  jobs.set({ s1: [{ id: 'job-3', kind: 'bash', label: 'Task', status: 'running', progress: '', startedAt: 30 }] })
  store.setPrefs({ showTasks: false })
  snap = store.getSnapshot()
  assert.equal(snap.tasks.length, 0)
  assert.equal(snap.state, 'working')

  store.dispose()
  assert.equal(jobs.released(), true)
})

test('store demo tasks show the task list without a job stream', () => {
  const { ctx } = makeContext()
  const store = new PetStore({ ctx, now: () => 1000 })
  store.start()
  store.demoMode('tasks')
  const snap = store.getSnapshot()
  assert.equal(snap.tasks.length, 2)
  assert.equal(snap.state, 'working')
  store.dispose()
})
