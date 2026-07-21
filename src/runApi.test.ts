import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RULESET_VERSION,
  RUN_OUTBOX_STORAGE_KEY,
  RunApiOutbox,
  type RunOutboxStorage,
} from './runApi'

const memoryStorage = (): RunOutboxStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

const COMPLETION_TOKEN = 'test-completion-token-12345678901234567890'
const ok: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({ completion_token: COMPLETION_TOKEN }), {
  status: 200,
  headers: { 'content-type': 'application/json' },
}))

afterEach(() => vi.useRealTimers())

describe('run API outbox', () => {
  it('uses the fixed start and path-parameter completion contracts', async () => {
    const storage = memoryStorage()
    const fetchMock = vi.fn<typeof fetch>(ok)
    const outbox = new RunApiOutbox({ storage, fetch: fetchMock })

    outbox.enqueue('start', {
      play_id: '11111111-1111-4111-8111-111111111111',
      ruleset_version: RULESET_VERSION,
      language: 'ja',
      started_at: '2026-07-21T00:00:00.000Z',
    })
    outbox.enqueue('complete', {
      play_id: '11111111-1111-4111-8111-111111111111',
      final_score: 88,
      rank: 'S',
      ending: 'beneficial-abundance',
      choice_2029: 'verified-slowdown',
      choice_2035: 'hold-the-line',
      active_play_seconds: 42,
      completed_at: '2026-07-21T00:01:00.000Z',
    })
    outbox.start()
    await outbox.flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const startInit = fetchMock.mock.calls[0][1] as RequestInit
    const completeInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/runs/start')
    expect(JSON.parse(startInit.body as string)).toEqual({
      play_id: '11111111-1111-4111-8111-111111111111',
      ruleset_version: RULESET_VERSION,
      language: 'ja',
      started_at: '2026-07-21T00:00:00.000Z',
    })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/runs/11111111-1111-4111-8111-111111111111/complete')
    expect(JSON.parse(completeInit.body as string)).toEqual({
      final_score: 88,
      rank: 'S',
      ending: 'beneficial-abundance',
      choice_2029: 'verified-slowdown',
      choice_2035: 'hold-the-line',
      active_play_seconds: 42,
      completed_at: '2026-07-21T00:01:00.000Z',
      completion_token: COMPLETION_TOKEN,
    })
    expect(outbox.pendingCount()).toBe(0)
    outbox.stop()
  })

  it('persists failures and retries them after reload without throwing', async () => {
    vi.useFakeTimers()
    let now = 1_000
    const storage = memoryStorage()
    const failedFetch = vi.fn<typeof fetch>(() => Promise.reject(new Error('D1 unavailable')))
    const first = new RunApiOutbox({ storage, fetch: failedFetch, now: () => now })
    first.enqueue('start', {
      play_id: '22222222-2222-4222-8222-222222222222',
      ruleset_version: RULESET_VERSION,
      language: 'en',
      started_at: '2026-07-21T00:00:00.000Z',
    })
    first.start()
    await first.flush()
    first.stop()

    expect(first.pendingCount()).toBe(1)
    expect(storage.values.get(RUN_OUTBOX_STORAGE_KEY)).toContain('22222222-2222-4222-8222-222222222222')

    now += 2_000
    const succeedingFetch = vi.fn<typeof fetch>(ok)
    const restored = new RunApiOutbox({ storage, fetch: succeedingFetch, now: () => now })
    restored.start()
    await restored.flush()

    expect(succeedingFetch).toHaveBeenCalledOnce()
    expect(restored.pendingCount()).toBe(0)
    restored.stop()
  })

  it('deduplicates completion writes by play id', () => {
    const storage = memoryStorage()
    const outbox = new RunApiOutbox({ storage, fetch: vi.fn<typeof fetch>(ok) })
    const completion = {
      play_id: '33333333-3333-4333-8333-333333333333',
      final_score: 70,
      rank: 'A' as const,
      ending: 'managed-transition' as const,
      choice_2029: null,
      choice_2035: null,
      active_play_seconds: 10,
      completed_at: '2026-07-21T00:00:10.000Z',
    }

    outbox.enqueue('complete', completion)
    outbox.enqueue('complete', { ...completion, active_play_seconds: 11 })

    expect(outbox.pendingCount()).toBe(1)
    expect(storage.values.get(RUN_OUTBOX_STORAGE_KEY)).toContain('"active_play_seconds":11')
  })

  it('drops a permanent 4xx so a later run is not blocked', async () => {
    const storage = memoryStorage()
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ completion_token: COMPLETION_TOKEN }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }))
    const outbox = new RunApiOutbox({ storage, fetch: fetchMock })
    for (const playId of [
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ]) outbox.enqueue('start', {
      play_id: playId,
      ruleset_version: RULESET_VERSION,
      language: 'ja',
      started_at: '2026-07-21T00:00:00.000Z',
    })

    outbox.start()
    await outbox.flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(outbox.pendingCount()).toBe(0)
    outbox.stop()
  })

  it('filters malformed persisted queue entries instead of retrying them forever', () => {
    const storage = memoryStorage()
    storage.setItem(RUN_OUTBOX_STORAGE_KEY, JSON.stringify([{
      id: 'start:not-a-uuid',
      kind: 'start',
      payload: { play_id: 'not-a-uuid' },
      attempts: 999,
      nextAttemptAt: 0,
      createdAt: 0,
    }]))

    const outbox = new RunApiOutbox({ storage, fetch: vi.fn<typeof fetch>(ok) })
    expect(outbox.pendingCount()).toBe(0)
  })
})
