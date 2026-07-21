import { describe, expect, it } from 'vitest'
import { createInitialState, type GameState } from './engine'
import { decodeSession, encodeSession } from './session'
import { RULESET_VERSION } from '../shared/ruleset'

describe('persisted game session', () => {
  it('round-trips progress and tutorial completion', () => {
    const state: GameState = {
      ...createInitialState(),
      day: 731,
      compute: 412,
      features: ['Education Mode'],
      acquiredStrategyNodes: ['model-foundation'],
      strategyNodePurchaseCounts: { 'model-foundation': 1 },
    }
    const raw = encodeSession(state, true, '2026-07-20T07:00:00.000Z')
    const restored = decodeSession(raw)

    expect(restored?.hasStarted).toBe(true)
    expect(restored?.state.day).toBe(731)
    expect(restored?.state.compute).toBe(412)
    expect(restored?.state.features).toEqual(['Education Mode'])
    expect(restored?.state.acquiredStrategyNodes).toEqual(['model-foundation'])
    expect(restored?.state.strategyNodePurchaseCounts).toEqual({ 'model-foundation': 1 })
  })

  it('rejects stale or malformed sessions instead of breaking startup', () => {
    expect(decodeSession('{not-json')).toBeNull()
    expect(decodeSession(JSON.stringify({ version: 2, state: {} }))).toBeNull()
    expect(decodeSession(JSON.stringify({ version: 1, savedAt: '', hasStarted: true, state: { day: 5, regions: [] } }))).toBeNull()
    const stale = JSON.parse(encodeSession(createInitialState(), true))
    stale.rulesetVersion = 'codex-2040-rules-v1'
    expect(decodeSession(JSON.stringify(stale))).toBeNull()
  })

  it('migrates an active v1 save but rejects a terminal v1 save already eligible for old telemetry', () => {
    const legacy = JSON.parse(encodeSession({ ...createInitialState(), day: 30 }, true))
    legacy.version = 1
    delete legacy.rulesetVersion

    expect(decodeSession(JSON.stringify(legacy))).toMatchObject({
      version: 2,
      rulesetVersion: RULESET_VERSION,
      hasStarted: true,
      state: { day: 30, terminal: false },
    })

    legacy.state.terminal = true
    legacy.state.ending = 'managed-transition'
    expect(decodeSession(JSON.stringify(legacy))).toBeNull()
  })

  it('rejects malformed strategy fields while accepting legacy saves without them', () => {
    const state = createInitialState()
    const base = JSON.parse(encodeSession(state, true))

    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, acquiredStrategyNodes: { 0: 'product-mobile' } },
    }))).toBeNull()
    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, strategyNodePurchaseCounts: { 'model-foundation': 'one' } },
    }))).toBeNull()

    delete base.state.acquiredStrategyNodes
    delete base.state.strategyNodePurchaseCounts
    expect(decodeSession(JSON.stringify(base))).not.toBeNull()
  })

  it('validates extinction progress and flags while hydrating legacy omissions', () => {
    const base = JSON.parse(encodeSession(createInitialState(), true))

    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, flags: ['valid', 7] },
    }))).toBeNull()
    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, safetyGapDays: -1 },
    }))).toBeNull()
    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, safetyGapDays: '120' },
    }))).toBeNull()
    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, interventions: -1 },
    }))).toBeNull()
    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, interventions: '2' },
    }))).toBeNull()

    delete base.state.flags
    delete base.state.safetyGapDays
    delete base.state.interventions
    const restored = decodeSession(JSON.stringify(base))
    expect(restored?.state.flags).toEqual([])
    expect(restored?.state.safetyGapDays).toBe(0)
    expect(restored?.state.interventions).toBe(0)
  })

  it('round-trips collectible bubbles and hydrates saves created before bubbles existed', () => {
    const state = createInitialState({ seed: 81 })
    const withBubble: GameState = {
      ...state,
      rewardBubbles: [{
        id: 'pf-bubble-1',
        region: 'na',
        reward: 7,
        placement: .4,
        remainingSeconds: 2.9,
        source: 'token-reset',
      }],
      nextBubbleId: 2,
    }
    const restored = decodeSession(encodeSession(withBubble, true))
    expect(restored?.state.rewardBubbles).toEqual(withBubble.rewardBubbles)

    const legacy = JSON.parse(encodeSession(state, true))
    delete legacy.state.bubbleSeed
    delete legacy.state.nextBubbleId
    delete legacy.state.rewardBubbles
    const legacyRestored = decodeSession(JSON.stringify(legacy))
    expect(legacyRestored?.state.rewardBubbles).toEqual([])
    expect(legacyRestored?.state.nextBubbleId).toBe(1)
    expect(legacyRestored?.state.bubbleSeed).toBeTypeOf('number')
  })

  it('rejects malformed collectible bubble save fields', () => {
    const base = JSON.parse(encodeSession(createInitialState(), true))
    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, rewardBubbles: [{ id: 'x', region: 'moon', reward: 99 }] },
    }))).toBeNull()
    expect(decodeSession(JSON.stringify({
      ...base,
      state: { ...base.state, bubbleSeed: '2040' },
    }))).toBeNull()
  })
})
