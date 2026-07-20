import { describe, expect, it } from 'vitest'
import { createInitialState } from './engine'
import { decodeSession, encodeSession } from './session'

describe('persisted game session', () => {
  it('round-trips progress and tutorial completion', () => {
    const state = { ...createInitialState(), day: 731, compute: 412, features: ['Education Mode'] }
    const raw = encodeSession(state, true, '2026-07-20T07:00:00.000Z')
    const restored = decodeSession(raw)

    expect(restored?.hasStarted).toBe(true)
    expect(restored?.state.day).toBe(731)
    expect(restored?.state.compute).toBe(412)
    expect(restored?.state.features).toEqual(['Education Mode'])
  })

  it('rejects stale or malformed sessions instead of breaking startup', () => {
    expect(decodeSession('{not-json')).toBeNull()
    expect(decodeSession(JSON.stringify({ version: 2, state: {} }))).toBeNull()
    expect(decodeSession(JSON.stringify({ version: 1, savedAt: '', hasStarted: true, state: { day: 5, regions: [] } }))).toBeNull()
  })
})
