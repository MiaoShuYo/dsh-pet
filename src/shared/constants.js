/**
 * Stable constants shared by the browser half, the build script and tests.
 * @module dsh-pet/shared/constants
 */

/** Package version shown in the settings panel; kept in sync by scripts/check.mjs. */
export const PET_VERSION = '0.7.4'

/** Snapshot schema version; bump when the store snapshot shape changes. */
export const SNAPSHOT_VERSION = 1

/** localStorage keys. Versioned so a schema change can migrate without collisions. */
export const STORAGE_KEYS = {
  prefs: 'dsh-pet:prefs:v1',
  skins: 'dsh-pet:skins:v1',
  stats: 'dsh-pet:stats:v1',
}

/** Loopback port shared by the host bridge, browser store and Windows helper. */
export const DESKTOP_BRIDGE_PORT = 45873

/** Pet presentation states, in priority order for the state machine. */
export const PET_STATES = ['waiting', 'focusing', 'working', 'sad', 'happy', 'sleepy', 'idle']

/** Skin image slots. Only `idle` is required; every other slot falls back to it. */
export const SKIN_STATES = ['idle', 'working', 'waiting', 'happy', 'sad', 'sleepy', 'focusing']

/** Default refresh interval choices, in seconds. */
export const REFRESH_INTERVAL_CHOICES = [30, 60, 300, 0]
