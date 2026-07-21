import { describe, expect, it, vi } from 'vitest'
import { RULESET_VERSION, RUN_OUTBOX_STORAGE_KEY, RunApiOutbox, type RunOutboxStorage } from './runApi'
import { RUN_TELEMETRY_STORAGE_KEY, RunTelemetry } from './runTelemetry'
import { createInitialState } from './engine'
import { decodeSession, encodeSession } from './session'

const memoryStorage = (): RunOutboxStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

const queued = (storage: ReturnType<typeof memoryStorage>) => JSON.parse(storage.values.get(RUN_OUTBOX_STORAGE_KEY) ?? '[]')

describe('anonymous run telemetry', () => {
  it('counts only visible started non-terminal time and survives reload', () => {
    let now = Date.parse('2026-07-21T00:00:00.000Z')
    const storage = memoryStorage()
    const outbox = new RunApiOutbox({ storage, fetch: vi.fn() })
    const first = new RunTelemetry({
      storage,
      outbox,
      language: 'ja',
      now: () => now,
      createPlayId: () => 'stable-play-id',
    })

    first.updateActivity(false, false, true)
    now += 5_000
    first.updateActivity(true, false, true)
    now += 4_000
    // Paused overlays are intentionally not an input: visible wall time counts.
    first.checkpoint()
    now += 3_000
    first.updateActivity(true, false, false)
    now += 20_000

    const restored = new RunTelemetry({ storage, outbox, language: 'ja', now: () => now })
    expect(restored.snapshot()).toEqual({ playId: 'stable-play-id', activePlaySeconds: 7 })
    restored.updateActivity(true, false, true)
    now += 2_400
    restored.complete({
      final_score: 93,
      rank: 'S',
      ending: 'beneficial-abundance',
      choice_2029: 'verified-slowdown',
      choice_2035: 'hold-the-line',
    })

    expect(queued(storage)).toHaveLength(2)
    expect(queued(storage)[0].kind).toBe('start')
    expect(queued(storage)[1].payload).toMatchObject({
      play_id: 'stable-play-id',
      active_play_seconds: 9,
      final_score: 93,
      rank: 'S',
      ending: 'beneficial-abundance',
      choice_2029: 'verified-slowdown',
      choice_2035: 'hold-the-line',
    })
  })

  it('queues completion once and New Game creates a fresh play id', () => {
    let id = 0
    const storage = memoryStorage()
    const outbox = new RunApiOutbox({ storage, fetch: vi.fn() })
    const telemetry = new RunTelemetry({
      storage,
      outbox,
      language: 'en',
      createPlayId: () => `play-${++id}`,
    })
    const result = {
      final_score: 40,
      rank: 'C' as const,
      ending: 'misalignment' as const,
      choice_2029: null,
      choice_2035: null,
    }

    telemetry.complete(result)
    telemetry.complete(result)
    expect(queued(storage).filter((item: { kind: string }) => item.kind === 'complete')).toHaveLength(1)

    telemetry.reset()
    expect(telemetry.snapshot().playId).toBe('play-2')
    expect(JSON.parse(storage.values.get(RUN_TELEMETRY_STORAGE_KEY)!).completionEnqueued).toBe(false)
  })

  it('starts a fresh v2 run instead of completing a persisted run from old rules', () => {
    const storage = memoryStorage()
    storage.setItem('codex-2040:run-telemetry:v1', JSON.stringify({
      version: 1,
      playId: 'legacy-play',
      createdAt: '2026-07-20T00:00:00.000Z',
      startedAt: '2026-07-20T00:00:01.000Z',
      activeMs: 60_000,
      startEnqueued: true,
      completionEnqueued: false,
    }))
    storage.setItem(RUN_TELEMETRY_STORAGE_KEY, JSON.stringify({
      version: 2,
      rulesetVersion: 'codex-2040-rules-v1',
      playId: 'wrong-ruleset-play',
      createdAt: '2026-07-20T00:00:00.000Z',
      startedAt: '2026-07-20T00:00:01.000Z',
      activeMs: 60_000,
      startEnqueued: true,
      completionEnqueued: false,
    }))
    const outbox = new RunApiOutbox({ storage, fetch: vi.fn() })
    const telemetry = new RunTelemetry({
      storage,
      outbox,
      language: 'ja',
      createPlayId: () => 'fresh-v2-play',
    })

    expect(telemetry.snapshot()).toEqual({ playId: 'fresh-v2-play', activePlaySeconds: 0 })
    expect(JSON.parse(storage.values.get(RUN_TELEMETRY_STORAGE_KEY)!)).toMatchObject({
      version: 2,
      rulesetVersion: RULESET_VERSION,
      playId: 'fresh-v2-play',
      startEnqueued: false,
    })
  })

  it('does not enqueue a zero-second v2 completion from a terminal v1 game session', () => {
    const storage = memoryStorage()
    const legacyTerminal = JSON.parse(encodeSession({
      ...createInitialState(),
      terminal: true,
      ending: 'managed-transition',
    }, true))
    legacyTerminal.version = 1
    delete legacyTerminal.rulesetVersion

    const restored = decodeSession(JSON.stringify(legacyTerminal))
    const outbox = new RunApiOutbox({ storage, fetch: vi.fn() })
    const telemetry = new RunTelemetry({
      storage,
      outbox,
      language: 'ja',
      createPlayId: () => 'fresh-rules-v2-play',
    })
    if (restored) {
      telemetry.updateActivity(restored.hasStarted, restored.state.terminal, true)
      telemetry.complete({
        final_score: 70,
        rank: 'B',
        ending: 'managed-transition',
        choice_2029: null,
        choice_2035: null,
      })
    }

    expect(restored).toBeNull()
    expect(queued(storage)).toHaveLength(0)
  })
})
