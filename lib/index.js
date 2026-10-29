/**
 * dsh-pet host half.
 *
 * The pet is entirely a browser-side plugin: it reads session projections and
 * the existing account Remote from the Web Client. This host row exists so a
 * profile can enable the bundle and so the `dsh.client` scan can discover
 * `lib/client.js`. It intentionally owns no services, sockets or timers.
 *
 * @module dsh-pet
 */

/** Cordis plugin name. */
export const name = 'dsh-pet'

/**
 * Mount the host half. Nothing to mount: the browser half carries the feature.
 * @returns undefined
 */
export function apply() {}
