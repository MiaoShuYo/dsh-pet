/**
 * dsh-pet host half.
 *
 * The pet UI lives in the browser half. This host half owns one loopback bridge
 * for the optional Windows desktop window: the Web Client POSTs a small state
 * summary, the PowerShell/WPF companion polls it, and `/open` / `/close` manage
 * that companion process. On non-Windows platforms the bridge exists but
 * `/open` reports that the desktop window is unavailable.
 *
 * @module dsh-pet
 */
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name. */
export const name = 'dsh-pet'

const PORT = 45873
const MAX_BODY = 256 * 1024
const HERE = dirname(fileURLToPath(import.meta.url))
const HELPER = join(HERE, 'desktop', 'pet-window.ps1')
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,x-dsh-pet',
  'Access-Control-Allow-Private-Network': 'true',
  'Cache-Control': 'no-store',
}

/** Serialize one JSON response with CORS headers. */
function sendJson(response, status, value) {
  response.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

/** Read a bounded JSON request body. */
function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text === '' ? {} : JSON.parse(text))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

/**
 * Mount the host bridge.
 * @param ctx - Cordis host context.
 * @returns undefined
 */
export function apply(ctx) {
  let state = { ok: false, updatedAt: 0 }
  let helper = null
  let settingsRevision = 0
  let settings = { revision: 0, patch: null, action: null, params: null }

  const startHelper = () => {
    if (process.platform !== 'win32') return { ok: false, error: 'windows-only' }
    if (!existsSync(HELPER)) return { ok: false, error: 'desktop-window-not-installed' }
    if (helper !== null) return { ok: true, running: true, pid: helper.pid }
    try {
      helper = spawn('powershell.exe', [
        '-NoProfile',
        '-STA',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        HELPER,
        '-Port',
        String(PORT),
      ], { windowsHide: true, stdio: 'ignore' })
      helper.on('exit', () => { helper = null })
      helper.on('error', (error) => {
        console.error('[dsh-pet] desktop helper:', error instanceof Error ? error.message : error)
        helper = null
      })
      return { ok: true, running: true, pid: helper.pid }
    } catch (error) {
      helper = null
      return { ok: false, error: error instanceof Error ? error.message : 'spawn-failed' }
    }
  }

  const cleanupStaleHelpers = () => {
    if (process.platform !== 'win32') return
    try {
      execFileSync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*pet-window.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ], { windowsHide: true, timeout: 5000, stdio: 'ignore' })
    } catch (_error) { /* old helper may already be gone */ }
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS)
      response.end()
      return
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      sendJson(response, 200, {
        ok: true,
        running: helper !== null,
        pid: helper === null ? null : helper.pid,
        platform: process.platform,
        desktopAvailable: process.platform === 'win32' && existsSync(HELPER),
        updatedAt: state.updatedAt || 0,
      })
      return
    }
    if (url.pathname === '/state' && request.method === 'GET') {
      sendJson(response, 200, state)
      return
    }
    if (url.pathname === '/state' && request.method === 'POST') {
      try {
        const value = await readJson(request)
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          sendJson(response, 400, { ok: false, error: 'state must be an object' })
          return
        }
        state = { ...value, ok: true, updatedAt: Date.now() }
        sendJson(response, 200, { ok: true })
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : 'invalid state' })
      }
      return
    }
    if (url.pathname === '/settings' && request.method === 'GET') {
      sendJson(response, 200, settings)
      return
    }
    if (url.pathname === '/settings' && request.method === 'POST') {
      try {
        const value = await readJson(request)
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          sendJson(response, 400, { ok: false, error: 'settings must be an object' })
          return
        }
        settingsRevision += 1
        settings = {
          revision: settingsRevision,
          patch: value.patch !== null && typeof value.patch === 'object' ? value.patch : null,
          action: typeof value.action === 'string' ? value.action : null,
          params: value.params !== null && typeof value.params === 'object' ? value.params : null,
        }
        sendJson(response, 200, { ok: true, revision: settingsRevision })
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : 'invalid settings' })
      }
      return
    }
    if (url.pathname === '/open' && request.method === 'POST') {
      sendJson(response, 200, startHelper())
      return
    }
    if (url.pathname === '/close' && request.method === 'POST') {
      if (helper !== null) {
        try { helper.kill() } catch (_error) { /* already gone */ }
        helper = null
      }
      sendJson(response, 200, { ok: true, running: false })
      return
    }
    sendJson(response, 404, { ok: false, error: 'not-found' })
  })

  server.on('error', (error) => {
    console.error('[dsh-pet] desktop bridge:', error instanceof Error ? error.message : error)
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[dsh-pet] desktop bridge on http://127.0.0.1:${PORT}`)
    setTimeout(() => {
      cleanupStaleHelpers()
      startHelper()
    }, 1200)
  })

  if (ctx !== null && ctx !== undefined && typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      try { server.close() } catch (_error) { /* already closed */ }
      if (helper !== null) {
        try { helper.kill() } catch (_error) { /* already gone */ }
        helper = null
      }
    }, 'dsh-pet: desktop bridge')
  }
}
