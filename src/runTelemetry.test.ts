import { describe, expect, it, vi } from 'vitest'
import { RUN_OUTBOX_STORAGE_KEY, RunApiOutbox, type RunOutboxStorage } from './runApi'
import { RUN_TELEMETRY_STORAGE_KEY, RunTelemetry } from './runTelemetry'

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
})
