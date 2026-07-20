import { describe, expect, it } from 'vitest'
import {
  acquiredStrategyNodeIds,
  applyWorldEvent,
  buyStrategyNode,
  createInitialState,
  enforceInvariants,
  getStrategyNodeAvailability,
  getStrategyNodeCost,
  metrics,
  runTicks,
  strategyPersistentEffects,
} from './engine'
import type { GameState } from './engine'
import { WORLD_EVENTS } from './worldEvents/catalog'

describe('50-node deterministic strategy engine', () => {
  it('enforces exact catalog costs, prerequisites, and one-time acquisition', () => {
    const initial = createInitialState()
    expect(getStrategyNodeCost(initial, 'product-mobile')).toBe(90)
    expect(getStrategyNodeCost(initial, 'model-foundation')).toBe(70)
    expect(getStrategyNodeAvailability(initial, 'product-education')?.status).toBe('locked')

    const mobile = buyStrategyNode(initial, 'product-mobile')
    expect(mobile.compute).toBe(initial.compute - 90)
    expect(acquiredStrategyNodeIds(mobile)).toContain('product-mobile')
    expect(mobile.strategyNodePurchaseCounts?.['product-mobile']).toBe(1)
    expect(getStrategyNodeAvailability(mobile, 'product-mobile')?.status).toBe('acquired')
    expect(getStrategyNodeAvailability(mobile, 'product-education')?.status).toBe('ready')
    expect(buyStrategyNode(mobile, 'product-mobile')).toBe(mobile)
  })

  it('keeps legacy-backed model stages repeatable until K3/K5/K7/K10 targets', () => {
    let state = { ...createInitialState(), compute: 100_000 }
    state = buyStrategyNode(state, 'model-foundation')
    expect(state.capability).toBe(3)
    expect(getStrategyNodeAvailability(state, 'model-foundation')?.status).toBe('acquired')
    expect(getStrategyNodeAvailability(state, 'model-reasoning')?.status).toBe('ready')

    state = buyStrategyNode(state, 'model-reasoning')
    expect(state.capability).toBe(4)
    expect(getStrategyNodeAvailability(state, 'model-reasoning')?.status).toBe('ready')
    state = buyStrategyNode(state, 'model-reasoning')
    expect(state.capability).toBe(5)
    expect(getStrategyNodeAvailability(state, 'model-reasoning')?.status).toBe('acquired')
    expect(state.strategyNodePurchaseCounts?.['model-reasoning']).toBe(2)
    expect(getStrategyNodeAvailability(state, 'model-agents')?.status).toBe('ready')
  })

  it('does not auto-complete unpurchased model branches from global capability', () => {
    const accelerated = { ...createInitialState(), compute: 100_000, capability: 8 }
    expect(accelerated.acquiredStrategyNodes).toEqual([])
    expect(getStrategyNodeAvailability(accelerated, 'model-foundation')?.status).toBe('ready')
    expect(getStrategyNodeAvailability(accelerated, 'model-reasoning')?.status).toBe('locked')
    expect(getStrategyNodeAvailability(accelerated, 'model-frontier')?.status).toBe('locked')

    const foundation = buyStrategyNode(accelerated, 'model-foundation')
    expect(acquiredStrategyNodeIds(foundation)).toEqual(['model-foundation'])
    expect(getStrategyNodeAvailability(foundation, 'model-reasoning')?.status).toBe('ready')
    expect(getStrategyNodeAvailability(foundation, 'model-agents')?.status).toBe('ready')
    expect(getStrategyNodeAvailability(foundation, 'model-frontier')?.status).toBe('locked')

    let agentsOnly = buyStrategyNode({ ...createInitialState(), compute: 100_000 }, 'model-foundation')
    while (agentsOnly.capability < 7) agentsOnly = buyStrategyNode(agentsOnly, 'model-agents')
    expect(getStrategyNodeAvailability(agentsOnly, 'model-agents')?.status).toBe('acquired')
    expect(acquiredStrategyNodeIds(agentsOnly)).not.toContain('model-reasoning')
    expect(getStrategyNodeAvailability(agentsOnly, 'model-frontier')?.status).toBe('locked')
  })

  it('keeps Safety, Policy, and Data Center investments repeatable until their caps', () => {
    let state = { ...createInitialState(), compute: 100_000 }
    state = buyStrategyNode(state, 'company-safety')
    state = buyStrategyNode(state, 'company-safety')
    expect(state.safety).toBe(4)
    expect(state.strategyNodePurchaseCounts?.['company-safety']).toBe(2)
    expect(getStrategyNodeAvailability(state, 'company-safety')?.status).toBe('ready')
    expect(getStrategyNodeAvailability(state, 'company-datacenter')?.status).toBe('ready')

    state = buyStrategyNode(state, 'company-datacenter')
    state = buyStrategyNode(state, 'company-datacenter')
    expect(state.efficiency).toBe(1.5)
    expect(state.strategyNodePurchaseCounts?.['company-datacenter']).toBe(2)
    expect(strategyPersistentEffects(state).controlRelief).toBeCloseTo(.16)
    expect(strategyPersistentEffects(state).opexMultiplier).toBeCloseTo(.93 ** 2)
  })

  it('applies regional, user, trust, and persistent effects exactly once per purchase', () => {
    const initial = createInitialState()
    const latinAmerica = initial.regions.find((region) => region.id === 'latam')!
    const mobile = buyStrategyNode(initial, 'product-mobile')
    const nextLatinAmerica = mobile.regions.find((region) => region.id === 'latam')!
    const africa = mobile.regions.find((region) => region.id === 'africa')!

    expect(nextLatinAmerica.users - latinAmerica.users).toBeCloseTo(latinAmerica.population * .0004)
    expect(nextLatinAmerica.fit).toBeCloseTo(latinAmerica.fit * 1.04)
    expect(africa.users).toBe(0)
    expect(mobile.features).toContain('Mobile SDK')

    const sso = buyStrategyNode(initial, 'product-sso')
    expect(sso.trust).toBe(initial.trust + 1)
    expect(strategyPersistentEffects(sso).incomeMultiplier).toBeCloseTo(1.05)
  })

  it('does not inflate the legacy product score for new catalog-only product nodes', () => {
    const prepared = {
      ...createInitialState(),
      compute: 10_000,
      capability: 7,
      acquiredStrategyNodes: ['model-foundation', 'model-agents'] as GameState['acquiredStrategyNodes'],
    }
    const beforeFeatures = [...prepared.features]
    const voice = buyStrategyNode(prepared, 'product-voice-companion')
    expect(acquiredStrategyNodeIds(voice)).toContain('product-voice-companion')
    expect(voice.features).toEqual(beforeFeatures)
  })

  it('activates an authored world-event combo advertised by a purchased node', () => {
    const prepared = {
      ...createInitialState(),
      compute: 10_000,
      capability: 5,
      acquiredStrategyNodes: ['model-foundation', 'model-reasoning'] as GameState['acquiredStrategyNodes'],
    }
    const withWatermark = buyStrategyNode(prepared, 'product-watermark')
    const definition = WORLD_EVENTS.find((event) => event.id === 'technology-content-watermark-standard')!
    const result = applyWorldEvent(withWatermark, {
      definition,
      combo: null,
      requestedPresentation: 'ticker',
    })

    expect(result.pendingWorldEvent).toBeNull()
    expect(result.activeEffects.at(-1)).toMatchObject({ trustDelta: 7 })
    expect(result.news[0].headline).toBe('EDUCATION MODE MAKES MEDIA PROVENANCE A CORE SKILL')
  })

  it('enforces mutually exclusive branches in both directions', () => {
    const prepared = enforceInvariants({
      ...createInitialState(),
      compute: 10_000,
      capability: 10,
      acquiredStrategyNodes: ['model-foundation', 'model-reasoning', 'model-distillation', 'model-agents', 'model-frontier'],
    })
    const efficient = buyStrategyNode(prepared, 'model-efficient-inference')
    expect(acquiredStrategyNodeIds(efficient)).toContain('model-efficient-inference')
    expect(getStrategyNodeAvailability(efficient, 'model-scale-race')).toMatchObject({
      status: 'excluded',
      blockingNodeId: 'model-efficient-inference',
    })
    expect(buyStrategyNode(efficient, 'model-scale-race')).toBe(efficient)

    const scale = buyStrategyNode(prepared, 'model-scale-race')
    expect(getStrategyNodeAvailability(scale, 'model-efficient-inference')).toMatchObject({
      status: 'excluded',
      blockingNodeId: 'model-scale-race',
    })
    expect(getStrategyNodeAvailability(scale, 'ecosystem-open-weights-lite')).toMatchObject({
      status: 'excluded',
      blockingNodeId: 'model-scale-race',
    })
  })

  it('hydrates version-1 saves without strategy fields and keeps simulation finite', () => {
    const legacy = { ...createInitialState(), day: 500 } as GameState
    delete legacy.acquiredStrategyNodes
    delete legacy.strategyNodePurchaseCounts
    const hydrated = enforceInvariants(legacy)
    const future = runTicks(hydrated, 10)

    expect(hydrated.acquiredStrategyNodes).toBeUndefined()
    expect(hydrated.strategyNodePurchaseCounts).toBeUndefined()
    expect(Number.isFinite(future.compute)).toBe(true)
    expect(Number.isFinite(metrics(future).codexShare)).toBe(true)
  })

  it('replays identical purchases and ticks from the same seed', () => {
    const play = () => {
      let state = createInitialState({ seed: 77 })
      state = buyStrategyNode(state, 'product-mobile')
      state = buyStrategyNode(state, 'product-education')
      state = buyStrategyNode(state, 'company-safety')
      return runTicks(state, 300)
    }
    expect(play()).toEqual(play())
  })
})
