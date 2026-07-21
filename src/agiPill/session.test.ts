import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine'
import { encodeSession } from '../session'
import {
  decodeModeSession,
  encodeAgiPillModeSession,
  encodeStandardModeSession,
  MODE_SESSION_STORAGE_KEY,
} from './session'

type PillState = {
  year: number
  intelligence: number
  safety: number
  milestones: string[]
}

const PILL_RULESET = 'agi-pill-rules-v1'
const pillCodec = {
  rulesetVersion: PILL_RULESET,
  decodeState(value: unknown): PillState | null {
    if (!value || typeof value !== 'object') return null
    const candidate = value as Partial<PillState>
    return typeof candidate.year === 'number' && Number.isFinite(candidate.year)
      && typeof candidate.intelligence === 'number' && Number.isFinite(candidate.intelligence)
      && typeof candidate.safety === 'number' && Number.isFinite(candidate.safety)
      && Array.isArray(candidate.milestones)
      && candidate.milestones.every((milestone) => typeof milestone === 'string')
      ? candidate as PillState
      : null
  },
}

describe('versioned mode sessions', () => {
  it('reads a legacy Standard save as Standard without changing its state', () => {
    const state = { ...createInitialState({ seed: 2040 }), day: 731, compute: 412 }
    const raw = encodeSession(state, true, '2026-07-21T01:02:03.000Z')

    const restored = decodeModeSession(raw, pillCodec)

    expect(restored?.mode).toBe('standard')
    if (restored?.mode !== 'standard') throw new Error('expected Standard save')
    expect(restored.session.savedAt).toBe('2026-07-21T01:02:03.000Z')
    expect(restored.session.hasStarted).toBe(true)
    expect(restored.session.state.day).toBe(731)
    expect(restored.session.state.compute).toBe(412)
  })

  it('round-trips a Standard mode envelope through the existing codec', () => {
    const state = { ...createInitialState({ seed: 81 }), day: 365 }
    const restored = decodeModeSession(
      encodeStandardModeSession(state, false, '2026-07-21T02:00:00.000Z'),
      pillCodec,
    )

    expect(restored).toMatchObject({
      version: 1,
      mode: 'standard',
      session: { savedAt: '2026-07-21T02:00:00.000Z', hasStarted: false, state: { day: 365 } },
    })
  })

  it('round-trips an AGI Pill session with its independent ruleset', () => {
    const state: PillState = { year: 2047, intelligence: 9.4, safety: 0.72, milestones: ['lunar-foundry'] }
    const restored = decodeModeSession(
      encodeAgiPillModeSession(
        state,
        true,
        PILL_RULESET,
        '2026-07-21T03:00:00.000Z',
        { speed: 8, paused: true },
      ),
      pillCodec,
    )

    expect(restored).toEqual({
      version: 1,
      mode: 'agi-pill',
      rulesetVersion: PILL_RULESET,
      savedAt: '2026-07-21T03:00:00.000Z',
      hasStarted: true,
      speed: 8,
      paused: true,
      state,
    })
  })

  it('defaults playback safely when reading an older v1 AGI Pill payload', () => {
    const raw = JSON.parse(encodeAgiPillModeSession(
      { year: 2047, intelligence: 1, safety: 1, milestones: [] },
      true,
      PILL_RULESET,
    ))
    delete raw.speed
    delete raw.paused

    expect(decodeModeSession(JSON.stringify(raw), pillCodec)).toMatchObject({
      mode: 'agi-pill',
      speed: 1,
      paused: false,
    })
  })

  it('fails closed for malformed, unknown-mode, stale-ruleset, and invalid-state saves', () => {
    expect(decodeModeSession('{not-json', pillCodec)).toBeNull()
    expect(decodeModeSession(JSON.stringify({ version: 1, mode: 'surprise' }), pillCodec)).toBeNull()
    expect(decodeModeSession(JSON.stringify({
      version: 1,
      mode: 'agi-pill',
      rulesetVersion: 'stale',
      savedAt: '2026-07-21T03:00:00.000Z',
      hasStarted: true,
      state: { year: 2047, intelligence: 9.4, safety: 0.72, milestones: [] },
    }), pillCodec)).toBeNull()
    expect(decodeModeSession(JSON.stringify({
      version: 1,
      mode: 'agi-pill',
      rulesetVersion: PILL_RULESET,
      savedAt: '2026-07-21T03:00:00.000Z',
      hasStarted: true,
      state: { year: 'soon' },
    }), pillCodec)).toBeNull()
    const invalidPlayback = JSON.parse(encodeAgiPillModeSession(
      { year: 2047, intelligence: 1, safety: 1, milestones: [] },
      true,
      PILL_RULESET,
    ))
    invalidPlayback.speed = 4
    expect(decodeModeSession(JSON.stringify(invalidPlayback), pillCodec)).toBeNull()
    invalidPlayback.speed = 1
    invalidPlayback.paused = 'yes'
    expect(decodeModeSession(JSON.stringify(invalidPlayback), pillCodec)).toBeNull()
    expect(decodeModeSession(encodeAgiPillModeSession(
      { year: 2047, intelligence: 1, safety: 1, milestones: [] },
      true,
      PILL_RULESET,
    ), {
      rulesetVersion: PILL_RULESET,
      decodeState: () => { throw new Error('migration failed') },
    })).toBeNull()
  })

  it('keeps mode persistence outside the existing Standard and D1 contracts', () => {
    expect(MODE_SESSION_STORAGE_KEY).toBe('codex-2040:agi-pill-session:v1')
    const raw = JSON.parse(encodeAgiPillModeSession(
      { year: 2047, intelligence: 1, safety: 1, milestones: [] },
      true,
      PILL_RULESET,
    ))
    expect(raw).not.toHaveProperty('play_id')
    expect(raw).not.toHaveProperty('ruleset_version')
  })
})
