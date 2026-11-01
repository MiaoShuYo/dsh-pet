/**
 * All pet CSS. Injected once as a `<style data-plugin="dsh-pet">` tag, removed
 * on plugin unload. Colors lean on DSH theme variables with safe fallbacks.
 * @module dsh-pet/client/styles
 */

/** The stylesheet text. */
export const PET_CSS = `
.dshp-root {
  --dshp-fg: var(--dsw-alias-label-primary, #1b2440);
  --dshp-muted: var(--dsw-alias-label-secondary, #5b6478);
  --dshp-bg: var(--dsw-alias-bg-layer-1, #ffffff);
  --dshp-bg2: var(--dsw-alias-bg-layer-2, #f2f4f8);
  --dshp-border: var(--dsw-alias-border-l1, #dbe2f0);
  --dshp-accent: #4d6bfe;
  --dshp-danger: var(--dsw-alias-state-error-primary, #d64545);
  --dshp-warn: var(--dsw-alias-state-warn-primary, #e6a23c);
  --dshp-ok: var(--dsw-alias-state-success-primary, #31b56a);
  --dshp-bubble-bg: #232a3d;
  color: var(--dshp-fg);
  font-family: inherit;
  pointer-events: none;
}
.dshp-root, .dshp-root * { box-sizing: border-box; }
body[data-ds-dark-theme] .dshp-root {
  --dshp-accent: #6da8ff;
  --dshp-bubble-bg: #10152a;
}
.dshp-anchor {
  position: fixed;
  z-index: 40;
  pointer-events: none;
}
.dshp-pet-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.dshp-pet {
  pointer-events: auto;
  width: var(--dshp-size, 120px);
  height: var(--dshp-size, 120px);
  display: block;
  padding: 0;
  border: 0;
  background: none;
  cursor: grab;
  touch-action: none;
  border-radius: 18px;
}
.dshp-pet:active { cursor: grabbing; }
.dshp-pet:focus-visible {
  outline: 2px solid var(--dshp-accent);
  outline-offset: 4px;
}
.dshp-mascot {
  width: 100%;
  height: 100%;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.18));
  transform-origin: 50% 90%;
}
.dshp-image { object-fit: contain; }
.dshp-pet[data-state="idle"] .dshp-mascot { animation: dshp-bob 2.8s ease-in-out infinite; }
.dshp-pet[data-state="working"] .dshp-mascot { animation: dshp-bounce 0.9s ease-in-out infinite; }
.dshp-pet[data-state="waiting"] .dshp-mascot { animation: dshp-alert 1.1s ease-in-out infinite; }
.dshp-pet[data-state="happy"] .dshp-mascot { animation: dshp-happy 0.7s ease-in-out; }
.dshp-pet[data-state="sad"] .dshp-mascot { animation: dshp-droop 2.4s ease-in-out infinite; }
.dshp-pet[data-state="sleepy"] .dshp-mascot { animation: dshp-breathe 4s ease-in-out infinite; }
.dshp-pet[data-state="focusing"] .dshp-mascot { animation: dshp-focus 2s ease-in-out infinite; }
.dshp-pet[data-state="working"] .dshp-laptop,
.dshp-pet[data-state="focusing"] .dshp-laptop { animation: dshp-laptop 1.2s ease-in-out infinite; transform-origin: 60px 96px; }
.dshp-pet[data-state="working"] .dshp-screen-prompt,
.dshp-pet[data-state="focusing"] .dshp-screen-prompt { animation: dshp-screen-blink 1.6s steps(2, end) infinite; }
.dshp-pet:hover .dshp-mascot { filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.24)); }
.dshp-tail { animation: dshp-tail 2.2s ease-in-out infinite; }
.dshp-sparkles { animation: dshp-sparkle 1.2s ease-in-out infinite; }
.dshp-zzz { animation: dshp-float 3s ease-in-out infinite; }
.dshp-work-dots { animation: dshp-sparkle 1.4s ease-in-out infinite; }
.dshp-plaque {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--dshp-bg);
  border: 1px solid var(--dshp-border);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14);
  color: var(--dshp-fg);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  max-width: 240px;
  backdrop-filter: blur(8px);
}
.dshp-balance, .dshp-tokens {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  margin: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.dshp-balance { font-weight: 650; }
.dshp-tokens { color: var(--dshp-muted); font-variant-numeric: tabular-nums; }
.dshp-balance:hover, .dshp-tokens:hover { color: var(--dshp-accent); }
.dshp-more {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--dshp-muted);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
}
.dshp-more:hover, .dshp-more[aria-expanded="true"] { background: var(--dshp-bg2); color: var(--dshp-fg); }
.dshp-floaters {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}
.dshp-floaters > * { pointer-events: auto; }
.dshp-menu {
  position: relative;
  right: auto;
  bottom: auto;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 176px;
  padding: 6px;
  border: 1px solid var(--dshp-border);
  border-radius: 12px;
  background: var(--dshp-bg);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.3);
  pointer-events: auto;
  animation: dshp-pop 0.14s ease-out;
}
.dshp-menu-item {
  padding: 7px 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dshp-fg);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dshp-menu-item:hover { background: var(--dshp-bg2); }
.dshp-menu-sep { height: 1px; margin: 4px 6px; background: var(--dshp-border); }
.dshp-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--dshp-muted); opacity: 0.55; }
.dshp-ring { width: 16px; height: 16px; display: block; flex: none; }
.dshp-ring circle { fill: none; stroke-width: 3; stroke-linecap: round; }
.dshp-ring .dshp-ring-track { stroke: var(--dshp-border); }
.dshp-ring .dshp-ring-value { stroke: var(--dshp-ok); transition: stroke-dasharray 0.25s ease, stroke 0.25s ease; }
.dshp-ring[data-tone="warn"] .dshp-ring-value { stroke: var(--dshp-warn); }
.dshp-ring[data-tone="danger"] .dshp-ring-value { stroke: var(--dshp-danger); }
.dshp-ring[data-tone="none"] .dshp-ring-value { stroke: var(--dshp-border); }
.dshp-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dshp-warn);
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.22);
  animation: dshp-pulse 1.4s ease-in-out infinite;
}
.dshp-focus-chip {
  position: absolute;
  left: 0;
  bottom: 6px;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--dshp-accent);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
}
.dshp-bubble {
  position: relative;
  right: auto;
  bottom: auto;
  max-width: min(260px, 72vw);
  padding: 9px 30px 9px 12px;
  border-radius: 14px;
  background: var(--dshp-bubble-bg);
  color: #ffffff;
  font-size: 13px;
  line-height: 1.45;
  text-align: left;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.32);
  pointer-events: auto;
  z-index: 3;
  animation: dshp-pop 0.16s ease-out;
  word-break: break-word;
}
.dshp-bubble[data-tone="waiting"], .dshp-bubble[data-tone="danger"] { background: #8f1d2c; }
.dshp-bubble[data-tone="warn"], .dshp-bubble[data-tone="balance"] { background: #7a4a10; }
.dshp-bubble[data-tone="completion"] { background: #1d4d3a; }
.dshp-bubble-close {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
}
.dshp-bubble-close:hover { opacity: 1; background: rgba(255, 255, 255, 0.12); }
.dshp-bubble-action {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dshp-tasks {
  min-width: 190px;
  max-width: 280px;
  padding: 8px 10px 9px;
  border: 1px solid var(--dshp-border);
  border-radius: 12px;
  background: var(--dshp-bg);
  color: var(--dshp-fg);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.3);
  pointer-events: auto;
  animation: dshp-pop 0.16s ease-out;
}
.dshp-tasks-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--dshp-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.dshp-tasks-dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--dshp-accent);
  box-shadow: 0 0 0 3px rgba(109, 168, 255, 0.16);
  animation: dshp-pulse 1.4s ease-in-out infinite;
}
.dshp-tasks-count {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--dshp-bg2);
  color: var(--dshp-fg);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.dshp-task {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 5px;
  padding: 6px 8px;
  border-radius: 8px;
  border-left: 2px solid var(--dshp-accent);
  background: var(--dshp-bg2);
}
.dshp-task[data-status="stopping"] { border-left-color: var(--dshp-warn); }
.dshp-task-label {
  overflow: hidden;
  color: var(--dshp-fg);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshp-task-status {
  overflow: hidden;
  color: var(--dshp-muted);
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshp-task-more {
  margin-top: 6px;
  color: var(--dshp-muted);
  font-size: 10px;
  text-align: right;
}
.dshp-panel {
  position: fixed;
  z-index: 80;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dshp-bg);
  color: var(--dshp-fg);
  border: 1px solid var(--dshp-border);
  border-radius: 16px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.32);
  pointer-events: auto;
  font-size: 12px;
  animation: dshp-pop 0.16s ease-out;
}
.dshp-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px 8px;
}
.dshp-title { font-size: 14px; font-weight: 700; line-height: 1.2; }
.dshp-sub { color: var(--dshp-muted); font-size: 11px; line-height: 1.4; margin-top: 2px; }
.dshp-icon-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--dshp-muted);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  flex: none;
}
.dshp-icon-btn:hover { background: var(--dshp-bg2); color: var(--dshp-fg); }
.dshp-tabs {
  display: flex;
  gap: 2px;
  padding: 0 8px;
  border-bottom: 1px solid var(--dshp-border);
}
.dshp-tab {
  flex: 1;
  min-width: 0;
  padding: 8px 4px;
  border: 0;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--dshp-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dshp-tab:hover { color: var(--dshp-fg); }
.dshp-tab[aria-selected="true"] {
  color: var(--dshp-fg);
  background: var(--dshp-bg2);
  font-weight: 650;
}
.dshp-panel-body {
  padding: 12px 14px 18px;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--dshp-border) transparent;
}
.dshp-panel-body::-webkit-scrollbar { width: 8px; }
.dshp-panel-body::-webkit-scrollbar-track { background: transparent; }
.dshp-panel-body::-webkit-scrollbar-thumb {
  background: var(--dshp-border);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}
.dshp-section { display: flex; flex-direction: column; gap: 9px; margin-bottom: 16px; }
.dshp-section:last-child { margin-bottom: 0; }
.dshp-section-title {
  color: var(--dshp-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.dshp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 28px;
  line-height: 1.35;
}
.dshp-row-label { min-width: 0; color: var(--dshp-fg); }
.dshp-value { font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; }
.dshp-hint { color: var(--dshp-muted); font-size: 11px; line-height: 1.45; margin: -2px 0 2px; }
.dshp-input, .dshp-select {
  min-width: 0;
  padding: 4px 7px;
  border: 1px solid var(--dshp-border);
  border-radius: 8px;
  background: var(--dshp-bg2);
  color: var(--dshp-fg);
  font: inherit;
  font-size: 12px;
}
.dshp-input { width: 68px; }
.dshp-range { width: 100%; accent-color: var(--dshp-accent); }
.dshp-input:focus, .dshp-select:focus { outline: 2px solid var(--dshp-accent); outline-offset: 1px; }
.dshp-toggle {
  position: relative;
  width: 38px;
  height: 22px;
  flex: none;
  padding: 0;
  border: 1px solid var(--dshp-border);
  border-radius: 999px;
  background: var(--dshp-bg2);
  cursor: pointer;
}
.dshp-toggle::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease;
}
.dshp-toggle.is-on { background: var(--dshp-accent); border-color: var(--dshp-accent); }
.dshp-toggle.is-on::after { transform: translateX(16px); }
.dshp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 11px;
  border: 1px solid var(--dshp-border);
  border-radius: 9px;
  background: var(--dshp-bg2);
  color: var(--dshp-fg);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.dshp-btn:hover { border-color: var(--dshp-accent); }
.dshp-btn:disabled { opacity: 0.5; cursor: default; }
.dshp-btn.primary { background: var(--dshp-accent); border-color: var(--dshp-accent); color: #ffffff; }
.dshp-btn.ghost { background: transparent; border-color: transparent; color: var(--dshp-muted); }
.dshp-btn.ghost:hover { background: var(--dshp-bg2); color: var(--dshp-fg); }
.dshp-btn.danger { color: var(--dshp-danger); border-color: var(--dshp-danger); background: transparent; }
.dshp-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.dshp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.dshp-skin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  border: 2px solid transparent;
  border-radius: 12px;
  background: var(--dshp-bg2);
  color: var(--dshp-muted);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  overflow: hidden;
}
.dshp-skin.is-active { border-color: var(--dshp-accent); color: var(--dshp-fg); }
.dshp-skin-mascot { width: 46px; height: 46px; pointer-events: none; }
.dshp-skin-mascot .dshp-mascot { filter: none; animation: none; }
.dshp-progress {
  height: 8px;
  overflow: hidden;
  border: 1px solid var(--dshp-border);
  border-radius: 999px;
  background: var(--dshp-bg2);
}
.dshp-progress > span { display: block; height: 100%; border-radius: 999px; background: var(--dshp-ok); transition: width 0.25s ease; }
.dshp-progress[data-tone="warn"] > span { background: var(--dshp-warn); }
.dshp-progress[data-tone="danger"] > span { background: var(--dshp-danger); }
.dshp-list { display: flex; flex-direction: column; gap: 4px; }
.dshp-list-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; line-height: 1.4; }
.dshp-list-row .dshp-value { font-weight: 600; }
.dshp-empty {
  padding: 14px 12px;
  border: 1px dashed var(--dshp-border);
  border-radius: 12px;
  color: var(--dshp-muted);
  text-align: center;
  line-height: 1.5;
}
.dshp-error { color: var(--dshp-danger); font-size: 11px; line-height: 1.45; }
.dshp-notice {
  padding: 7px 9px;
  border-radius: 9px;
  background: var(--dshp-bg2);
  color: var(--dshp-muted);
  font-size: 11px;
  line-height: 1.45;
}
.dshp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px 10px;
  border-top: 1px solid var(--dshp-border);
  color: var(--dshp-muted);
  font-size: 10px;
}
.dshp-handle {
  position: fixed;
  z-index: 40;
  pointer-events: auto;
  width: 30px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--dshp-border);
  border-radius: 12px 0 0 12px;
  background: var(--dshp-bg);
  color: var(--dshp-fg);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16);
  cursor: pointer;
  font-size: 14px;
}
.dshp-handle:hover { background: var(--dshp-bg2); }
.dshp-demo { display: flex; flex-wrap: wrap; gap: 6px; }
.dshp-demo .dshp-btn { font-size: 11px; padding: 5px 8px; }
.dshp-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes dshp-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes dshp-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  45% { transform: translateY(-7px) scale(1.02, 0.98); }
}
@keyframes dshp-alert {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-2.5deg); }
  40% { transform: rotate(2.5deg); }
  60% { transform: rotate(-1.5deg); }
  80% { transform: rotate(1.5deg); }
}
@keyframes dshp-happy {
  0% { transform: scale(1); }
  40% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
@keyframes dshp-droop {
  0%, 100% { transform: translateY(1px); }
  50% { transform: translateY(4px); }
}
@keyframes dshp-breathe {
  0%, 100% { transform: scale(1); opacity: 0.92; }
  50% { transform: scale(1.025); opacity: 1; }
}
@keyframes dshp-focus {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
@keyframes dshp-laptop {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1.5px); }
}
@keyframes dshp-screen-blink {
  0%, 45% { opacity: 1; }
  50%, 100% { opacity: 0.35; }
}
@keyframes dshp-tail {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(8deg); }
}
@keyframes dshp-sparkle {
  0%, 100% { opacity: 0.35; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.05); }
}
@keyframes dshp-float {
  0%, 100% { transform: translateY(0); opacity: 0.8; }
  50% { transform: translateY(-4px); opacity: 1; }
}
@keyframes dshp-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
@keyframes dshp-pop {
  from { opacity: 0; transform: translateY(4px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (max-width: 640px) {
  .dshp-plaque { font-size: 11px; padding: 4px 7px; gap: 5px; }
  .dshp-panel { border-radius: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .dshp-mascot, .dshp-tail, .dshp-sparkles, .dshp-zzz, .dshp-work-dots, .dshp-badge, .dshp-bubble, .dshp-panel {
    animation: none !important;
    transition: none !important;
  }
}
`
