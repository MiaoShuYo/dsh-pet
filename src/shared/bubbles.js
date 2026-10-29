/**
 * One-visible-bubble policy. Higher-priority tones replace lower ones;
 * sticky bubbles (waiting for the user) survive everything else.
 * @module dsh-pet/shared/bubbles
 */

/** Tone priority. */
export const BUBBLE_RANK = {
  waiting: 100,
  danger: 90,
  warn: 80,
  balance: 70,
  error: 60,
  completion: 50,
  focus: 40,
  water: 30,
  idle: 10,
}

/**
 * Rank one tone.
 * @param tone - bubble tone.
 * @returns numeric rank.
 */
export function bubbleRank(tone) {
  return BUBBLE_RANK[tone] || BUBBLE_RANK.idle
}

/**
 * Decide whether an incoming bubble should replace the visible one.
 * @param current - visible bubble or null.
 * @param incoming - candidate bubble.
 * @returns whether to replace.
 */
export function shouldReplaceBubble(current, incoming) {
  if (incoming === null || incoming === undefined) return false
  if (current === null || current === undefined) return true
  if (current.sticky) {
    return Boolean(incoming.sticky) && incoming.key !== current.key
  }
  if (incoming.sticky) return true
  const currentRank = current.rank !== undefined ? current.rank : bubbleRank(current.tone)
  const incomingRank = incoming.rank !== undefined ? incoming.rank : bubbleRank(incoming.tone)
  if (incomingRank !== currentRank) return incomingRank > currentRank
  return Number(incoming.seq) >= Number(current.seq)
}

/**
 * Build a bubble record.
 * @param options - bubble fields.
 * @returns bubble record with rank and expiry.
 */
export function makeBubble(options) {
  const sticky = options.sticky === true
  return {
    seq: Number(options.seq) || 0,
    key: String(options.key || ''),
    tone: options.tone || 'idle',
    rank: bubbleRank(options.tone),
    params: options.params || {},
    action: options.action || null,
    sessionId: options.sessionId || null,
    sticky,
    createdAt: Number(options.now) || 0,
    expiresAt: sticky ? 0 : (Number(options.now) || 0) + (Number(options.ttlMs) || 6000),
  }
}

/**
 * Whether a bubble has expired.
 * @param bubble - bubble.
 * @param now - epoch ms.
 * @returns whether it should be cleared.
 */
export function isBubbleExpired(bubble, now) {
  if (bubble === null || bubble === undefined) return false
  if (bubble.sticky) return false
  return bubble.expiresAt > 0 && now >= bubble.expiresAt
}
