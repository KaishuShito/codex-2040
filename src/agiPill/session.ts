import type { GameState } from '../engine'
import { decodeSession, encodeSession, type PersistedSession } from '../session'

/**
 * AGI Pill saves use a separate key. Existing Standard keys remain untouched so
 * the current client and its D1 telemetry contract continue to work unchanged.
 */
export const MODE_SESSION_STORAGE_KEY = 'codex-2040:agi-pill-session:v1'
export const MODE_SESSION_VERSION = 1 as const

export type GameMode = 'standard' | 'agi-pill'
export type AgiPillSpeed = 1 | 8

export type AgiPillPlayback = {
  speed: AgiPillSpeed
  paused: boolean
}

export const DEFAULT_AGI_PILL_PLAYBACK: AgiPillPlayback = {
  speed: 1,
  paused: false,
}

export type StandardModeSession = {
  version: typeof MODE_SESSION_VERSION
  mode: 'standard'
  session: PersistedSession
}

export type AgiPillModeSession<State> = {
  version: typeof MODE_SESSION_VERSION
  mode: 'agi-pill'
  rulesetVersion: string
  savedAt: string
  hasStarted: boolean
  speed: AgiPillSpeed
  paused: boolean
  state: State
}

export type ModeSession<State> = StandardModeSession | AgiPillModeSession<State>

export type AgiPillSessionCodec<State> = {
  /** A mode-specific ruleset prevents a stale Pill simulation from hydrating. */
  rulesetVersion: string
  /** Return the hydrated state, or null when the persisted value is invalid. */
  decodeState: (value: unknown) => State | null
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'

const decodeStandardObject = (value: unknown): PersistedSession | null => {
  try {
    return decodeSession(JSON.stringify(value))
  } catch {
    return null
  }
}

/**
 * Decode the versioned mode envelope. A pre-envelope Standard v1/v2 save is
 * deliberately accepted and normalized to the Standard discriminant.
 */
export function decodeModeSession<State>(
  raw: string | null,
  agiPill: AgiPillSessionCodec<State>,
): ModeSession<State> | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (isObject(parsed)
    && parsed.version === MODE_SESSION_VERSION
    && parsed.mode === 'standard'
    && 'session' in parsed) {
    const session = decodeStandardObject(parsed.session)
    return session ? { version: MODE_SESSION_VERSION, mode: 'standard', session } : null
  }

  if (isObject(parsed)
    && parsed.version === MODE_SESSION_VERSION
    && parsed.mode === 'agi-pill'
    && parsed.rulesetVersion === agiPill.rulesetVersion
    && typeof parsed.savedAt === 'string'
    && typeof parsed.hasStarted === 'boolean'
    && (parsed.speed === undefined || parsed.speed === 1 || parsed.speed === 8)
    && (parsed.paused === undefined || typeof parsed.paused === 'boolean')) {
    let state: State | null
    try {
      state = agiPill.decodeState(parsed.state)
    } catch {
      // A state migration/validator must never make application startup fail.
      return null
    }
    const speed: AgiPillSpeed = parsed.speed === 8 ? 8 : DEFAULT_AGI_PILL_PLAYBACK.speed
    const paused = parsed.paused === true
    return state === null ? null : {
      version: MODE_SESSION_VERSION,
      mode: 'agi-pill',
      rulesetVersion: agiPill.rulesetVersion,
      savedAt: parsed.savedAt,
      hasStarted: parsed.hasStarted,
      speed,
      paused,
      state,
    }
  }

  // Compatibility path for values read from either historical Standard key.
  const legacyStandard = decodeSession(raw)
  return legacyStandard
    ? { version: MODE_SESSION_VERSION, mode: 'standard', session: legacyStandard }
    : null
}

/** Wrap the existing Standard codec; this does not change its save contract. */
export function encodeStandardModeSession(
  state: GameState,
  hasStarted: boolean,
  savedAt = new Date().toISOString(),
): string {
  const session = decodeSession(encodeSession(state, hasStarted, savedAt))
  if (!session) throw new Error('Standard session codec rejected a newly encoded state')
  return JSON.stringify({
    version: MODE_SESSION_VERSION,
    mode: 'standard',
    session,
  } satisfies StandardModeSession)
}

export function encodeAgiPillModeSession<State>(
  state: State,
  hasStarted: boolean,
  rulesetVersion: string,
  savedAt = new Date().toISOString(),
  playback: AgiPillPlayback = DEFAULT_AGI_PILL_PLAYBACK,
): string {
  return JSON.stringify({
    version: MODE_SESSION_VERSION,
    mode: 'agi-pill',
    rulesetVersion,
    savedAt,
    hasStarted,
    speed: playback.speed,
    paused: playback.paused,
    state,
  } satisfies AgiPillModeSession<State>)
}
