import {
  GM_CONSTANTS,
  containsNgContent,
  filterPlayerInput,
  isGmRunId,
  parseGmEventCycle,
  type GmEvent,
  type GmRunId,
  type GmSnapshot,
  type ImmediateAction,
  type ImmediateActionKind,
} from './gm'

export const GM_BRIDGE_ENDPOINTS = {
  turns: '/__codex2040/gm/turns',
  events: '/__codex2040/gm/events',
} as const

export const GM_BRIDGE_PROTOCOL_VERSION = 2 as const
export const GM_BRIDGE_REQUEST_HEADER = 'x-codex2040-gm-bridge' as const
export const GM_BRIDGE_REQUEST_HEADER_VALUE = '2' as const
export const GM_BRIDGE_TIMESTAMP_BOUNDS = {
  min: Date.UTC(2020, 0, 1),
  max: Date.UTC(2100, 0, 1) - 1,
} as const

const ACTION_KINDS: readonly ImmediateActionKind[] = [
  'feature',
  'community_event',
  'choice_2029',
  'choice_2035',
]
const REGION_ID = /^[A-Za-z0-9_-]{1,32}$/u
const ACTION_ID = /^[A-Za-z0-9_-]{1,80}$/u
const SNAPSHOT_LIST_LIMIT = 32
const SNAPSHOT_TEXT_LIMIT = 120
const DEFAULT_TIMEOUT_MS = 2_000

/** One UUID per mounted browser runtime. It is never derived from an event ID. */
export const createGmRunId = (
  randomUuid: () => string = () => globalThis.crypto.randomUUID(),
): GmRunId => {
  const runId = `run-${randomUuid()}`
  if (!isGmRunId(runId)) throw new Error('Unable to create a valid GM run ID')
  return runId
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const clampFinite = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(min, Math.min(max, value))
}

const safeDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

const sanitizeDisplayList = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > SNAPSHOT_LIST_LIMIT) return null
  const sanitized: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const text = item.normalize('NFKC').trim()
    if (!text
      || Array.from(text).length > SNAPSHOT_TEXT_LIMIT
      || /[\r\n]/u.test(text)
      || containsNgContent(text)) return null
    sanitized.push(text)
  }
  return sanitized
}

/** Allow-list and bound the read-only state projection sent to the local GM. */
export const sanitizeGmSnapshot = (raw: unknown): GmSnapshot | null => {
  if (!isRecord(raw) || !isGmRunId(raw.runId) || !safeDate(raw.date)) return null
  const AWorld = clampFinite(raw.A_world, 0, 1)
  const codexShare = clampFinite(raw.S_c, 0, 1)
  const hhi = clampFinite(raw.HHI, 0, 1)
  const trust = clampFinite(raw.T, 0, 100)
  const capability = clampFinite(raw.K, 0, 10)
  const safety = clampFinite(raw.S, 0, 10)
  const governance = clampFinite(raw.G, 0, 10)
  const recentEvents = sanitizeDisplayList(raw.recentEvents)
  if ([AWorld, codexShare, hhi, trust, capability, safety, governance].some((value) => value === null)
    || !Array.isArray(raw.topRegions)
    || raw.topRegions.length > SNAPSHOT_LIST_LIMIT
    || !recentEvents
    || !Array.isArray(raw.playerInbox)
    || raw.playerInbox.length > GM_CONSTANTS.maxQueuedActions) return null

  const topRegions: string[] = []
  for (const region of raw.topRegions) {
    if (typeof region !== 'string' || !REGION_ID.test(region)) return null
    topRegions.push(region)
  }
  const playerInbox: string[] = []
  for (const item of raw.playerInbox) {
    if (typeof item !== 'string') return null
    const filtered = filterPlayerInput(item)
    if (!filtered.ok) return null
    playerInbox.push(filtered.value)
  }

  return {
    runId: raw.runId,
    date: raw.date,
    A_world: AWorld!,
    S_c: codexShare!,
    HHI: hhi!,
    T: trust!,
    K: capability!,
    S: safety!,
    G: governance!,
    topRegions,
    recentEvents,
    playerInbox,
  }
}

export const sanitizeGmAction = (raw: unknown): ImmediateAction | null => {
  if (!isRecord(raw)
    || !isGmRunId(raw.runId)
    || typeof raw.id !== 'string'
    || !ACTION_ID.test(raw.id)
    || typeof raw.kind !== 'string'
    || !ACTION_KINDS.some((kind) => kind === raw.kind)
    || typeof raw.receivedAtMs !== 'number'
    || !Number.isFinite(raw.receivedAtMs)
    || raw.receivedAtMs < 0
    || typeof raw.input !== 'string') return null
  const filtered = filterPlayerInput(raw.input)
  if (!filtered.ok) return null
  return {
    runId: raw.runId,
    id: raw.id,
    kind: raw.kind as ImmediateActionKind,
    input: filtered.value,
    receivedAtMs: Math.round(raw.receivedAtMs),
  }
}

type GmBridgeTurnBase = {
  version: typeof GM_BRIDGE_PROTOCOL_VERSION
  runId: GmRunId
  sentAtMs: number
  snapshot: GmSnapshot
}

export type GmBridgeTurn = GmBridgeTurnBase & (
  | { kind: 'snapshot' }
  | { kind: 'heartbeat' }
  | { kind: 'action'; action: ImmediateAction }
)

export const sanitizeGmBridgeTurn = (raw: unknown): GmBridgeTurn | null => {
  if (!isRecord(raw)
    || raw.version !== GM_BRIDGE_PROTOCOL_VERSION
    || !isGmRunId(raw.runId)
    || typeof raw.sentAtMs !== 'number'
    || !Number.isSafeInteger(raw.sentAtMs)
    || raw.sentAtMs < GM_BRIDGE_TIMESTAMP_BOUNDS.min
    || raw.sentAtMs > GM_BRIDGE_TIMESTAMP_BOUNDS.max
    || typeof raw.kind !== 'string') return null
  const snapshot = sanitizeGmSnapshot(raw.snapshot)
  if (!snapshot || snapshot.runId !== raw.runId) return null
  const base = {
    version: GM_BRIDGE_PROTOCOL_VERSION,
    runId: raw.runId,
    sentAtMs: raw.sentAtMs,
    snapshot,
  }
  if (raw.kind === 'snapshot' || raw.kind === 'heartbeat') return { ...base, kind: raw.kind }
  if (raw.kind !== 'action') return null
  const action = sanitizeGmAction(raw.action)
  return action && action.runId === raw.runId ? { ...base, kind: 'action', action } : null
}

export type GmBridgeUnavailableReason = 'network' | 'timeout' | 'http-error' | 'invalid-response'

export type GmBridgeSubmitResult =
  | { status: 'accepted'; runId: GmRunId; turnId: string; fileName: string }
  | { status: 'rejected'; reason: 'invalid-turn' }
  | { status: 'unavailable'; reason: GmBridgeUnavailableReason; httpStatus?: number }

export type GmBridgePollResult =
  | { status: 'available'; events: readonly GmEvent[] }
  | { status: 'unavailable'; reason: GmBridgeUnavailableReason; httpStatus?: number }

export type GmBridgeClientOptions = {
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

const fetchJson = async (
  url: string,
  init: RequestInit,
  options: GmBridgeClientOptions,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: GmBridgeUnavailableReason; httpStatus?: number }> => {
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return { ok: false, reason: 'network' }
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeout = globalThis.setTimeout(() => controller.abort(), Math.max(1, timeoutMs))
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal })
    if (!response.ok) return { ok: false, reason: 'http-error', httpStatus: response.status }
    try {
      return { ok: true, value: await response.json() as unknown }
    } catch {
      return { ok: false, reason: 'invalid-response' }
    }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network',
    }
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export const submitGmBridgeTurn = async (
  rawTurn: unknown,
  options: GmBridgeClientOptions = {},
): Promise<GmBridgeSubmitResult> => {
  const turn = sanitizeGmBridgeTurn(rawTurn)
  if (!turn) return { status: 'rejected', reason: 'invalid-turn' }
  const response = await fetchJson(GM_BRIDGE_ENDPOINTS.turns, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [GM_BRIDGE_REQUEST_HEADER]: GM_BRIDGE_REQUEST_HEADER_VALUE,
    },
    credentials: 'same-origin',
    body: JSON.stringify(turn),
  }, options)
  if ('reason' in response) {
    return { status: 'unavailable', reason: response.reason, httpStatus: response.httpStatus }
  }
  if (!isRecord(response.value)
    || response.value.ok !== true
    || response.value.runId !== turn.runId
    || typeof response.value.turnId !== 'string'
    || typeof response.value.fileName !== 'string') {
    return { status: 'unavailable', reason: 'invalid-response' }
  }
  return { status: 'accepted', runId: turn.runId, turnId: response.value.turnId, fileName: response.value.fileName }
}

const createTurn = (
  kind: 'snapshot' | 'heartbeat',
  snapshot: GmSnapshot,
  sentAtMs = Date.now(),
): GmBridgeTurn => ({
  version: GM_BRIDGE_PROTOCOL_VERSION,
  runId: snapshot.runId,
  kind,
  sentAtMs,
  snapshot,
})

export const postGmSnapshot = (
  snapshot: GmSnapshot,
  options?: GmBridgeClientOptions,
  sentAtMs = Date.now(),
) => submitGmBridgeTurn(createTurn('snapshot', snapshot, sentAtMs), options)

export const postGmHeartbeat = (
  snapshot: GmSnapshot,
  options?: GmBridgeClientOptions,
  sentAtMs = Date.now(),
) => submitGmBridgeTurn(createTurn('heartbeat', snapshot, sentAtMs), options)

export const postGmAction = (
  snapshot: GmSnapshot,
  action: ImmediateAction,
  options?: GmBridgeClientOptions,
  sentAtMs = Date.now(),
) => submitGmBridgeTurn({
  version: GM_BRIDGE_PROTOCOL_VERSION,
  runId: snapshot.runId,
  kind: 'action',
  sentAtMs,
  snapshot,
  action,
}, options)

export const pollGmEvents = async (
  runId: GmRunId,
  options: GmBridgeClientOptions = {},
): Promise<GmBridgePollResult> => {
  if (!isGmRunId(runId)) return { status: 'unavailable', reason: 'invalid-response' }
  const response = await fetchJson(`${GM_BRIDGE_ENDPOINTS.events}?runId=${encodeURIComponent(runId)}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      [GM_BRIDGE_REQUEST_HEADER]: GM_BRIDGE_REQUEST_HEADER_VALUE,
    },
    credentials: 'same-origin',
  }, options)
  if ('reason' in response) {
    return { status: 'unavailable', reason: response.reason, httpStatus: response.httpStatus }
  }
  if (!isRecord(response.value)
    || response.value.ok !== true
    || response.value.runId !== runId
    || !Array.isArray(response.value.events)) {
    return { status: 'unavailable', reason: 'invalid-response' }
  }
  const events = parseGmEventCycle(response.value.events, undefined, runId)
  if (events.length !== response.value.events.length) {
    return { status: 'unavailable', reason: 'invalid-response' }
  }
  return { status: 'available', events }
}

export const isGmBridgeHeartbeatDue = (lastHeartbeatAtMs: number | null, nowMs = Date.now()) =>
  lastHeartbeatAtMs === null || nowMs - lastHeartbeatAtMs >= GM_CONSTANTS.heartbeatIntervalMs
