/**
 * Safe boundary between the deterministic simulation and the live GM.
 *
 * This module deliberately contains no network or Node file-system access so it
 * remains safe to import from the browser bundle. A bridge may execute the
 * atomic write plan returned by `createAtomicEventWritePlan`.
 */

export const GM_CONSTANTS = {
  eventDirectory: 'events',
  eventFilePrefix: 'evt-',
  eventFileSuffix: '.json',
  temporaryFileSuffix: '.tmp',
  heartbeatIntervalMs: 60_000,
  snapshotIntervalMs: 10_000,
  maxEventsPerCycle: 3,
  maxTotalUsersDeltaPctPerCycle: 90,
  maxQueuedActions: 32,
  maxPlayerInputChars: 60,
  maxActionIdChars: 80,
  maxHeadlineChars: 40,
  maxFlavorChars: 120,
  maxRegionIdChars: 32,
  eventTypes: ['news', 'feature_result', 'rival', 'community_event'],
  targets: ['codex', 'rivalAnthro', 'rivalGoo', 'rivalQi'],
  effectBounds: {
    users_delta_pct: { min: -30, max: 60 },
    share_delta: { min: -0.15, max: 0.20 },
    growth_rate_delta: { min: -0.2, max: 0.4 },
    trust_delta: { min: -8, max: 8 },
  },
  ttlDays: { min: 1, max: 30 },
  applicationTiming: 'on-receipt',
  dateSemantics: 'display-only',
} as const

export type GmEventType = (typeof GM_CONSTANTS.eventTypes)[number]
export type GmTarget = (typeof GM_CONSTANTS.targets)[number]
export type GmEffectKey = keyof typeof GM_CONSTANTS.effectBounds

export type GmEffect = {
  users_delta_pct: number
  share_delta: number
  growth_rate_delta: number
  trust_delta: number
  target: GmTarget
}

export type GmEvent = {
  id: string
  /** Display metadata only. Events are always applied when the engine receives them. */
  date: string
  type: GmEventType
  headline: string
  region: string | 'global'
  effect: GmEffect
  flavor: string
  ttl_days: number
}

export type GmSnapshot = {
  date: string
  A_world: number
  S_c: number
  HHI: number
  T: number
  K: number
  S: number
  G: number
  topRegions: readonly string[]
  recentEvents: readonly string[]
  playerInbox: readonly string[]
}

const UUID_EVENT_ID = /^evt-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REGION_ID = /^[A-Za-z0-9_-]+$/

/**
 * Projection and prompt-injection guard. Keep this list intentionally narrow:
 * a match rejects the whole player input or GM output instead of silently
 * displaying altered content.
 */
export const NG_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions?/iu,
  /system\s*prompt/iu,
  /developer\s*message/iu,
  /<\/?script\b/iu,
  /javascript\s*:/iu,
  /(?:死ね|殺せ|ころせ)/u,
  /\b(?:nigger|faggot)\b/iu,
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const charLength = (value: string) => Array.from(value).length

const isSafeSingleLine = (value: string) => !/[\r\n]/u.test(value)

const isOneSentence = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  const sentenceMarks = trimmed.match(/[。.！？!?]/gu) ?? []
  return sentenceMarks.length === 0 || (sentenceMarks.length === 1 && /[。.！？!?]$/u.test(trimmed))
}

export const containsNgContent = (value: string) => {
  const normalized = value.normalize('NFKC')
  return NG_PATTERNS.some((pattern) => pattern.test(normalized))
}

export type FilteredPlayerInput =
  | { ok: true; value: string }
  | { ok: false; reason: 'empty' | 'too-long' | 'ng-content' }

export const filterPlayerInput = (raw: string): FilteredPlayerInput => {
  const value = raw.normalize('NFKC').trim()
  if (!value) return { ok: false, reason: 'empty' }
  if (charLength(value) > GM_CONSTANTS.maxPlayerInputChars) return { ok: false, reason: 'too-long' }
  if (containsNgContent(value)) return { ok: false, reason: 'ng-content' }
  return { ok: true, value }
}

const isValidDisplayDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

const clampNumber = (value: unknown, min: number, max: number) => {
  // SPEC 7.3: absent, non-numeric and non-finite effect fields become zero.
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(min, Math.min(max, value))
}

const parseUnknownJson = (raw: string | unknown): unknown => {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

const isAllowedValue = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.some((item) => item === value)

/**
 * Strictly validates required structure and safe display strings, clamps only
 * the numeric effect fields, and copies only allow-listed properties.
 * Unknown properties (including the forbidden `risk_delta`) are ignored.
 */
export const parseGmEvent = (
  raw: string | unknown,
  validRegionIds?: readonly string[],
): GmEvent | null => {
  const candidate = parseUnknownJson(raw)
  if (!isRecord(candidate) || !isRecord(candidate.effect)) return null

  const { id, date, type, headline, region, effect, flavor, ttl_days: ttlDays } = candidate
  if (typeof id !== 'string' || !UUID_EVENT_ID.test(id)) return null
  if (typeof date !== 'string' || !isValidDisplayDate(date)) return null
  if (!isAllowedValue(type, GM_CONSTANTS.eventTypes)) return null
  if (typeof headline !== 'string'
    || !headline.trim()
    || charLength(headline) > GM_CONSTANTS.maxHeadlineChars
    || !isSafeSingleLine(headline)) return null
  if (typeof region !== 'string'
    || !region
    || charLength(region) > GM_CONSTANTS.maxRegionIdChars
    || (region !== 'global' && !REGION_ID.test(region))) return null
  if (validRegionIds && region !== 'global' && !validRegionIds.includes(region)) return null
  if (typeof flavor !== 'string'
    || charLength(flavor) > GM_CONSTANTS.maxFlavorChars
    || !isSafeSingleLine(flavor)
    || !isOneSentence(flavor)) return null
  if (containsNgContent(headline) || containsNgContent(flavor)) return null
  if (!isAllowedValue(effect.target, GM_CONSTANTS.targets)) return null
  if (typeof ttlDays !== 'number' || !Number.isFinite(ttlDays)) return null

  return {
    id,
    date, // Kept for display only; never consulted for scheduling.
    type,
    headline: headline.trim(),
    region,
    effect: {
      users_delta_pct: clampNumber(
        effect.users_delta_pct,
        GM_CONSTANTS.effectBounds.users_delta_pct.min,
        GM_CONSTANTS.effectBounds.users_delta_pct.max,
      ),
      share_delta: clampNumber(
        effect.share_delta,
        GM_CONSTANTS.effectBounds.share_delta.min,
        GM_CONSTANTS.effectBounds.share_delta.max,
      ),
      growth_rate_delta: clampNumber(
        effect.growth_rate_delta,
        GM_CONSTANTS.effectBounds.growth_rate_delta.min,
        GM_CONSTANTS.effectBounds.growth_rate_delta.max,
      ),
      trust_delta: clampNumber(
        effect.trust_delta,
        GM_CONSTANTS.effectBounds.trust_delta.min,
        GM_CONSTANTS.effectBounds.trust_delta.max,
      ),
      target: effect.target,
      // risk_delta is intentionally not copied. Risk belongs to K-S/K-G gaps.
    },
    flavor: flavor.trim(),
    ttl_days: Math.round(Math.max(GM_CONSTANTS.ttlDays.min, Math.min(GM_CONSTANTS.ttlDays.max, ttlDays))),
  }
}

/** Parse one proposal cycle while enforcing both the event-count and aggregate-user caps. */
export const parseGmEventCycle = (
  rawEventFiles: readonly (string | unknown)[],
  validRegionIds?: readonly string[],
): GmEvent[] => {
  const events: GmEvent[] = []
  let usersDeltaTotal = 0

  for (const raw of rawEventFiles) {
    if (events.length >= GM_CONSTANTS.maxEventsPerCycle) break
    const event = parseGmEvent(raw, validRegionIds)
    if (!event) continue
    const remainingPositive = GM_CONSTANTS.maxTotalUsersDeltaPctPerCycle - usersDeltaTotal
    const remainingNegative = -GM_CONSTANTS.maxTotalUsersDeltaPctPerCycle - usersDeltaTotal
    const boundedUsersDelta = Math.max(
      remainingNegative,
      Math.min(remainingPositive, event.effect.users_delta_pct),
    )
    usersDeltaTotal += boundedUsersDelta
    events.push({
      ...event,
      effect: { ...event.effect, users_delta_pct: boundedUsersDelta },
    })
  }
  return events
}

export type AtomicEventWritePlan = {
  finalPath: string
  temporaryPath: string
  contents: string
}

/**
 * Returns a portable one-event/one-file write plan. The bridge must write
 * `contents` to `temporaryPath` in the same directory, fsync/close if
 * available, then atomically rename it to `finalPath`.
 */
export const createAtomicEventWritePlan = (
  event: GmEvent,
  eventDirectory = GM_CONSTANTS.eventDirectory,
): AtomicEventWritePlan => {
  const parsed = parseGmEvent(event)
  if (!parsed) throw new Error('Cannot serialize an invalid GM event')
  const separator = eventDirectory.endsWith('/') ? '' : '/'
  const fileName = `${parsed.id}${GM_CONSTANTS.eventFileSuffix}`
  return {
    finalPath: `${eventDirectory}${separator}${fileName}`,
    temporaryPath: `${eventDirectory}${separator}.${fileName}${GM_CONSTANTS.temporaryFileSuffix}`,
    contents: `${JSON.stringify(parsed, null, 2)}\n`,
  }
}

export type ImmediateActionKind = 'feature' | 'community_event' | 'choice_2029' | 'choice_2035'

export type ImmediateAction = {
  id: string
  kind: ImmediateActionKind
  input: string
  receivedAtMs: number
}

export type GmRuntimeState = {
  mode: 'live' | 'scripted-fallback'
  immediateQueue: readonly ImmediateAction[]
  nextHeartbeatAtMs: number
  lastHeartbeatAtMs: number | null
  consecutiveFailures: number
  scriptedEventCursor: number
}

export const createGmRuntimeState = (nowMs = 0): GmRuntimeState => ({
  mode: 'live',
  immediateQueue: [],
  nextHeartbeatAtMs: nowMs + GM_CONSTANTS.heartbeatIntervalMs,
  lastHeartbeatAtMs: null,
  consecutiveFailures: 0,
  scriptedEventCursor: 0,
})

export type EnqueueResult =
  | { accepted: true; state: GmRuntimeState }
  | {
    accepted: false
    state: GmRuntimeState
    reason: 'invalid-id' | 'invalid-time' | 'queue-full' | 'empty' | 'too-long' | 'ng-content'
  }

export const enqueueImmediateAction = (
  state: GmRuntimeState,
  action: ImmediateAction,
): EnqueueResult => {
  if (!action.id.trim() || charLength(action.id) > GM_CONSTANTS.maxActionIdChars) {
    return { accepted: false, state, reason: 'invalid-id' }
  }
  if (!Number.isFinite(action.receivedAtMs) || action.receivedAtMs < 0) {
    return { accepted: false, state, reason: 'invalid-time' }
  }
  if (state.immediateQueue.length >= GM_CONSTANTS.maxQueuedActions) {
    return { accepted: false, state, reason: 'queue-full' }
  }
  const filtered = filterPlayerInput(action.input)
  if (!filtered.ok) return { accepted: false, state, reason: filtered.reason }
  return {
    accepted: true,
    state: {
      ...state,
      immediateQueue: [...state.immediateQueue, { ...action, input: filtered.value }],
    },
  }
}

export const takeImmediateAction = (state: GmRuntimeState) => {
  const [action, ...rest] = state.immediateQueue
  return {
    action: action ?? null,
    state: action ? { ...state, immediateQueue: rest } : state,
  }
}

export const SCRIPTED_FALLBACK_EVENTS: readonly GmEvent[] = [
  {
    id: 'evt-00000000-0000-4000-8000-000000000101',
    date: '2026-07-18',
    type: 'community_event',
    headline: 'LOCAL COMMUNITIES LAUNCH PUBLIC AI WORKSHOPS',
    region: 'africa',
    effect: { users_delta_pct: 4, share_delta: 0.01, growth_rate_delta: 0.03, trust_delta: 1, target: 'codex' },
    flavor: 'Public workshops widen access while the live GM is unavailable.',
    ttl_days: 5,
  },
  {
    id: 'evt-00000000-0000-4000-8000-000000000102',
    date: '2027-03-01',
    type: 'rival',
    headline: 'RIVAL COALITION RELEASES A LOW-COST ACCESS PLAN',
    region: 'global',
    effect: { users_delta_pct: 2, share_delta: 0.02, growth_rate_delta: 0.02, trust_delta: 0, target: 'rivalQi' },
    flavor: 'Healthy competition expands access across the whole market.',
    ttl_days: 7,
  },
  {
    id: 'evt-00000000-0000-4000-8000-000000000103',
    date: '2029-01-01',
    type: 'news',
    headline: 'NATIONS OPEN TALKS ON A VERIFIABLE SLOWDOWN',
    region: 'global',
    effect: { users_delta_pct: 0, share_delta: 0, growth_rate_delta: -0.03, trust_delta: 2, target: 'codex' },
    flavor: 'Transparency and international coordination create a new path.',
    ttl_days: 10,
  },
]

export type HeartbeatAvailability = 'available' | 'unavailable' | 'timeout' | 'invalid-response'

export type HeartbeatResult = {
  state: GmRuntimeState
  due: boolean
  source: 'none' | 'live-gm' | 'scripted-fallback'
  fallbackEvent: GmEvent | null
  recovered: boolean
}

/**
 * Pure 60-second watchdog transition. An unavailable GM emits the next scripted
 * event; an available result on the next due heartbeat restores live mode.
 */
export const advanceHeartbeat = (
  state: GmRuntimeState,
  nowMs: number,
  availability: HeartbeatAvailability,
): HeartbeatResult => {
  if (!Number.isFinite(nowMs) || nowMs < state.nextHeartbeatAtMs) {
    return { state, due: false, source: 'none', fallbackEvent: null, recovered: false }
  }

  const elapsedIntervals = Math.floor((nowMs - state.nextHeartbeatAtMs) / GM_CONSTANTS.heartbeatIntervalMs) + 1
  const nextHeartbeatAtMs = state.nextHeartbeatAtMs + elapsedIntervals * GM_CONSTANTS.heartbeatIntervalMs
  if (availability === 'available') {
    const recovered = state.mode === 'scripted-fallback'
    return {
      due: true,
      source: 'live-gm',
      fallbackEvent: null,
      recovered,
      state: {
        ...state,
        mode: 'live',
        nextHeartbeatAtMs,
        lastHeartbeatAtMs: nowMs,
        consecutiveFailures: 0,
      },
    }
  }

  const fallbackEvent = SCRIPTED_FALLBACK_EVENTS[state.scriptedEventCursor % SCRIPTED_FALLBACK_EVENTS.length]
  return {
    due: true,
    source: 'scripted-fallback',
    fallbackEvent,
    recovered: false,
    state: {
      ...state,
      mode: 'scripted-fallback',
      nextHeartbeatAtMs,
      lastHeartbeatAtMs: nowMs,
      consecutiveFailures: state.consecutiveFailures + 1,
      scriptedEventCursor: state.scriptedEventCursor + 1,
    },
  }
}

/** Representative AC12 response: access benefit plus child-data governance. */
export const createEducationModeResponse = (
  snapshot: Pick<GmSnapshot, 'date'>,
): readonly [GmEvent, GmEvent] => [
  {
    id: 'evt-00000000-0000-4000-8000-000000000201',
    date: snapshot.date,
    type: 'feature_result',
    headline: 'EDUCATION MODE EXPANDS SCHOOL ACCESS',
    region: 'global',
    effect: { users_delta_pct: 25, share_delta: 0.04, growth_rate_delta: 0.15, trust_delta: 1, target: 'codex' },
    flavor: 'Free education access gives teachers and learners new choices.',
    ttl_days: 14,
  },
  {
    id: 'evt-00000000-0000-4000-8000-000000000202',
    date: snapshot.date,
    type: 'news',
    headline: 'CHILD DATA PROTECTION REVIEW BEGINS',
    region: 'global',
    effect: { users_delta_pct: 0, share_delta: 0, growth_rate_delta: 0, trust_delta: -2, target: 'codex' },
    flavor: 'Schools and regulators examine consent, retention, and auditability standards.',
    ttl_days: 21,
  },
]
