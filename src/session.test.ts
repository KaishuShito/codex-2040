import { describe, expect, it } from 'vitest'
import { createInitialState, type GameState } from './engine'
import { decodeSession, encodeSession } from './session'

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
})
