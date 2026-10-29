/**
 * Mascot rendering: built-in vector cats and imported image packs.
 * @module dsh-pet/client/mascot
 */
import { BUILTIN_SKINS, skinStateImage } from '../shared/skins.js'

const mascotH = React.createElement

/**
 * Eye shapes for each presentation state.
 * @param palette - skin palette.
 * @param state - presentation state.
 * @returns SVG child nodes.
 */
function mascotEyes(palette, state) {
  if (state === 'happy') {
    return [
      mascotH('path', {
        key: 'eye-l',
        d: 'M44 47 Q50 41 56 47',
        fill: 'none',
        stroke: palette.pupil,
        strokeWidth: 2.8,
        strokeLinecap: 'round',
      }),
      mascotH('path', {
        key: 'eye-r',
        d: 'M64 47 Q70 41 76 47',
        fill: 'none',
        stroke: palette.pupil,
        strokeWidth: 2.8,
        strokeLinecap: 'round',
      }),
    ]
  }
  if (state === 'sleepy') {
    return [
      mascotH('line', {
        key: 'eye-l',
        x1: 45, y1: 48, x2: 55, y2: 48,
        stroke: palette.pupil, strokeWidth: 2.6, strokeLinecap: 'round',
      }),
      mascotH('line', {
        key: 'eye-r',
        x1: 65, y1: 48, x2: 75, y2: 48,
        stroke: palette.pupil, strokeWidth: 2.6, strokeLinecap: 'round',
      }),
    ]
  }
  if (state === 'sad') {
    return [
      mascotH('path', {
        key: 'eye-l',
        d: 'M44 49 Q50 53 56 49',
        fill: 'none',
        stroke: palette.pupil,
        strokeWidth: 2.8,
        strokeLinecap: 'round',
      }),
      mascotH('path', {
        key: 'eye-r',
        d: 'M64 49 Q70 53 76 49',
        fill: 'none',
        stroke: palette.pupil,
        strokeWidth: 2.8,
        strokeLinecap: 'round',
      }),
      mascotH('line', {
        key: 'brow-l',
        x1: 43, y1: 40, x2: 55, y2: 43,
        stroke: palette.furDark, strokeWidth: 2.2, strokeLinecap: 'round',
      }),
      mascotH('line', {
        key: 'brow-r',
        x1: 77, y1: 40, x2: 65, y2: 43,
        stroke: palette.furDark, strokeWidth: 2.2, strokeLinecap: 'round',
      }),
    ]
  }
  const wide = state === 'working' || state === 'focusing'
  const tall = state === 'waiting'
  const rx = wide ? 4.4 : tall ? 4.2 : 4
  const ry = wide ? 5.4 : tall ? 6 : 5
  return [
    mascotH('ellipse', {
      key: 'eye-l', cx: 50, cy: 46, rx, ry, fill: palette.pupil,
    }),
    mascotH('ellipse', {
      key: 'eye-r', cx: 70, cy: 46, rx, ry, fill: palette.pupil,
    }),
    mascotH('circle', {
      key: 'glint-l', cx: 51.4, cy: 44.2, r: 1.4, fill: '#ffffff', opacity: 0.9,
    }),
    mascotH('circle', {
      key: 'glint-r', cx: 71.4, cy: 44.2, r: 1.4, fill: '#ffffff', opacity: 0.9,
    }),
  ]
}

/**
 * Mouth shape for each state.
 * @param palette - skin palette.
 * @param state - presentation state.
 * @returns SVG node.
 */
function mascotMouth(palette, state) {
  if (state === 'happy') {
    return mascotH('path', {
      d: 'M53 56 Q60 65 67 56 Q60 61 53 56 Z',
      fill: palette.pupil,
      stroke: palette.pupil,
      strokeWidth: 1,
      strokeLinejoin: 'round',
    })
  }
  if (state === 'sad') {
    return mascotH('path', {
      d: 'M55 60 Q60 55 65 60',
      fill: 'none',
      stroke: palette.pupil,
      strokeWidth: 2,
      strokeLinecap: 'round',
    })
  }
  if (state === 'sleepy') {
    return mascotH('ellipse', {
      cx: 60, cy: 58, rx: 2.6, ry: 3.2, fill: palette.pupil, opacity: 0.85,
    })
  }
  return mascotH('path', {
    d: 'M56 56 Q60 60 64 56',
    fill: 'none',
    stroke: palette.pupil,
    strokeWidth: 2.2,
    strokeLinecap: 'round',
  })
}

/**
 * Skin accessory.
 * @param skin - vector skin.
 * @param palette - palette.
 * @returns SVG node or null.
 */
function mascotAccessory(skin, palette) {
  if (skin.accessory === 'scarf') {
    return mascotH('g', { key: 'scarf' },
      mascotH('path', {
        d: 'M43 69 Q60 82 77 69 L75 78 Q60 90 45 78 Z',
        fill: palette.accent,
        opacity: 0.95,
      }),
      mascotH('path', {
        d: 'M70 76 L78 92 L70 89 Z',
        fill: palette.accent,
        opacity: 0.8,
      }),
    )
  }
  if (skin.accessory === 'bow') {
    return mascotH('g', { key: 'bow' },
      mascotH('path', { d: 'M78 17 L92 10 L92 24 Z', fill: palette.accent }),
      mascotH('path', { d: 'M92 10 L106 17 L92 24 Z', fill: palette.accent }),
      mascotH('circle', { cx: 92, cy: 17, r: 3.4, fill: palette.belly }),
    )
  }
  if (skin.accessory === 'headband') {
    return mascotH('g', { key: 'headband' },
      mascotH('path', {
        d: 'M36 33 Q60 18 84 33',
        fill: 'none',
        stroke: palette.accent,
        strokeWidth: 5,
        strokeLinecap: 'round',
      }),
      mascotH('circle', { cx: 39, cy: 32, r: 3, fill: palette.belly }),
      mascotH('circle', { cx: 81, cy: 32, r: 3, fill: palette.belly }),
    )
  }
  return null
}

/**
 * State decoration: sparkles when happy, Zzz when sleepy.
 * @param palette - skin palette.
 * @param state - presentation state.
 * @returns SVG node or null.
 */
function mascotDecoration(palette, state) {
  if (state === 'happy') {
    return mascotH('g', { key: 'sparkles', className: 'dshp-sparkles' },
      mascotH('path', { d: 'M98 40 L100 46 L106 48 L100 50 L98 56 L96 50 L90 48 L96 46 Z', fill: palette.accent }),
      mascotH('path', { d: 'M22 38 L23.6 42 L28 43.5 L23.6 45 L22 49 L20.4 45 L16 43.5 L20.4 42 Z', fill: palette.blush }),
    )
  }
  if (state === 'sleepy') {
    return mascotH('g', { key: 'zzz', className: 'dshp-zzz' },
      mascotH('text', { x: 92, y: 34, fill: palette.accent, fontSize: 12, fontWeight: 700 }, 'Z'),
      mascotH('text', { x: 100, y: 24, fill: palette.accent, fontSize: 9, fontWeight: 700 }, 'z'),
    )
  }
  if (state === 'waiting') {
    return mascotH('g', { key: 'alert', className: 'dshp-alert-mark' },
      mascotH('circle', { cx: 94, cy: 26, r: 9, fill: palette.accent }),
      mascotH('text', {
        x: 94, y: 30, fill: '#ffffff', fontSize: 12, fontWeight: 800, textAnchor: 'middle',
      }, '!'),
    )
  }
  if (state === 'working' || state === 'focusing') {
    return mascotH('g', { key: 'dots', className: 'dshp-work-dots' },
      mascotH('circle', { cx: 24, cy: 30, r: 2.4, fill: palette.accent }),
      mascotH('circle', { cx: 31, cy: 24, r: 1.8, fill: palette.accent, opacity: 0.7 }),
      mascotH('circle', { cx: 37, cy: 30, r: 1.4, fill: palette.accent, opacity: 0.45 }),
    )
  }
  return null
}

/**
 * Render one mascot.
 * @param props - `{ skin, state }`.
 * @returns React node.
 */
export function Mascot(props) {
  const skin = props.skin
  const state = props.state || 'idle'
  if (skin === null || skin === undefined) return null
  if (skin.kind === 'image') {
    return mascotH('img', {
      className: 'dshp-mascot dshp-image',
      src: skinStateImage(skin, state),
      alt: '',
      draggable: false,
      'data-state': state,
    })
  }
  const palette = skin.palette || BUILTIN_SKINS[0].palette
  return mascotH('svg', {
    className: 'dshp-mascot dshp-vector',
    viewBox: '0 0 120 120',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': 'true',
    focusable: 'false',
    'data-state': state,
  },
  mascotH('g', { className: 'dshp-tail', style: { transformOrigin: '86px 88px' } },
    mascotH('path', {
      d: 'M84 90 C104 92 108 72 96 64',
      fill: 'none',
      stroke: palette.fur,
      strokeWidth: 11,
      strokeLinecap: 'round',
    })),
  mascotH('ellipse', { cx: 60, cy: 78, rx: 30, ry: 26, fill: palette.fur }),
  mascotH('ellipse', { cx: 60, cy: 83, rx: 19, ry: 16, fill: palette.belly, opacity: 0.95 }),
  mascotH('ellipse', { cx: 46, cy: 101, rx: 8, ry: 5, fill: palette.furDark }),
  mascotH('ellipse', { cx: 74, cy: 101, rx: 8, ry: 5, fill: palette.furDark }),
  mascotH('path', { d: 'M38 32 L32 9 L55 23 Z', fill: palette.fur }),
  mascotH('path', { d: 'M82 32 L88 9 L65 23 Z', fill: palette.fur }),
  mascotH('path', { d: 'M40 29 L37 15 L51 24 Z', fill: palette.ear }),
  mascotH('path', { d: 'M80 29 L83 15 L69 24 Z', fill: palette.ear }),
  mascotH('circle', { cx: 60, cy: 48, r: 27, fill: palette.fur }),
  mascotEyes(palette, state),
  mascotH('ellipse', { cx: 60, cy: 55, rx: 4.4, ry: 3.2, fill: palette.ear }),
  mascotMouth(palette, state),
  mascotH('line', {
    x1: 30, y1: 52, x2: 44, y2: 54,
    stroke: palette.furDark, strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.55,
  }),
  mascotH('line', {
    x1: 90, y1: 52, x2: 76, y2: 54,
    stroke: palette.furDark, strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.55,
  }),
  mascotH('ellipse', { cx: 41, cy: 56, rx: 5, ry: 3, fill: palette.blush, opacity: 0.55 }),
  mascotH('ellipse', { cx: 79, cy: 56, rx: 5, ry: 3, fill: palette.blush, opacity: 0.55 }),
  mascotAccessory(skin, palette),
  mascotDecoration(palette, state))
}
