import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const bundle = readFileSync(resolve(ROOT, 'lib/client.js'), 'utf8')

function createReact(overrides = []) {
  let hookIndex = 0
  const React = {
    Fragment: Symbol.for('react.fragment'),
    createElement: (type, props, ...children) => ({
      type,
      props: props || {},
      children,
    }),
    useState: (initial) => {
      const index = hookIndex
      hookIndex += 1
      const value = overrides[index] !== undefined
        ? overrides[index]
        : (typeof initial === 'function' ? initial() : initial)
      return [value, () => {}]
    },
    useRef: (initial) => ({ current: initial }),
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
  }
  return {
    React,
    resetHooks() { hookIndex = 0 },
  }
}

function renderNode(node) {
  if (Array.isArray(node)) return node.map(renderNode)
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (typeof node.type === 'function') {
    return renderNode(node.type({
      ...node.props,
      children: node.children.length === 1 ? node.children[0] : node.children,
    }))
  }
  if (node.type === Symbol.for('react.fragment')) return renderNode(node.children)
  return { ...node, children: node.children.map(renderNode) }
}

function createEnvironment() {
  const registered = []
  const cleanup = []
  const doc = {
    hidden: false,
    visibilityState: 'visible',
    documentElement: { style: {} },
    body: { appendChild() {}, removeChild() {} },
    head: { appendChild() {} },
    createElement() {
      return {
        style: {},
        dataset: {},
        textContent: '',
        appendChild() {},
        remove() {},
        click() {},
        select() {},
        setAttribute() {},
      }
    },
    querySelector() { return null },
    execCommand() { return true },
    addEventListener() {},
    removeEventListener() {},
  }
  const storage = new Map()
  const sandbox = {
    console,
    document: doc,
    navigator: { language: 'en', clipboard: { writeText: async () => {} } },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => { storage.set(key, String(value)) },
      removeItem: (key) => { storage.delete(key) },
    },
    setTimeout: (callback) => { void callback; return 0 },
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    Intl,
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    Map,
    Set,
    Promise,
    Error,
    RegExp,
    Symbol,
    URL,
  }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox
  sandbox.window.__ModuleLoader__ = {
    load(spec) { registered.push(spec) },
  }
  sandbox.window.innerWidth = 1280
  sandbox.window.innerHeight = 800
  sandbox.window.addEventListener = () => {}
  sandbox.window.removeEventListener = () => {}
  sandbox.window.focus = () => {}
  sandbox.window.open = () => ({})
  return { sandbox, registered, cleanup, cleanups: cleanup, doc, storage }
}

function createContext(sandbox) {
  const facials = {
    tokenUsage: {
      getSnapshot: () => ({ uncachedInputTokens: 1200, outputTokens: 300, cacheReadTokens: 800, cacheWriteTokens: 40 }),
      subscribe: () => () => {},
    },
    contextPressure: {
      getSnapshot: () => ({ pressureTokens: 24000, projectedTokens: 26000, contextWindow: 100000 }),
      subscribe: () => () => {},
    },
    contextBreakdown: {
      getSnapshot: () => ({ systemTokens: 3000, toolsTokens: 2000, messageTokens: 21000 }),
      subscribe: () => () => {},
    },
  }
  const list = {
    ids: ['s1'],
    byId: {
      s1: {
        id: 's1',
        displayTitle: 'Bundle session',
        running: false,
        retainedBy: { mainView: 1 },
        projectionValues: {},
      },
    },
    phase: 'ready',
    projectionsBySession: {},
  }
  const account = {
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
        value: [{ currency: 'CNY', balance: '88.50' }],
        bonusWallets: [],
      },
    }),
  }
  const jobRows = {
    s1: [{
      id: 'job-1',
      kind: 'bash',
      label: '创建 V1.6.4 分支',
      status: 'running',
      progress: '正在运行命令',
      startedAt: 1,
    }],
  }
  const jobs = {
    state: {
      getSnapshot: () => ({ rows: jobRows, observed: {} }),
      subscribe: () => () => {},
    },
    watchRows: () => () => {},
    kill: async () => ({ ok: true }),
  }
  const toolCall = {
    type: 'tool/call',
    seq: 4,
    time: 200,
    data: {
      callId: 'call-bundle',
      name: 'pwsh',
      arguments: JSON.stringify({ description: '运行单元测试', command: 'npm test' }),
    },
  }
  const eventSource = {
    getSnapshot: () => ({ entries: [{ event: toolCall }], hasMore: false, change: { kind: 'replace', entries: [] } }),
    subscribe: () => () => {},
  }
  const cleanups = []
  const effects = []
  return {
    cleanups,
    effects,
    ctx: {
      sessions: {
        list: {
          getSnapshot: () => list,
          subscribe: () => () => {},
        },
        binding: () => ({
          session: {
            projections: { faceOf: (key) => facials[key] },
            getSnapshot: () => ({ lastAgentError: null }),
          },
          eventSource,
        }),
      },
      locale: {
        getSnapshot: () => ({ active: 'en' }),
        register: () => () => {},
      },
      interval: () => () => {},
      effect: (callback, label) => {
        effects.push(label)
        const disposer = callback()
        if (typeof disposer === 'function') cleanups.push(disposer)
        return disposer
      },
      inject: (names, callback) => {
        const scope = {
          ...(names.includes('remote.account') ? { remote: { account } } : {}),
          ...(names.includes('uiWorkspace') ? { uiWorkspace: { openSession: async () => {} } } : {}),
          ...(names.includes('jobs') ? { jobs } : {}),
          effect: (fn) => {
            const disposer = fn()
            if (typeof disposer === 'function') cleanups.push(disposer)
          },
        }
        callback(scope)
      },
      slots: {
        inject: (key, callback) => callback(),
        register: (options, component) => {
          sandbox.registration = { key: options.name, options, component }
          return () => {}
        },
      },
    },
  }
}

test('built bundle registers and applies with a fake host', async () => {
  const env = createEnvironment()
  const react = createReact()
  vm.runInNewContext(bundle, env.sandbox)
  assert.equal(env.registered.length, 1)
  const spec = env.registered[0]
  assert.equal(spec.id, 'dsh-pet')
  const exports = spec.factory((id) => {
    if (id === 'react') return react.React
    if (id === 'react-dom') return { createPortal: (node) => node }
    throw new Error(`unexpected module ${id}`)
  })
  assert.equal(typeof exports.apply, 'function')
  assert.equal(exports.inject.join(','), 'slots,timer,locale,sessions,remote')

  const { ctx } = createContext(env.sandbox)
  exports.apply(ctx)
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
  const registration = env.sandbox.registration
  assert.equal(registration.key, 'shell.overlay')
  assert.equal(registration.options.id, 'dsh-pet')
  assert.equal(registration.options.order, 50)
  assert.equal(registration.options.locale, 'pet')
  assert.equal(typeof registration.component, 'function')
  const face = registration.options.inject()
  assert.equal(typeof face.hooks.pet.getSnapshot, 'function')
  assert.equal(typeof face.translate, 'function')
  const snap = face.hooks.pet.getSnapshot()
  assert.equal(snap.session.title, 'Bundle session')
  assert.equal(snap.session.tokens.total, 2340)
  assert.equal(snap.contextPercent, 26)
  assert.equal(snap.account.phase, 'ready')
  assert.equal(snap.account.primary.amount, 88.5)
  assert.equal(snap.lowBalance, false)
  assert.equal(snap.tasks.length, 2)
  assert.equal(snap.tasks[0].label, '创建 V1.6.4 分支')
  assert.equal(snap.tasks.find(task => task.source === 'tool').label, '运行单元测试')
  assert.equal(snap.state, 'working')
  assert.equal(face.translate('state.working'), 'working')

  const props = {
    ...face,
    usePet: (selector) => selector(face.hooks.pet.getSnapshot()),
    useSessionStatus: (selector) => selector(new Map()),
    onStatuses: () => {},
  }
  face.demoMode('waiting')
  react.resetHooks()
  assert.equal(registration.component(props), null)

  for (const cleanup of env.cleanups.reverse()) {
    try { cleanup() } catch (_error) { /* idempotent */ }
  }
})
