export { RULESET_VERSION } from '../shared/ruleset'
import { RULESET_VERSION } from '../shared/ruleset'

export const RUN_OUTBOX_STORAGE_KEY = 'codex-2040:run-outbox:v2'
export const RUN_TOKEN_STORAGE_KEY = 'codex-2040:run-tokens:v2'
export const MAX_REPORTED_ACTIVE_PLAY_SECONDS = 21_600

export type RunLanguage = 'ja' | 'en'
export type RunEnding =
  | 'beneficial-abundance'
  | 'managed-transition'
  | 'fragile-abundance'
  | 'race-future'
  | 'regulatory-freeze'
  | 'safety-incident'
  | 'misalignment'
  | 'pyrrhic-monopoly'
export type RunChoice2029 = 'race' | 'slowdown' | 'verified-slowdown'
export type RunChoice2035 = 'hold-the-line' | 'accelerate'

const RUN_ENDINGS: readonly RunEnding[] = [
  'beneficial-abundance', 'managed-transition', 'fragile-abundance', 'race-future',
  'regulatory-freeze', 'safety-incident', 'misalignment', 'pyrrhic-monopoly',
]
const RUN_CHOICES_2029: readonly RunChoice2029[] = ['race', 'slowdown', 'verified-slowdown']
const RUN_CHOICES_2035: readonly RunChoice2035[] = ['hold-the-line', 'accelerate']

export type RunStartRequest = {
  play_id: string
  ruleset_version: typeof RULESET_VERSION
  language: RunLanguage
  started_at: string
}

export type RunCompleteRequest = {
  play_id: string
  active_play_seconds: number
  final_score: number
  rank: 'S' | 'A' | 'B' | 'C'
  ending: RunEnding
  choice_2029: RunChoice2029 | null
  choice_2035: RunChoice2035 | null
  completed_at: string
}

export type RunReceiptResponse = {
  ok: true
  run: {
    final_score: number
    rank: RunCompleteRequest['rank']
    ending: RunEnding
    choice_2029: RunChoice2029 | null
    choice_2035: RunChoice2035 | null
    active_play_seconds: number
  }
  aggregate: {
    total_completed: number | null
    percentile: number | null
    ending_distribution: Partial<Record<RunEnding, number>> | null
    choice_2029_distribution: Partial<Record<RunChoice2029, number>> | null
    choice_2035_distribution: Partial<Record<RunChoice2035, number>> | null
  } | null
}

type RunRequestByKind = {
  start: RunStartRequest
  complete: RunCompleteRequest
}

type RunRequestKind = keyof RunRequestByKind

type OutboxItem = {
  id: string
  kind: RunRequestKind
  payload: RunRequestByKind[RunRequestKind]
  attempts: number
  nextAttemptAt: number
  createdAt: number
}

export type RunOutboxStorage = Pick<Storage, 'getItem' | 'setItem'>

type RunApiOutboxOptions = {
  storage: RunOutboxStorage
  fetch?: typeof fetch
  now?: () => number
  requestTimeoutMs?: number
}

const endpointFor = (item: OutboxItem) => item.kind === 'start'
  ? '/api/runs/start'
  : `/api/runs/${encodeURIComponent(item.payload.play_id)}/complete`

const bodyFor = (item: OutboxItem) => {
  if (item.kind === 'start') return item.payload
  const { play_id: _, ...body } = item.payload
  return body
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'

const isUuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const isStartPayload = (value: unknown): value is RunStartRequest => isObject(value)
  && isUuid(value.play_id)
  && value.ruleset_version === RULESET_VERSION
  && (value.language === 'ja' || value.language === 'en')
  && typeof value.started_at === 'string'

const isCompletePayload = (value: unknown): value is RunCompleteRequest => isObject(value)
  && isUuid(value.play_id)
  && typeof value.active_play_seconds === 'number'
  && Number.isFinite(value.active_play_seconds)
  && typeof value.final_score === 'number'
  && Number.isFinite(value.final_score)
  && ['S', 'A', 'B', 'C'].includes(String(value.rank))
  && typeof value.ending === 'string'
  && typeof value.completed_at === 'string'

const isNullableNumber = (value: unknown): value is number | null => value === null
  || (typeof value === 'number' && Number.isFinite(value))

const isNullableRecordOfNumbers = (value: unknown) => value === null
  || (isObject(value) && Object.values(value).every((count) => typeof count === 'number' && Number.isFinite(count) && count >= 0))

/** Best-effort receipt lookup. Malformed or unavailable responses stay invisible to gameplay. */
export async function fetchRunReceipt(
  playId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RunReceiptResponse | null> {
  try {
    const response = await fetchImpl(`/api/runs/${encodeURIComponent(playId)}/receipt`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const value: unknown = await response.json()
    if (!isObject(value) || value.ok !== true || !isObject(value.run)) return null
    const run = value.run
    if (typeof run.final_score !== 'number' || !Number.isFinite(run.final_score)
      || !['S', 'A', 'B', 'C'].includes(String(run.rank))
      || !RUN_ENDINGS.includes(run.ending as RunEnding)
      || !(run.choice_2029 === null || RUN_CHOICES_2029.includes(run.choice_2029 as RunChoice2029))
      || !(run.choice_2035 === null || RUN_CHOICES_2035.includes(run.choice_2035 as RunChoice2035))
      || typeof run.active_play_seconds !== 'number' || !Number.isFinite(run.active_play_seconds)) return null
    if (value.aggregate !== null && value.aggregate !== undefined) {
      if (!isObject(value.aggregate)
        || !isNullableNumber(value.aggregate.total_completed)
        || !isNullableNumber(value.aggregate.percentile)
        || !isNullableRecordOfNumbers(value.aggregate.ending_distribution)
        || !isNullableRecordOfNumbers(value.aggregate.choice_2029_distribution)
        || !isNullableRecordOfNumbers(value.aggregate.choice_2035_distribution)) return null
    }
    return value as RunReceiptResponse
  } catch {
    return null
  }
}

const decodeOutbox = (raw: string | null): OutboxItem[] => {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is OutboxItem => isObject(item)
      && typeof item.id === 'string'
      && (item.kind === 'start' || item.kind === 'complete')
      && (item.kind === 'start' ? isStartPayload(item.payload) : isCompletePayload(item.payload))
      && typeof item.attempts === 'number'
      && typeof item.nextAttemptAt === 'number'
      && typeof item.createdAt === 'number')
  } catch {
    return []
  }
}

const retryDelay = (attempts: number) => Math.min(60_000, 1_000 * 2 ** Math.min(6, Math.max(0, attempts - 1)))

/**
 * A best-effort, persistent API client. Calls never escape as rejections to the
 * game; failed requests remain in localStorage and are retried in order.
 */
export class RunApiOutbox {
  private readonly storage: RunOutboxStorage
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly requestTimeoutMs: number
  private items: OutboxItem[]
  private tokens: Record<string, string>
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private flushing: Promise<void> | null = null
  private running = false

  constructor({ storage, fetch: fetchImpl = fetch, now = Date.now, requestTimeoutMs = 8_000 }: RunApiOutboxOptions) {
    this.storage = storage
    this.fetchImpl = fetchImpl
    this.now = now
    this.requestTimeoutMs = requestTimeoutMs
    let raw: string | null = null
    try { raw = storage.getItem(RUN_OUTBOX_STORAGE_KEY) } catch { /* Use an empty in-memory outbox. */ }
    this.items = decodeOutbox(raw).slice(-20)
    let rawTokens: string | null = null
    try { rawTokens = storage.getItem(RUN_TOKEN_STORAGE_KEY) } catch { /* Tokens remain in memory only. */ }
    try {
      const decoded: unknown = rawTokens ? JSON.parse(rawTokens) : {}
      this.tokens = isObject(decoded)
        ? Object.fromEntries(Object.entries(decoded).flatMap(([playId, token]) =>
          isUuid(playId) && typeof token === 'string' && token.length >= 32 ? [[playId, token] as const] : []))
        : {}
    } catch {
      this.tokens = {}
    }
  }

  start() {
    this.running = true
    this.kick()
  }

  stop() {
    this.running = false
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  enqueue<K extends RunRequestKind>(kind: K, payload: RunRequestByKind[K]) {
    const id = `${kind}:${payload.play_id}`
    const existing = this.items.find((item) => item.id === id)
    if (existing) {
      existing.payload = payload
      existing.nextAttemptAt = Math.min(existing.nextAttemptAt, this.now())
    } else {
      const now = this.now()
      if (this.items.length >= 20) this.items.shift()
      this.items.push({ id, kind, payload, attempts: 0, nextAttemptAt: now, createdAt: now })
    }
    this.persist()
    this.kick()
  }

  kick() {
    if (!this.running) return
    void this.flush()
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing
    this.flushing = this.flushItems().finally(() => { this.flushing = null })
    return this.flushing
  }

  pendingCount() {
    return this.items.length
  }

  private async flushItems() {
    if (!this.running || this.items.length === 0) return
    const item = [...this.items].sort((left, right) => left.createdAt - right.createdAt)[0]
    const waitMs = item.nextAttemptAt - this.now()
    if (waitMs > 0) {
      this.schedule(waitMs)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    try {
      const body = bodyFor(item)
      if (item.kind === 'complete') {
        const token = this.tokens[item.payload.play_id]
        if (!token) {
          this.remove(item)
          if (this.items.length > 0) await this.flushItems()
          return
        }
        Object.assign(body, { completion_token: token })
      }
      const response = await this.fetchImpl(endpointFor(item), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 408 || response.status === 429 || response.status >= 500) {
          throw new Error(`Run API returned retryable status ${response.status}`)
        }
        this.remove(item)
        if (this.items.length > 0) await this.flushItems()
        return
      }
      if (item.kind === 'start') {
        const value: unknown = await response.json()
        if (!isObject(value) || typeof value.completion_token !== 'string' || value.completion_token.length < 32) {
          throw new Error('Run API omitted the completion token')
        }
        this.tokens[item.payload.play_id] = value.completion_token
        this.persistTokens()
      } else {
        delete this.tokens[item.payload.play_id]
        this.persistTokens()
      }
      this.remove(item)
      if (this.items.length > 0) await this.flushItems()
    } catch {
      const current = this.items.find((candidate) => candidate.id === item.id)
      if (!current) return
      current.attempts += 1
      current.nextAttemptAt = this.now() + retryDelay(current.attempts)
      this.persist()
      this.schedule(retryDelay(current.attempts))
    } finally {
      clearTimeout(timeout)
    }
  }

  private persist() {
    try {
      this.storage.setItem(RUN_OUTBOX_STORAGE_KEY, JSON.stringify(this.items))
    } catch {
      // Storage can be disabled or full. Telemetry remains strictly optional.
    }
  }

  private persistTokens() {
    try {
      this.storage.setItem(RUN_TOKEN_STORAGE_KEY, JSON.stringify(this.tokens))
    } catch {
      // Token persistence is best effort and never affects gameplay.
    }
  }

  private remove(item: OutboxItem) {
    this.items = this.items.filter((candidate) => candidate.id !== item.id)
    this.persist()
  }

  private schedule(delayMs: number) {
    if (!this.running) return
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.kick()
    }, Math.max(0, delayMs))
  }
}
