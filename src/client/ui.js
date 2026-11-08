/**
 * React presentation for the pet. The component tree is intentionally small:
 * a root overlay entry, a mascot anchor with drag/click handling, one bubble,
 * and a tabbed settings panel. Every string flows through `actions.translate`
 * so the language preference and the DSH locale both apply.
 * @module dsh-pet/client/ui
 */
import { createPortal } from 'react-dom'
import {
  formatCompactNumber, formatMoney, formatPercent, totalTokens,
} from '../shared/format.js'
import { panelPlacement } from '../shared/geometry.js'
import { skinLabel } from '../shared/skins.js'
import { Mascot } from './mascot.js'
import { downloadText, formatTime, notificationsSupported, requestNotifications } from './effects.js'

const uiH = React.createElement

/**
 * Render one settings row.
 * @param props - label, value, optional title.
 * @returns React node.
 */
function UiRow(props) {
  return uiH('div', { className: 'dshp-row' },
    uiH('span', { className: 'dshp-row-label', title: props.title || undefined }, props.label),
    uiH('span', { className: 'dshp-value' }, props.value))
}

/**
 * Render a section title.
 * @param props - title text.
 * @returns React node.
 */
function UiSectionTitle(props) {
  return uiH('div', { className: 'dshp-section-title' }, props.children)
}

/**
 * Render a hint paragraph.
 * @param props - text.
 * @returns React node.
 */
function UiHint(props) {
  return uiH('p', { className: 'dshp-hint' }, props.children)
}

/**
 * Render an inline notice.
 * @param props - tone and text.
 * @returns React node.
 */
function UiNotice(props) {
  return uiH('div', {
    className: props.error === true ? 'dshp-error' : 'dshp-notice',
    role: props.error === true ? 'alert' : 'note',
  }, props.children)
}

/**
 * Render a progress bar.
 * @param props - percent and tone.
 * @returns React node.
 */
function UiProgress(props) {
  const percent = Math.max(0, Math.min(100, Number(props.percent) || 0))
  return uiH('div', {
    className: 'dshp-progress',
    'data-tone': props.tone || 'ok',
    role: 'progressbar',
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-valuenow': Math.round(percent),
    'aria-label': props.label,
  }, uiH('span', { style: { width: percent + '%' } }))
}

/**
 * Render a switch row.
 * @param props - label, checked, onChange.
 * @returns React node.
 */
function UiToggle(props) {
  return uiH('div', { className: 'dshp-row' },
    uiH('span', { className: 'dshp-row-label' }, props.label),
    uiH('button', {
      type: 'button',
      role: 'switch',
      className: 'dshp-toggle' + (props.checked ? ' is-on' : ''),
      'aria-checked': props.checked === true,
      onClick: () => { props.onChange(!props.checked) },
    }, uiH('span', { className: 'dshp-sr' }, props.label)))
}

/**
 * Render a number input row.
 * @param props - label, value, bounds and change callback.
 * @returns React node.
 */
function UiNumber(props) {
  return uiH('div', { className: 'dshp-row' },
    uiH('span', { className: 'dshp-row-label' }, props.label),
    uiH('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
      uiH('input', {
        className: 'dshp-input',
        type: 'number',
        min: props.min,
        max: props.max,
        step: props.step === undefined ? 1 : props.step,
        value: props.value,
        'aria-label': props.label,
        onChange: (event) => {
          const number = Number(event.target.value)
          if (Number.isFinite(number)) props.onChange(number)
        },
      }),
      props.suffix === undefined ? null : uiH('span', { className: 'dshp-hint' }, props.suffix)))
}

/**
 * Render a select row.
 * @param props - label, value, options and change callback.
 * @returns React node.
 */
function UiSelect(props) {
  return uiH('div', { className: 'dshp-row' },
    uiH('span', { className: 'dshp-row-label' }, props.label),
    uiH('select', {
      className: 'dshp-select',
      value: props.value,
      'aria-label': props.label,
      onChange: (event) => { props.onChange(event.target.value) },
    }, props.options.map(option => uiH('option', { key: option.value, value: option.value }, option.label))))
}

/**
 * Render a range row.
 * @param props - label, value, bounds, formatter and callback.
 * @returns React node.
 */
function UiRange(props) {
  return uiH('div', { className: 'dshp-section', style: { gap: 4 } },
    uiH('div', { className: 'dshp-row' },
      uiH('span', { className: 'dshp-row-label' }, props.label),
      uiH('span', { className: 'dshp-value' }, props.display)),
    uiH('input', {
      className: 'dshp-range',
      type: 'range',
      min: props.min,
      max: props.max,
      step: props.step === undefined ? 1 : props.step,
      value: props.value,
      'aria-label': props.label,
      onChange: (event) => { props.onChange(Number(event.target.value)) },
    }))
}

/**
 * Render the context ring.
 * @param props - percent, tone and accessible label.
 * @returns React node.
 */
function UiRing(props) {
  const radius = 6.4
  const circumference = 2 * Math.PI * radius
  const percent = Math.max(0, Math.min(100, Number(props.percent) || 0))
  const dash = percent / 100 * circumference
  return uiH('svg', {
    className: 'dshp-ring',
    'data-tone': props.tone || 'ok',
    viewBox: '0 0 16 16',
    role: 'img',
    'aria-label': props.label,
  },
  uiH('circle', { className: 'dshp-ring-track', cx: 8, cy: 8, r: radius }),
  uiH('circle', {
    className: 'dshp-ring-value',
    cx: 8, cy: 8, r: radius,
    strokeDasharray: dash + ' ' + circumference,
    transform: 'rotate(-90 8 8)',
  }))
}

/**
 * Render the compact status plaque.
 * @param props - snapshot, actions, open handler.
 * @returns React node.
 */
function PetPlaque(props) {
  const snap = props.snap
  const actions = props.actions
  const balance = snap.account.primary === null
    ? actions.translate('status.noData')
    : formatMoney(snap.account.primary.currency, snap.account.primary.amount, snap.language)
  const tokens = snap.session === null || snap.session.tokens === null
    ? actions.translate('status.noData')
    : formatCompactNumber(snap.session.tokens.total) + ' tok'
  const bonus = snap.account.bonus.length > 0
    ? snap.account.bonus.map(item => '+' + formatMoney(item.currency, item.amount, snap.language)).join(' ')
    : ''
  return uiH('div', { className: 'dshp-plaque', 'aria-label': actions.translate('aria.plaque') },
    uiH('button', {
      type: 'button',
      className: 'dshp-balance',
      title: bonus === '' ? actions.translate('actions.openTopUp') : bonus,
      onClick: () => {
        if (snap.account.links !== null && snap.account.links !== undefined) actions.openLink('topUp')
        else props.onOpen()
      },
    }, balance),
    uiH('span', { className: 'dshp-dot', 'aria-hidden': 'true' }),
    uiH('button', {
      type: 'button',
      className: 'dshp-tokens',
      title: actions.translate('status.tokens'),
      onClick: props.onOpen,
    }, tokens),
    snap.contextPercent === null ? null : uiH(UiRing, {
      percent: snap.contextPercent,
      tone: snap.contextTone,
      label: actions.translate('aria.context', { percent: formatPercent(snap.contextPercent) }),
    }),
    uiH('button', {
      type: 'button',
      className: 'dshp-more',
      'aria-label': actions.translate('actions.menu'),
      'aria-haspopup': 'menu',
      'aria-expanded': props.menuOpen === true,
      onClick: props.onMenu,
    }, '\u22ef'))
}

/**
 * The quick menu anchored to the pet.
 * @param props - snapshot, actions, close and settings callbacks.
 * @returns React node.
 */
function PetMenu(props) {
  const snap = props.snap
  const actions = props.actions
  const t = actions.translate
  const accountItems = []
  if (snap.account.links !== null && snap.account.links !== undefined) {
    accountItems.push({
      key: 'topup',
      label: t('actions.openTopUp'),
      run: () => { props.onClose(); actions.openLink('topUp') },
    })
    accountItems.push({
      key: 'usage',
      label: t('actions.openUsage'),
      run: () => { props.onClose(); actions.openLink('usage') },
    })
  }
  const generalItems = [
    { key: 'refresh', label: t('actions.refresh'), run: () => { props.onClose(); actions.refresh() } },
    { key: 'copy', label: t('actions.copy'), run: () => { props.onClose(); void actions.copySummary() } },
    { key: 'settings', label: t('actions.settings'), run: () => { props.onClose(); props.onSettings() } },
    { key: 'hide', label: t('actions.hide'), run: () => { props.onClose(); actions.setPrefs({ visible: false }) } },
  ]
  const item = entry => uiH('button', {
    key: entry.key,
    type: 'button',
    role: 'menuitem',
    className: 'dshp-menu-item',
    onClick: entry.run,
  }, entry.label)
  return uiH('div', {
    className: 'dshp-menu',
    role: 'menu',
    'aria-label': t('actions.menu'),
  },
  accountItems.map(item),
  accountItems.length === 0 ? null : uiH('div', { key: 'sep', className: 'dshp-menu-sep' }),
  generalItems.map(item))
}

/**
 * Render one bubble.
 * @param props - bubble and actions.
 * @returns React node.
 */
function PetBubble(props) {
  const bubble = props.bubble
  const actions = props.actions
  const text = actions.bubbleText(bubble)
  const urgent = bubble.tone === 'waiting' || bubble.tone === 'danger'
  const body = bubble.action === null
    ? uiH('span', null, text)
    : uiH('button', {
      type: 'button',
      className: 'dshp-bubble-action',
      onClick: () => { actions.runAction(bubble.action, bubble.sessionId) },
    }, text)
  return uiH('div', {
    className: 'dshp-bubble',
    'data-tone': bubble.tone,
    role: urgent ? 'alert' : 'status',
    'aria-live': bubble.sticky ? 'assertive' : 'polite',
  },
  body,
  uiH('button', {
    type: 'button',
    className: 'dshp-bubble-close',
    'aria-label': actions.translate('actions.close'),
    onClick: () => { actions.dismissBubble(bubble.seq) },
  }, '\u00d7'))
}

/**
 * Render the live task roster above the pet.
 * @param props - tasks and actions.
 * @returns React node.
 */
function PetTasks(props) {
  const tasks = props.tasks
  const actions = props.actions
  const t = actions.translate
  const visible = tasks.slice(0, 3)
  return uiH('div', {
    className: 'dshp-tasks',
    role: 'status',
    'aria-live': 'polite',
    'aria-label': t('tasks.title'),
  },
  uiH('div', { className: 'dshp-tasks-head' },
    uiH('span', { className: 'dshp-tasks-dot', 'aria-hidden': 'true' }),
    uiH('span', null, t('tasks.title')),
    uiH('span', { className: 'dshp-tasks-count' }, String(tasks.length))),
  visible.map(task => uiH('div', {
    key: task.id,
    className: 'dshp-task',
    'data-status': task.status,
    'data-source': task.source,
    'data-background': task.background === true ? 'true' : 'false',
    title: task.background === true && task.sessionTitle !== undefined && task.sessionTitle !== ''
      ? `${task.sessionTitle} · ${task.label}`
      : task.label,
  },
  uiH('span', { className: 'dshp-task-label' }, task.label),
  uiH('span', { className: 'dshp-task-status' },
    task.status === 'stopping'
      ? t('tasks.stopping')
      : task.progress !== ''
        ? task.progress
        : task.command === true ? t('tasks.command') : t('tasks.running')),
  task.background === true
    ? uiH('span', { className: 'dshp-task-session' }, task.sessionTitle || t('tasks.background'))
    : null)),
  tasks.length > visible.length
    ? uiH('div', { className: 'dshp-task-more' }, t('tasks.more', { count: tasks.length - visible.length }))
    : null)
}

/**
 * Render the draggable pet and its plaque.
 * @param props - snapshot, size, actions, refs and handlers.
 * @returns React node.
 */
function PetAnchor(props) {
  const snap = props.snap
  const actions = props.actions
  const size = props.size
  const pointer = React.useRef(null)
  const finishRef = React.useRef(null)
  const clickTimer = React.useRef(null)
  const lastClick = React.useRef(0)
  const [pressed, setPressed] = React.useState(false)
  const sendNativeDragStart = () => {
    try {
      const bridge = window.chrome && window.chrome.webview
      if (bridge && typeof bridge.postMessage === 'function') {
        bridge.postMessage({
          type: 'dsh-pet-native-drag-start',
          screenX: snap.layout.screenX,
          screenY: snap.layout.screenY,
          pointerScreenX: event.screenX,
          pointerScreenY: event.screenY,
        })
      }
    } catch (_error) { /* bridge unavailable */ }
  }
  const sendNativeDragStop = () => {
    try {
      const bridge = window.chrome && window.chrome.webview
      if (bridge && typeof bridge.postMessage === 'function') {
        bridge.postMessage({ type: 'dsh-pet-native-drag-stop' })
      }
    } catch (_error) { /* bridge unavailable */ }
  }
  React.useEffect(() => () => {
    if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    const state = pointer.current
    if (state !== null && state.frame !== 0) window.cancelAnimationFrame(state.frame)
    if (state !== null && state.desktop === true) sendNativeDragStop()
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', finish, true)
    window.removeEventListener('pointercancel', finish, true)
    window.removeEventListener('mousemove', onPointerMove, true)
    window.removeEventListener('mouseup', finish, true)
  }, [])

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    if (pointer.current !== null) return
    if (props.desktopMode !== true && event.currentTarget.setPointerCapture !== undefined && event.pointerId !== undefined) {
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch (_error) { /* window listeners remain as fallback */ }
    }
    if (props.desktopMode === true) {
      pointer.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        screenX: snap.layout.screenX,
        screenY: snap.layout.screenY,
        pendingX: snap.layout.screenX,
        pendingY: snap.layout.screenY,
        localLeft: snap.layout.left,
        localTop: snap.layout.top,
        frame: 0,
        moved: false,
        finishRequested: false,
        desktop: true,
      }
      setPressed(true)
      actions.markActivity()
      sendNativeDragStart()
      window.addEventListener('pointerup', finish, true)
      window.addEventListener('mouseup', finish, true)
      return
    }
    pointer.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      screenX: snap.layout.screenX,
      screenY: snap.layout.screenY,
      pendingX: snap.layout.screenX,
      pendingY: snap.layout.screenY,
      frame: 0,
      moved: false,
    }
    setPressed(true)
    actions.markActivity()
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', finish, true)
    window.addEventListener('mousemove', onPointerMove, true)
    window.addEventListener('mouseup', finish, true)
  }
  const onPointerMove = (event) => {
    const state = pointer.current
    if (state === null) return
    if (state.desktop === true) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.moved && Math.abs(dx) + Math.abs(dy) > 6) state.moved = true
    if (!state.moved) return
    state.pendingX = state.screenX + dx
    state.pendingY = state.screenY + dy
    if (state.frame !== 0) return
    state.frame = window.requestAnimationFrame(() => {
      state.frame = 0
      actions.setPosition({ x: state.pendingX, y: state.pendingY }, false)
    })
  }
  const finish = (event) => {
    const state = pointer.current
    if (state !== null && event !== null && event.pointerId !== undefined && event.pointerId !== state.pointerId) return
    if (state !== null && state.desktop === true && event !== null) {
      if (state.finishRequested === true) return
      state.finishRequested = true
      sendNativeDragStop()
      return
    }
    pointer.current = null
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', finish, true)
    window.removeEventListener('pointercancel', finish, true)
    window.removeEventListener('mousemove', onPointerMove, true)
    window.removeEventListener('mouseup', finish, true)
    if (event !== null && event.currentTarget !== null && event.pointerId !== undefined
      && event.currentTarget.releasePointerCapture !== undefined) {
      try { event.currentTarget.releasePointerCapture(event.pointerId) } catch (_error) { /* ignore */ }
    }
    setPressed(false)
    if (state !== null && state.frame !== 0) window.cancelAnimationFrame(state.frame)
    if (state !== null && state.moved) {
      if (state.desktop === true) {
        const anchor = props.anchorRef && props.anchorRef.current
        if (anchor !== null && anchor !== undefined) {
          anchor.style.left = (state.localLeft + state.pendingX - state.screenX) + 'px'
          anchor.style.top = (state.localTop + state.pendingY - state.screenY) + 'px'
          anchor.style.transform = ''
        }
      }
      actions.setPosition({
        x: state.pendingX === undefined ? state.screenX : state.pendingX,
        y: state.pendingY === undefined ? state.screenY : state.pendingY,
      })
      return
    }
    if (state === null || state.moved) return
    const now = Date.now()
    if (now - lastClick.current < 280) {
      lastClick.current = 0
      if (clickTimer.current !== null) {
        clearTimeout(clickTimer.current)
        clickTimer.current = null
      }
      if (props.desktopMode === true) actions.focusDsh()
      else props.setPanelOpen(true)
      return
    }
    lastClick.current = now
    if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      actions.interact()
    }, 240)
  }
  finishRef.current = finish
  React.useEffect(() => {
    if (props.desktopMode !== true) return undefined
    const bridge = window.chrome && window.chrome.webview
    if (bridge === null || bridge === undefined || typeof bridge.addEventListener !== 'function') return undefined
    const onNativeDragMessage = (event) => {
      const message = event.data
      const state = pointer.current
      if (state === null || state.desktop !== true || message === null || typeof message !== 'object') return
      if (message.type === 'dsh-pet-native-drag-end') {
        if (typeof finishRef.current === 'function') finishRef.current(null)
        return
      }
      if (message.type !== 'dsh-pet-native-drag-move') return
      const x = Number(message.x)
      const y = Number(message.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      state.pendingX = x
      state.pendingY = y
      if (!state.moved && Math.abs(x - state.screenX) + Math.abs(y - state.screenY) > 4) {
        state.moved = true
      }
      if (!state.moved || state.frame !== 0) return
      state.frame = window.requestAnimationFrame(() => {
        state.frame = 0
        if (pointer.current !== state) return
        const anchor = props.anchorRef && props.anchorRef.current
        if (anchor === null || anchor === undefined) return
        const dx = state.pendingX - state.screenX
        const dy = state.pendingY - state.screenY
        anchor.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0)'
      })
    }
    bridge.addEventListener('message', onNativeDragMessage)
    return () => { bridge.removeEventListener('message', onNativeDragMessage) }
  }, [props.desktopMode])
  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      actions.interact()
    }
    if (event.key === 'Escape') {
      props.setPanelOpen(false)
      props.setMenuOpen(false)
    }
  }
  const balanceText = snap.account.primary === null
    ? actions.translate('status.noData')
    : formatMoney(snap.account.primary.currency, snap.account.primary.amount, snap.language)
  const tokensText = snap.session === null || snap.session.tokens === null
    ? actions.translate('status.noData')
    : formatCompactNumber(snap.session.tokens.total) + ' tok'
  const aria = actions.translate('aria.pet', {
    name: snap.name,
    state: actions.translate('state.' + snap.state),
    balance: balanceText,
    tokens: tokensText,
  })
  const style = {
    left: snap.layout.left + 'px',
    top: snap.layout.top + 'px',
    opacity: snap.prefs.opacity,
  }
  return uiH('div', { className: 'dshp-root dshp-anchor', style, ref: props.anchorRef },
    uiH('div', { className: 'dshp-floaters' },
      props.menuOpen === true
        ? uiH(PetMenu, {
          snap,
          actions,
          onClose: () => { props.setMenuOpen(false) },
          onSettings: () => { props.setMenuOpen(false); props.setPanelOpen(true) },
        })
        : null,
      snap.bubble === null ? null : uiH(PetBubble, { bubble: snap.bubble, actions }),
      snap.tasks !== undefined && snap.tasks.length > 0
        ? uiH(PetTasks, { tasks: snap.tasks, actions })
        : null),
    uiH('div', { className: 'dshp-pet-wrap' },
      uiH('button', {
        type: 'button',
        className: 'dshp-pet',
        ref: props.petRef,
        'data-dragging': pressed ? 'true' : 'false',
        'data-state': snap.state,
        style: { '--dshp-size': size + 'px' },
        'aria-label': aria,
        onPointerDown,
        onMouseDown: onPointerDown,
        onKeyDown,
        onContextMenu: (event) => {
          event.preventDefault()
          props.setPanelOpen(true)
        },
        onDoubleClick: (event) => {
          event.preventDefault()
          if (clickTimer.current !== null) {
            clearTimeout(clickTimer.current)
            clickTimer.current = null
          }
          if (props.desktopMode === true) actions.focusDsh()
          else props.setPanelOpen(true)
        },
      },
      uiH(Mascot, { skin: snap.skin, state: snap.state }),
      snap.state === 'waiting' ? uiH('span', { className: 'dshp-badge', 'aria-hidden': 'true' }, '!') : null,
      snap.focus.phase === 'idle' || snap.focus.paused ? null
        : uiH('span', { className: 'dshp-focus-chip' }, snap.focus.clock)),
      snap.prefs.showPlaque
        ? uiH(PetPlaque, {
          snap,
          actions,
          menuOpen: props.menuOpen,
          onMenu: () => { props.setMenuOpen(!(props.menuOpen === true)) },
          onOpen: () => { props.setPanelOpen(true) },
        })
        : null))
}

/**
 * Render the hidden edge handle.
 * @param props - snapshot and actions.
 * @returns React node.
 */
function PetHandle(props) {
  const snap = props.snap
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight
  const top = props.offscreen === true
    ? Math.max(12, Math.round((viewportHeight - 42) / 2))
    : Math.min(Math.max(12, Math.round(snap.layout.top)), Math.max(12, viewportHeight - 42))
  const style = { right: '0px', top: top + 'px' }
  return uiH('div', { className: 'dshp-root', style: { position: 'fixed', zIndex: 2147483000, pointerEvents: 'none' } },
    uiH('button', {
      type: 'button',
      className: 'dshp-handle',
      style,
      'aria-label': props.desktop === true
        ? props.actions.translate('look.desktopClose')
        : props.actions.translate('actions.show'),
      onClick: () => {
        if (props.desktop === true) {
          props.actions.closeDesktopWindow()
          return
        }
        props.actions.setPrefs({ visible: true })
        if (props.offscreen === true) props.actions.resetPosition()
      },
    }, '\ud83d\udc3e'))
}

/**
 * Render one skin thumbnail.
 * @param props - skin, active state and select callback.
 * @returns React node.
 */
function SkinThumb(props) {
  const label = skinLabel(props.skin, props.language)
  return uiH('button', {
    type: 'button',
    className: 'dshp-skin' + (props.active ? ' is-active' : ''),
    onClick: props.onSelect,
    title: label,
  },
  uiH('span', { className: 'dshp-skin-mascot' }, uiH(Mascot, { skin: props.skin, state: 'idle' })),
  uiH('span', null, label))
}

/**
 * Status tab: account, session tokens, context and today.
 * @param props - snapshot and actions.
 * @returns React node.
 */
function StatusTab(props) {
  const snap = props.snap
  const actions = props.actions
  const t = actions.translate
  const account = snap.account
  const session = snap.session
  const balance = account.primary === null
    ? t('status.noData')
    : formatMoney(account.primary.currency, account.primary.amount, snap.language)
  const bonus = account.bonus.length === 0
    ? null
    : account.bonus.map((item, index) => uiH(UiRow, {
      key: 'bonus-' + index,
      label: t('status.bonus') + ' ' + item.currency,
      value: formatMoney(item.currency, item.amount, snap.language),
    }))
  const delta = snap.stats.balanceDelta
  const deltaText = delta === null
    ? t('status.noData')
    : (delta > 0 ? '+' : '') + formatMoney(account.primary === null ? 'CNY' : account.primary.currency, delta, snap.language)
  const tokenRows = session === null || session.tokens === null ? null : [
    uiH(UiRow, { key: 'tok-total', label: t('status.tokens'), value: formatCompactNumber(session.tokens.total) }),
    uiH(UiRow, { key: 'tok-in', label: t('panel.uncachedInput'), value: formatCompactNumber(session.tokens.uncachedInputTokens) }),
    uiH(UiRow, { key: 'tok-out', label: t('panel.output'), value: formatCompactNumber(session.tokens.outputTokens) }),
    uiH(UiRow, { key: 'tok-read', label: t('panel.cacheRead'), value: formatCompactNumber(session.tokens.cacheReadTokens) }),
    uiH(UiRow, { key: 'tok-write', label: t('panel.cacheWrite'), value: formatCompactNumber(session.tokens.cacheWriteTokens) }),
  ]
  const breakdownRows = session === null || session.breakdown === null ? null : [
    uiH(UiRow, { key: 'bd-system', label: t('panel.system'), value: formatCompactNumber(session.breakdown.systemTokens) }),
    uiH(UiRow, { key: 'bd-tools', label: t('panel.tools'), value: formatCompactNumber(session.breakdown.toolsTokens) }),
    uiH(UiRow, { key: 'bd-messages', label: t('panel.messages'), value: formatCompactNumber(session.breakdown.messageTokens) }),
  ]
  const pressure = session === null || session.pressure === null ? null : session.pressure
  return uiH('div', null,
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('panel.statusTitle')),
      uiH(UiRow, {
        label: t('status.balance'),
        value: balance,
        title: account.primary === null ? '' : account.primary.currency,
      }),
      bonus,
      account.phase === 'signed-out' ? uiH(UiNotice, null, t('status.signedOut')) : null,
      account.phase === 'loading' || account.phase === 'idle' ? uiH(UiNotice, null, t('status.loading')) : null,
      account.phase === 'unavailable' ? uiH(UiNotice, null, t('status.unavailable')) : null,
      account.phase === 'error'
        ? uiH(UiNotice, { error: true }, t('panel.accountError', { code: account.errorCode || 'unknown' }))
        : null,
      uiH('div', { className: 'dshp-actions' },
        uiH('button', {
          type: 'button', className: 'dshp-btn', onClick: () => { actions.refresh() },
        }, t('actions.refresh')),
        account.links === null || account.links === undefined ? null : uiH('button', {
          type: 'button', className: 'dshp-btn ghost', onClick: () => { actions.openLink('topUp') },
        }, t('actions.openTopUp')),
        account.links === null || account.links === undefined ? null : uiH('button', {
          type: 'button', className: 'dshp-btn ghost', onClick: () => { actions.openLink('usage') },
        }, t('actions.openUsage'))),
      uiH(UiRow, {
        label: t('panel.lastRefresh'),
        value: account.refreshedAt === 0 ? t('status.never') : formatTime(account.refreshedAt, snap.language),
      })),
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('status.session')),
      session === null
        ? uiH('div', { className: 'dshp-empty' }, t('panel.emptySession'))
        : uiH(React.Fragment, null,
          uiH(UiRow, { label: t('status.state'), value: t('state.' + snap.state) }),
          tokenRows,
          breakdownRows === null ? null : uiH('div', { className: 'dshp-list' }, ...breakdownRows),
          session.contextPercent === null ? null : uiH(React.Fragment, null,
            uiH('div', { className: 'dshp-row' },
              uiH('span', { className: 'dshp-row-label' }, t('panel.contextUsage')),
              uiH('span', { className: 'dshp-value' }, formatPercent(session.contextPercent))),
            uiH(UiProgress, {
              percent: session.contextPercent,
              tone: snap.contextTone,
              label: t('panel.contextUsage'),
            }),
            pressure === null ? null : uiH(UiRow, {
              label: t('panel.contextWindow'),
              value: formatCompactNumber(pressure.projectedTokens || pressure.pressureTokens || 0)
                + ' / ' + formatCompactNumber(pressure.contextWindow || 0),
            }))),
      uiH('div', { className: 'dshp-actions' },
        uiH('button', {
          type: 'button', className: 'dshp-btn', onClick: () => { void actions.copySummary() },
        }, t('actions.copy')))),
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('data.today')),
      uiH(UiRow, { label: t('data.tokens'), value: formatCompactNumber(snap.stats.total) }),
      uiH(UiRow, { label: t('data.balance'), value: deltaText }),
      uiH(UiHint, null, t('panel.dailyHint'))))
}

/**
 * Appearance tab.
 * @param props - snapshot, actions, local notice callback.
 * @returns React node.
 */
function LookTab(props) {
  const snap = props.snap
  const actions = props.actions
  const t = actions.translate
  const skinFile = React.useRef(null)
  const activeSkin = snap.skin
  const custom = activeSkin !== null && activeSkin.kind === 'image'
  const onFile = async (event) => {
    const file = event.target.files === undefined || event.target.files === null ? null : event.target.files[0]
    event.target.value = ''
    if (file === null) return
    try {
      const text = await file.text()
      const result = actions.importSkin(text)
      props.setNotice(result.ok ? '' : result.error)
    } catch (_error) {
      props.setNotice(t('skin.invalid'))
    }
  }
  return uiH('div', null,
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('look.skin')),
      uiH('div', { className: 'dshp-grid' }, snap.skins.map(skin => uiH(SkinThumb, {
        key: skin.id,
        skin,
        active: skin.id === snap.prefs.skinId,
        language: snap.language,
        onSelect: () => { actions.setPrefs({ skinId: skin.id }) },
      }))),
      uiH('div', { className: 'dshp-actions' },
        uiH('button', {
          type: 'button', className: 'dshp-btn', onClick: () => { if (skinFile.current !== null) skinFile.current.click() },
        }, t('actions.importSkin')),
        uiH('button', {
          type: 'button',
          className: 'dshp-btn',
          disabled: !custom,
          onClick: () => {
            const text = actions.exportSkin(snap.prefs.skinId)
            if (text !== '') downloadText('dsh-pet-skin-' + snap.prefs.skinId + '.json', text)
          },
        }, t('actions.exportSkin')),
        custom ? uiH('button', {
          type: 'button', className: 'dshp-btn danger', onClick: () => { actions.removeSkin(snap.prefs.skinId) },
        }, t('actions.deleteSkin')) : null),
      uiH('input', {
        ref: skinFile,
        type: 'file',
        accept: 'application/json,.json',
        className: 'dshp-sr',
        onChange: onFile,
      }),
      uiH(UiHint, null, t('panel.importSkinHint', { formats: 'png/jpeg/webp/gif data URL / https' }))),
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('panel.appearanceTitle')),
      uiH('div', { className: 'dshp-row' },
        uiH('span', { className: 'dshp-row-label' }, t('status.petName')),
        uiH('input', {
          className: 'dshp-input',
          style: { width: 150 },
          type: 'text',
          maxLength: 24,
          value: snap.prefs.petName,
          placeholder: t('look.namePlaceholder'),
          onChange: (event) => { actions.setPrefs({ petName: event.target.value }) },
        })),
      uiH(UiHint, null, t('look.nameHint')),
      uiH(UiRange, {
        label: t('look.size'),
        display: snap.prefs.size + 'px',
        min: 80,
        max: 200,
        step: 4,
        value: snap.prefs.size,
        onChange: (value) => { actions.setPrefs({ size: value }) },
      }),
      uiH(UiRange, {
        label: t('look.opacity'),
        display: Math.round(snap.prefs.opacity * 100) + '%',
        min: 30,
        max: 100,
        step: 5,
        value: Math.round(snap.prefs.opacity * 100),
        onChange: (value) => { actions.setPrefs({ opacity: value / 100 }) },
      }),
      uiH(UiToggle, {
        label: t('look.plaque'),
        checked: snap.prefs.showPlaque,
        onChange: (value) => { actions.setPrefs({ showPlaque: value }) },
      }),
      uiH(UiToggle, {
        label: t('look.tasks'),
        checked: snap.prefs.showTasks,
        onChange: (value) => { actions.setPrefs({ showTasks: value }) },
      }),
      uiH(UiToggle, {
        label: t('look.random'),
        checked: snap.prefs.randomLines,
        onChange: (value) => { actions.setPrefs({ randomLines: value }) },
      }),
      uiH(UiSelect, {
        label: t('look.language'),
        value: snap.prefs.language,
        options: [
          { value: 'auto', label: t('look.auto') },
          { value: 'zh', label: '中文' },
          { value: 'en', label: 'English' },
        ],
        onChange: (value) => { actions.setPrefs({ language: value }) },
      }),
      uiH('div', { className: 'dshp-section' },
        uiH(UiSectionTitle, null, t('look.desktop')),
        uiH('div', { className: 'dshp-actions' },
          uiH('button', {
            type: 'button',
            className: 'dshp-btn' + (snap.desktopWindow ? ' primary' : ''),
            onClick: () => {
              if (snap.desktopWindow) actions.closeDesktopWindow()
              else actions.openDesktopWindow()
            },
          }, t(snap.desktopWindow ? 'look.desktopClose' : 'look.desktopOpen'))),
        uiH(UiHint, null, t('look.desktopHint'))),
      uiH('div', { className: 'dshp-actions' },
        uiH('button', {
          type: 'button', className: 'dshp-btn ghost', onClick: () => { actions.resetPosition() },
        }, t('actions.resetPosition')),
        uiH('button', {
          type: 'button', className: 'dshp-btn ghost', onClick: () => { actions.setPrefs({ visible: false }) },
        }, t('actions.hide'))),
      uiH(UiHint, null, t('look.positionHint'))))
}

/**
 * Alerts tab.
 * @param props - snapshot, actions and local notice callback.
 * @returns React node.
 */
function AlertsTab(props) {
  const snap = props.snap
  const actions = props.actions
  const t = actions.translate
  const alerts = snap.prefs.alerts
  const setAlert = (patch) => { actions.setPrefs({ alerts: patch }) }
  const toggleNotifications = async (next) => {
    if (!next) {
      setAlert({ notifications: false })
      return
    }
    if (!notificationsSupported()) {
      props.setNotice(t('alerts.notifyUnsupported'))
      return
    }
    const result = await requestNotifications()
    if (result === 'granted') {
      setAlert({ notifications: true })
      props.setNotice('')
    } else {
      props.setNotice(t('alerts.notifyDenied'))
    }
  }
  return uiH('div', null,
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('alerts.lowBalance')),
      uiH(UiToggle, {
        label: t('alerts.lowBalance'),
        checked: alerts.lowBalance,
        onChange: (value) => { setAlert({ lowBalance: value }) },
      }),
      uiH(UiNumber, {
        label: t('alerts.threshold'),
        value: alerts.lowBalanceThreshold,
        min: 0,
        max: 1000000,
        step: 1,
        suffix: alerts.lowBalanceCurrency === 'auto' ? 'auto' : alerts.lowBalanceCurrency,
        onChange: (value) => { setAlert({ lowBalanceThreshold: value }) },
      }),
      uiH(UiSelect, {
        label: t('alerts.currency'),
        value: alerts.lowBalanceCurrency,
        options: [
          { value: 'auto', label: t('alerts.auto') },
          { value: 'CNY', label: 'CNY' },
          { value: 'USD', label: 'USD' },
        ],
        onChange: (value) => { setAlert({ lowBalanceCurrency: value }) },
      }),
      uiH(UiSelect, {
        label: t('status.refreshEvery'),
        value: String(snap.prefs.account.refreshSeconds),
        options: [
          { value: '30', label: '30s' },
          { value: '60', label: '60s' },
          { value: '300', label: '5m' },
          { value: '0', label: t('status.off') },
        ],
        onChange: (value) => { actions.setPrefs({ account: { refreshSeconds: Number(value) } }) },
      })),
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('alerts.context')),
      uiH(UiToggle, {
        label: t('alerts.context'),
        checked: alerts.context,
        onChange: (value) => { setAlert({ context: value }) },
      }),
      uiH(UiNumber, {
        label: t('alerts.warn'),
        value: alerts.contextWarn,
        min: 50,
        max: 95,
        suffix: '%',
        onChange: (value) => { setAlert({ contextWarn: value }) },
      }),
      uiH(UiNumber, {
        label: t('alerts.danger'),
        value: alerts.contextDanger,
        min: 51,
        max: 99,
        suffix: '%',
        onChange: (value) => { setAlert({ contextDanger: value }) },
      })),
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('tabs.alerts')),
      uiH(UiToggle, {
        label: t('alerts.completion'),
        checked: alerts.completion,
        onChange: (value) => { setAlert({ completion: value }) },
      }),
      uiH(UiToggle, {
        label: t('alerts.background'),
        checked: alerts.background,
        onChange: (value) => { setAlert({ background: value }) },
      }),
      uiH(UiToggle, {
        label: t('alerts.waiting'),
        checked: alerts.waiting,
        onChange: (value) => { setAlert({ waiting: value }) },
      }),
      uiH(UiToggle, {
        label: t('alerts.notifications'),
        checked: alerts.notifications,
        onChange: toggleNotifications,
      }),
      uiH(UiToggle, {
        label: t('alerts.sound'),
        checked: alerts.sound,
        onChange: (value) => { setAlert({ sound: value }) },
      })))
}

/**
 * Focus tab.
 * @param props - snapshot and actions.
 * @returns React node.
 */
function FocusTab(props) {
  const snap = props.snap
  const actions = props.actions
  const t = actions.translate
  const focus = snap.focus
  return uiH('div', null,
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('focus.title')),
      uiH(UiToggle, {
        label: t('focus.enabled'),
        checked: snap.prefs.focus.enabled,
        onChange: (value) => { actions.setPrefs({ focus: { enabled: value } }) },
      }),
      uiH(UiRow, { label: t('focus.phase'), value: focus.label }),
      uiH(UiRow, { label: t('focus.remaining'), value: focus.clock }),
      uiH('div', { className: 'dshp-actions' },
        focus.phase === 'idle' ? uiH('button', {
          type: 'button', className: 'dshp-btn primary', onClick: () => { actions.focusAction('start') },
        }, t('actions.start')) : null,
        focus.phase !== 'idle' && !focus.paused ? uiH('button', {
          type: 'button', className: 'dshp-btn', onClick: () => { actions.focusAction('pause') },
        }, t('actions.pause')) : null,
        focus.paused ? uiH('button', {
          type: 'button', className: 'dshp-btn primary', onClick: () => { actions.focusAction('resume') },
        }, t('actions.resume')) : null,
        focus.phase !== 'idle' ? uiH('button', {
          type: 'button', className: 'dshp-btn danger', onClick: () => { actions.focusAction('reset') },
        }, t('actions.reset')) : null)),
    uiH('div', { className: 'dshp-section' },
      uiH(UiNumber, {
        label: t('focus.minutes'),
        value: snap.prefs.focus.focusMinutes,
        min: 1,
        max: 120,
        suffix: 'min',
        onChange: (value) => { actions.setPrefs({ focus: { focusMinutes: value } }) },
      }),
      uiH(UiNumber, {
        label: t('focus.break'),
        value: snap.prefs.focus.breakMinutes,
        min: 1,
        max: 60,
        suffix: 'min',
        onChange: (value) => { actions.setPrefs({ focus: { breakMinutes: value } }) },
      }),
      uiH(UiToggle, {
        label: t('focus.autoBreak'),
        checked: snap.prefs.focus.autoBreak,
        onChange: (value) => { actions.setPrefs({ focus: { autoBreak: value } }) },
      }),
      uiH(UiNumber, {
        label: t('focus.water'),
        value: snap.prefs.focus.waterMinutes,
        min: 0,
        max: 240,
        suffix: 'min',
        onChange: (value) => { actions.setPrefs({ focus: { waterMinutes: value } }) },
      }),
      uiH(UiHint, null, t('focus.waterOff') + ' \u00b7 ' + t('focus.hint'))))
}

/**
 * Data tab.
 * @param props - snapshot, actions and local notice callback.
 * @returns React node.
 */
function DataTab(props) {
  const snap = props.snap
  const actions = props.actions
  const t = actions.translate
  const settingsFile = React.useRef(null)
  const rows = snap.stats.history
  const onFile = async (event) => {
    const file = event.target.files === undefined || event.target.files === null ? null : event.target.files[0]
    event.target.value = ''
    if (file === null) return
    try {
      const text = await file.text()
      const result = actions.importSettings(text)
      props.setNotice(result.ok ? '' : result.error)
    } catch (_error) {
      props.setNotice(t('skin.invalid'))
    }
  }
  const demoKinds = [
    ['tasks', 'demo.tasks'],
    ['running', 'demo.running'],
    ['waiting', 'demo.waiting'],
    ['lowBalance', 'demo.lowBalance'],
    ['context90', 'demo.context90'],
    ['happy', 'demo.happy'],
    ['sad', 'demo.sad'],
  ]
  return uiH('div', null,
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('data.today')),
      uiH(UiToggle, {
        label: t('data.recordStats'),
        checked: snap.prefs.stats.enabled,
        onChange: (value) => { actions.setPrefs({ stats: { enabled: value } }) },
      }),
      snap.prefs.stats.enabled ? null : uiH(UiHint, null, t('data.statsOff')),
      uiH(UiRow, { label: t('data.tokens'), value: formatCompactNumber(snap.stats.total) }),
      uiH(UiRow, {
        label: t('data.balance'),
        value: snap.stats.balanceDelta === null
          ? t('status.noData')
          : (snap.stats.balanceDelta > 0 ? '+' : '')
            + formatMoney(snap.account.primary === null ? 'CNY' : snap.account.primary.currency, snap.stats.balanceDelta, snap.language),
      }),
      uiH(UiHint, null, t('panel.dailyHint'))),
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('data.last7')),
      uiH('div', { className: 'dshp-list' }, rows.map((row, index) => uiH('div', {
        key: row.date + index,
        className: 'dshp-list-row',
      },
      uiH('span', { className: 'dshp-row-label' }, row.date),
      uiH('span', { className: 'dshp-value' }, formatCompactNumber(totalTokens(row.tokens)) + ' tok')))),
      uiH('div', { className: 'dshp-actions' },
        uiH('button', {
          type: 'button', className: 'dshp-btn danger', onClick: () => { actions.resetStats() },
        }, t('data.clear')))),
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('data.demo')),
      uiH('div', { className: 'dshp-demo' }, demoKinds.map(item => uiH('button', {
        key: item[0],
        type: 'button',
        className: 'dshp-btn' + (snap.demo === item[0] ? ' primary' : ''),
        onClick: () => { actions.demoMode(item[0]) },
      }, t(item[1])))),
      snap.demo === null ? null : uiH('button', {
        type: 'button', className: 'dshp-btn ghost', onClick: () => { actions.demoMode('stop') },
      }, t('data.demoStop')),
      uiH(UiHint, null, t('data.demoHint'))),
    uiH('div', { className: 'dshp-section' },
      uiH(UiSectionTitle, null, t('tabs.data')),
      uiH('div', { className: 'dshp-actions' },
        uiH('button', {
          type: 'button', className: 'dshp-btn', onClick: () => { if (settingsFile.current !== null) settingsFile.current.click() },
        }, t('actions.importSettings')),
        uiH('button', {
          type: 'button', className: 'dshp-btn', onClick: () => {
            downloadText('dsh-pet-settings.json', actions.exportSettings())
          },
        }, t('actions.exportSettings'))),
      uiH('input', {
        ref: settingsFile,
        type: 'file',
        accept: 'application/json,.json',
        className: 'dshp-sr',
        onChange: onFile,
      }),
      uiH(UiHint, null, t('data.exportHint'))))
}

/**
 * The settings panel shell.
 * @param props - snapshot, actions, size, refs and close.
 * @returns React node.
 */
function SettingsPanel(props) {
  const snap = props.snap
  const actions = props.actions
  const t = actions.translate
  const [tab, setTab] = React.useState('status')
  const [notice, setNotice] = React.useState('')
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const petRect = props.petRef && props.petRef.current !== null
    ? props.petRef.current.getBoundingClientRect()
    : null
  const anchor = petRect !== null && petRect.width > 0 && petRect.height > 0
    ? { right: viewport.width - petRect.right, bottom: viewport.height - petRect.bottom }
    : {
      right: viewport.width - snap.layout.left - props.size,
      bottom: viewport.height - snap.layout.top - props.size,
    }
  const placement = panelPlacement(anchor, viewport, props.size, { width: 336, height: 560 })
  const style = {
    left: placement.left + 'px',
    top: placement.top + 'px',
    width: placement.width + 'px',
    maxHeight: placement.maxHeight + 'px',
  }
  const tabs = [
    ['status', t('tabs.status')],
    ['look', t('tabs.look')],
    ['alerts', t('tabs.alerts')],
    ['focus', t('tabs.focus')],
    ['data', t('tabs.data')],
  ]
  let body = null
  if (tab === 'status') body = uiH(StatusTab, { snap, actions })
  if (tab === 'look') body = uiH(LookTab, { snap, actions, setNotice })
  if (tab === 'alerts') body = uiH(AlertsTab, { snap, actions, setNotice })
  if (tab === 'focus') body = uiH(FocusTab, { snap, actions })
  if (tab === 'data') body = uiH(DataTab, { snap, actions, setNotice })
  return uiH('div', { className: 'dshp-root' },
    uiH('div', {
      className: 'dshp-panel',
      style,
      role: 'dialog',
      'aria-modal': 'false',
      'aria-label': t('panel.title'),
      ref: props.panelRef,
    },
    uiH('div', { className: 'dshp-panel-head' },
      uiH('div', null,
        uiH('div', { className: 'dshp-title' }, t('panel.title')),
        uiH('div', { className: 'dshp-sub' }, snap.name + ' \u00b7 ' + t('state.' + snap.state))),
      uiH('button', {
        type: 'button',
        className: 'dshp-icon-btn',
        'aria-label': t('aria.close'),
        onClick: props.onClose,
      }, '\u00d7')),
    uiH('div', { className: 'dshp-tabs', role: 'tablist' }, tabs.map(item => uiH('button', {
      key: item[0],
      type: 'button',
      className: 'dshp-tab',
      role: 'tab',
      'aria-selected': tab === item[0],
      onClick: () => { setTab(item[0]); setNotice('') },
    }, item[1]))),
    uiH('div', { className: 'dshp-panel-body' },
      body,
      notice === '' ? null : uiH('div', { style: { marginTop: 12 } }, uiH(UiNotice, { error: true }, notice))),
    uiH('div', { className: 'dshp-footer' },
      uiH('span', null, t('panel.footer')),
      uiH('span', null, t('app.version', { version: snap.petVersion })))))
}

/**
 * Root overlay entry. In the normal DSH page it is headless and only forwards
 * session status. In the separate desktop-router window (`?dsh-pet-desktop=1`)
 * it renders the original React pet/settings UI, giving the desktop window the
 * exact same layout as the in-app version.
 * @param props - slot props plus the injected pet face.
 * @returns React node or null.
 */
export function PetLayer(props) {
  let desktopMode = false
  try {
    const windowName = window.name || ''
    desktopMode = windowName.includes('dsh-pet-desktop=1')
      || new URLSearchParams(window.location.search).get('dsh-pet-desktop') === '1'
      || window.location.hash.includes('dsh-pet-desktop=1')
      || (window.innerWidth <= 480 && window.innerHeight <= 820)
  } catch (_error) { /* non-browser */ }
  const snap = props.usePet(selector => selector)
  const statuses = props.useSessionStatus(selector => selector)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const anchorRef = React.useRef(null)
  const petRef = React.useRef(null)
  const panelRef = React.useRef(null)

  React.useEffect(() => {
    props.onStatuses(statuses)
  }, [statuses, props.onStatuses])

  React.useEffect(() => {
    if (!panelOpen && !menuOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setPanelOpen(false)
        setMenuOpen(false)
      }
    }
    const onDown = (event) => {
      const target = event.target
      const quickMenu = target instanceof Element && target.closest('.dshp-menu') !== null
      if (menuOpen && !quickMenu) setMenuOpen(false)
      if (panelRef.current !== null && panelRef.current.contains(target)) {
        if (menuOpen) setMenuOpen(false)
        return
      }
      if (anchorRef.current !== null && anchorRef.current.contains(target)) return
      setPanelOpen(false)
      setMenuOpen(false)
    }
    const onBlur = () => {
      setPanelOpen(false)
      setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [panelOpen, menuOpen])

  React.useEffect(() => {
    if (!desktopMode) return undefined
    document.body.classList.add('dshp-desktop-mode')
    document.title = 'DSH Pet'
    const width = window.innerWidth
    const height = window.innerHeight
    const size = Math.round(snap.prefs.size * (snap.compact ? 0.75 : 1))
    const border = Math.max(0, (window.outerWidth - width) / 2)
    const chrome = Math.max(0, window.outerHeight - height)
    if (snap.prefs.position === null || snap.prefs.position.x === null || snap.prefs.position.y === null) {
      props.setPosition({
        x: window.screenX + border + width - size - 16,
        y: window.screenY + chrome + height - size - 72,
      })
    }
    if (!snap.prefs.visible) props.setPrefs({ visible: true })
    try {
      const nameParams = new URLSearchParams(window.name || '')
      const targetSession = new URLSearchParams(window.location.search).get('dsh-pet-session')
        || new URLSearchParams(window.location.hash.replace(/^#/, '')).get('dsh-pet-session')
        || nameParams.get('dsh-pet-session')
      if (targetSession !== null && targetSession !== '') props.openSession(targetSession)
      const rawPrefs = nameParams.get('dsh-pet-prefs')
      const initialized = localStorage.getItem('dsh-pet:desktop-initialized') === '1'
      if (!initialized && rawPrefs !== null && rawPrefs !== '') {
        try {
          const importedPrefs = JSON.parse(rawPrefs)
          delete importedPrefs.position
          delete importedPrefs.desktopWindow
          props.setPrefs(importedPrefs)
          localStorage.setItem('dsh-pet:desktop-initialized', '1')
        } catch (_error) { /* ignore malformed bootstrap prefs */ }
      }
    } catch (_error) { /* no session/prefs query */ }
    return () => { document.body.classList.remove('dshp-desktop-mode') }
  }, [desktopMode])

  React.useEffect(() => {
    if (!desktopMode) return undefined
    let previous = ''
    const updateHitRegion = () => {
      try {
        const bridge = window.chrome && window.chrome.webview
        if (!bridge || typeof bridge.postMessage !== 'function') return
        const pet = document.querySelector('.dshp-pet')
        if (pet !== null && pet.getAttribute('data-dragging') === 'true') return
        const boxes = []
        document.querySelectorAll('.dshp-pet, .dshp-panel, .dshp-menu, .dshp-plaque, .dshp-bubble, .dshp-tasks, .dshp-focus-chip').forEach((element) => {
          const rect = element.getBoundingClientRect()
          if (rect.width < 2 || rect.height < 2) return
          boxes.push({
            x: rect.left,
            y: rect.top,
            w: rect.width,
            h: rect.height,
          })
        })
        const signature = JSON.stringify(boxes)
        if (signature === previous) return
        previous = signature
        bridge.postMessage({ type: 'dsh-pet-regions', boxes })
      } catch (_error) { /* bridge unavailable */ }
    }
    const timer = window.setInterval(updateHitRegion, 120)
    const first = window.setTimeout(updateHitRegion, 80)
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(updateHitRegion) : null
    if (observer !== null) observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', updateHitRegion)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(first)
      if (observer !== null) observer.disconnect()
      window.removeEventListener('resize', updateHitRegion)
    }
  }, [desktopMode, panelOpen, menuOpen])

  if (!desktopMode) return null

  const size = Math.round(snap.prefs.size * (snap.compact ? 0.75 : 1))
  const setPanel = (value) => {
    if (value === false) {
      setPanelOpen(false)
      return
    }
    setMenuOpen(false)
    setPanelOpen(true)
  }
  if (!snap.prefs.visible || snap.layout.visible === false) {
    return mountLayer(uiH(PetHandle, {
      snap,
      actions: props,
      offscreen: snap.layout.visible === false,
      desktop: false,
    }))
  }
  return mountLayer(uiH(React.Fragment, null,
    uiH(PetAnchor, {
      snap,
      actions: props,
      size,
      anchorRef,
      petRef,
      menuOpen,
      setMenuOpen,
      setPanelOpen: setPanel,
      desktopMode: true,
    }),
    panelOpen
      ? uiH(SettingsPanel, {
        snap,
        actions: props,
        size,
        petRef,
        panelRef,
        onClose: () => { setPanelOpen(false) },
      })
      : null))
}

/**
 * Mount the overlay at body level so DSH chat cards, side panels and their
 * stacking contexts cannot clip or cover the pet.
 * @param node - React node.
 * @returns React portal or the node when no body is available.
 */
function mountLayer(node) {
  if (typeof createPortal !== 'function') return node
  if (typeof document === 'undefined' || document.body === null || document.body === undefined) return node
  return createPortal(node, document.body)
}
