import {
  RunApiOutbox,
  MAX_REPORTED_ACTIVE_PLAY_SECONDS,
  RULESET_VERSION,
  type RunCompleteRequest,
  type RunLanguage,
  type RunOutboxStorage,
} from './runApi'

export const RUN_TELEMETRY_STORAGE_KEY = 'codex-2040:run-telemetry:v2'

type PersistedRun = {
  version: 2
  rulesetVersion: typeof RULESET_VERSION
  playId: string
  createdAt: string
  startedAt: string | null
  activeMs: number
  startEnqueued: boolean
  completionEnqueued: boolean
}

export type RunCompletion = Pick<RunCompleteRequest,
  'final_score' | 'rank' | 'ending' | 'choice_2029' | 'choice_2035'>

type RunTelemetryOptions = {
  storage: RunOutboxStorage
  outbox: RunApiOutbox
  language: RunLanguage
  now?: () => number
  createPlayId?: () => string
}

const createUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'

const decodeRun = (raw: string | null): PersistedRun | null => {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed)
      || parsed.version !== 2
      || parsed.rulesetVersion !== RULESET_VERSION
      || typeof parsed.playId !== 'string'
      || typeof parsed.createdAt !== 'string'
      || !(typeof parsed.startedAt === 'string' || parsed.startedAt === null)
      || typeof parsed.activeMs !== 'number'
      || !Number.isFinite(parsed.activeMs)
      || parsed.activeMs < 0
      || typeof parsed.startEnqueued !== 'boolean'
      || typeof parsed.completionEnqueued !== 'boolean') return null
    return parsed as PersistedRun
  } catch {
    return null
  }
}

/** Counts visible wall-clock time after start, independently of simulation pause. */
export class RunTelemetry {
  private readonly storage: RunOutboxStorage
  private readonly outbox: RunApiOutbox
  private readonly language: RunLanguage
  private readonly now: () => number
  private readonly createPlayId: () => string
  private run: PersistedRun
  private activeSince: number | null = null

  constructor({ storage, outbox, language, now = Date.now, createPlayId = createUuid }: RunTelemetryOptions) {
    this.storage = storage
    this.outbox = outbox
    this.language = language
    this.now = now
    this.createPlayId = createPlayId
    let raw: string | null = null
    try { raw = storage.getItem(RUN_TELEMETRY_STORAGE_KEY) } catch { /* Start a fresh anonymous run. */ }
    this.run = decodeRun(raw) ?? this.newRun()
    this.persist()
  }

  start() {
    this.outbox.start()
  }

  stop() {
    this.suspend()
    this.outbox.stop()
  }

  updateActivity(hasStarted: boolean, terminal: boolean, visible: boolean) {
    this.checkpoint()
    if (hasStarted && !this.run.startEnqueued) this.enqueueStart()
    const shouldBeActive = hasStarted && !terminal && visible
    if (!shouldBeActive) this.activeSince = null
    else if (this.activeSince === null) this.activeSince = this.now()
    this.persist()
  }

  checkpoint() {
    if (this.activeSince === null) return
    const now = this.now()
    this.run.activeMs += Math.max(0, now - this.activeSince)
    this.activeSince = now
    this.persist()
  }

  suspend() {
    this.checkpoint()
    this.activeSince = null
    this.persist()
  }

  complete(result: RunCompletion) {
    this.suspend()
    if (this.run.completionEnqueued) return
    if (!this.run.startEnqueued) this.enqueueStart()
    this.outbox.enqueue('complete', {
      play_id: this.run.playId,
      active_play_seconds: Math.min(
        MAX_REPORTED_ACTIVE_PLAY_SECONDS,
        Math.max(0, Math.round(this.run.activeMs / 1_000)),
      ),
      ...result,
      completed_at: new Date(this.now()).toISOString(),
    })
    this.run.completionEnqueued = true
    this.persist()
  }

  reset() {
    this.suspend()
    this.run = this.newRun()
    this.persist()
  }

  retry() {
    this.outbox.kick()
  }

  flush() {
    return this.outbox.flush()
  }

  snapshot() {
    this.checkpoint()
    return { playId: this.run.playId, activePlaySeconds: this.run.activeMs / 1_000 }
  }

  private enqueueStart() {
    const startedAt = this.run.startedAt ?? new Date(this.now()).toISOString()
    this.outbox.enqueue('start', {
      play_id: this.run.playId,
      ruleset_version: RULESET_VERSION,
      language: this.language,
      started_at: startedAt,
    })
    this.run.startedAt = startedAt
    this.run.startEnqueued = true
    this.persist()
  }

  private newRun(): PersistedRun {
    return {
      version: 2,
      rulesetVersion: RULESET_VERSION,
      playId: this.createPlayId(),
      createdAt: new Date(this.now()).toISOString(),
      startedAt: null,
      activeMs: 0,
      startEnqueued: false,
      completionEnqueued: false,
    }
  }

  private persist() {
    try {
      this.storage.setItem(RUN_TELEMETRY_STORAGE_KEY, JSON.stringify(this.run))
    } catch {
      // Anonymous run reporting must never affect gameplay.
    }
  }
}

export const createBrowserRunTelemetry = (language: RunLanguage) => {
  const memory = new Map<string, string>()
  const fallbackStorage: RunOutboxStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value) },
  }
  let storage: RunOutboxStorage = fallbackStorage
  try { storage = window.localStorage } catch { /* Privacy settings can deny storage access. */ }
  const outbox = new RunApiOutbox({ storage })
  return new RunTelemetry({ storage, outbox, language })
}
