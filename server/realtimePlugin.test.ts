import { describe, expect, it, vi } from 'vitest'
import { createRealtimeClientSecretService, REALTIME_SESSION } from './realtimePlugin.js'

describe('Realtime client secret service', () => {
  it('falls back without making a request when the server key is absent', async () => {
    const fetchImpl = vi.fn()
    await expect(createRealtimeClientSecretService({ apiKey: '', fetchImpl }).mint()).resolves.toEqual({
      ok: false,
      status: 503,
      error: 'voice-fallback-required',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('uses the standard key only in the server request and returns a short-lived secret', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ value: 'ek_test_ephemeral', expires_at: 1_900_000_000 }),
    }))
    const result = await createRealtimeClientSecretService({ apiKey: 'server-only-test-key', fetchImpl }).mint()
    expect(result).toEqual({ ok: true, status: 200, value: 'ek_test_ephemeral', expires_at: 1_900_000_000 })
    const [, request] = fetchImpl.mock.calls[0]
    expect(request.headers.authorization).toBe('Bearer server-only-test-key')
    const body = JSON.parse(request.body)
    expect(body.expires_after.seconds).toBe(120)
    expect(body.session.model).toBe('gpt-realtime-2.1')
    expect(body.session.tools).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('server-only-test-key')
  })

  it('collapses upstream failures to a non-sensitive fallback response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'secret detail' } }) }))
    await expect(createRealtimeClientSecretService({ apiKey: 'invalid', fetchImpl }).mint()).resolves.toEqual({
      ok: false,
      status: 503,
      error: 'voice-fallback-required',
    })
  })

  it('pins the fictional identity and game-only authority boundary in the session', () => {
    expect(REALTIME_SESSION.instructions).toContain('fictionalized demo operator')
    expect(REALTIME_SESSION.instructions).toContain('never changes an OpenAI account')
    expect(REALTIME_SESSION.instructions).toContain('never call the confirmed tool automatically')
  })
})
