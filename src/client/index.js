/**
 * dsh-pet browser half: create the store, register dictionaries and CSS, wire
 * the optional Remote/workspace services, then contribute one `shell.overlay`
 * entry. The overlay layer is click-through; the pet opts back into pointer
 * events only on itself, its plaque, bubble and panel.
 * @module dsh-pet/client
 */
import { PetStore } from './store.js'
import { PetLayer } from './ui.js'
import { PET_CSS } from './styles.js'
import { en, zh } from './locales.js'

/** Services that must exist before the pet can render. */
export const inject = ['slots', 'timer', 'locale', 'sessions', 'remote']

/**
 * Mount the browser half.
 * @param ctx - client Cordis context.
 * @returns undefined
 */
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register('pet', { en, zh }), 'dsh-pet: dictionaries')

  const store = new PetStore({ ctx })
  ctx.effect(() => () => { store.dispose() }, 'dsh-pet: store')

  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-pet'
    tag.textContent = PET_CSS
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'dsh-pet: styles')

  const actions = {
    interact: () => { store.interact() },
    onStatuses: (statuses) => { store.applyStatuses(statuses) },
    setPosition: (position) => { store.setPosition(position) },
    setPrefs: (patch) => { store.setPrefs(patch) },
    importSkin: (text) => store.importSkin(text),
    removeSkin: (id) => { store.removeSkin(id) },
    exportSkin: (id) => store.exportSkin(id),
    exportSettings: () => store.exportSettings(),
    importSettings: (text) => store.importSettings(text),
    resetStats: () => { store.resetStats() },
    demoMode: (kind) => { store.demoMode(kind) },
    refresh: () => { void store.refreshAccount(true) },
    copySummary: () => store.copySummary(),
    openLink: (kind) => { store.openLink(kind) },
    dismissBubble: (seq) => { store.dismissBubble(seq) },
    openSession: (id) => { store.openSession(id) },
    focusAction: (action) => { store.focusAction(action) },
    resetPosition: () => { store.resetPosition() },
    markActivity: () => { store.markActivity() },
    translate: (key, params) => store.translate(key, params),
    bubbleText: (bubble) => store.bubbleText(bubble),
    runAction: (action, sessionId) => { store.runAction(action, sessionId) },
  }

  store.start()

  ctx.inject(['remote.account'], (scope) => {
    const detach = store.attachAccount(scope.remote.account)
    scope.effect(() => () => { detach() }, 'dsh-pet: account')
  })
  ctx.inject(['jobs'], (scope) => {
    const detach = store.attachJobs(scope.jobs)
    scope.effect(() => () => { detach() }, 'dsh-pet: jobs')
  })
  ctx.inject(['uiWorkspace'], (scope) => {
    store.attachWorkspace(scope.uiWorkspace)
    scope.effect(() => () => { store.attachWorkspace(null) }, 'dsh-pet: workspace')
  })

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-pet',
    order: 50,
    locale: 'pet',
    inject: () => ({ hooks: { pet: store }, ...actions }),
  }, PetLayer))
}
