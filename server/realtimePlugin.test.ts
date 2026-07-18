import { describe, expect, it, vi } from 'vitest'
import { createRealtimeClientSecretService, isAllowedRealtimeRequest, REALTIME_SESSION } from './realtimePlugin.js'

describe('Realtime client secret service', () => {
  it('accepts loopback and one explicitly configured public demo origin only', () => {
    const request = (origin: string, fetchSite = 'same-origin') => ({
      headers: { host: '127.0.0.1:5173', origin, 'sec-fetch-site': fetchSite },
    })
    const publicOrigin = 'https://demo.example.com'

    expect(isAllowedRealtimeRequest(request('http://127.0.0.1:5173'))).toBe(true)
    expect(isAllowedRealtimeRequest(request(publicOrigin), [publicOrigin])).toBe(true)
    expect(isAllowedRealtimeRequest(request('https://attacker.example'), [publicOrigin])).toBe(false)
    expect(isAllowedRealtimeRequest(request(publicOrigin, 'cross-site'), [publicOrigin])).toBe(false)
  })

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
    expect(REALTIME_SESSION.instructions).toContain('Do it')
    expect(REALTIME_SESSION.instructions).toContain('やって')
    expect(REALTIME_SESSION.instructions).toContain('do not do it')
    expect(REALTIME_SESSION.instructions).toContain('never call the confirmed tool automatically')
  })
})
