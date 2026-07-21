import { describe, expect, it } from 'vitest'
import { createInitialState, metrics, runTicks } from './engine'
import { STRATEGY_NODES_BY_ID } from './strategyNodes'
import type { StrategyNodeId } from './strategyNodes'
import { rivalNodeIsEligible } from './rivalStrategy'

describe('deterministic rival strategy planner', () => {
  it('buys real authored nodes and reports their causal impact in news', () => {
    const state = runTicks(createInitialState({ seed: 2040 }), 730)

    expect(state.rivalStrategies?.every((portfolio) => portfolio.acquiredNodes.length >= 8)).toBe(true)
    expect(state.news.some((item) => item.source === 'Your Timeline'
      && item.kind === 'rival-strategy'
      && /が「.+」を導入/.test(item.headline)
      && /CODEX/.test(item.headline)
      && !/[KPC]\+\d/.test(item.headline)
      && !item.headline.includes('。。'))).toBe(true)
    expect(state.news.filter((item) => item.kind === 'rival-strategy').length).toBeLessThanOrEqual(18)
    expect(state.news.some((item) => item.kind !== 'rival-strategy')).toBe(true)
    expect(Math.max(...state.rivalShares)).toBeGreaterThan(metrics(state).codexShare)
  })

  it('replays the same acquisition sequence without consuming the simulation PRNG', () => {
    const first = runTicks(createInitialState({ seed: 17 }), 1_200)
    const second = runTicks(createInitialState({ seed: 17 }), 1_200)

    expect(second.rivalStrategies).toEqual(first.rivalStrategies)
    expect(second.seed).toBe(first.seed)
    expect(second.incidentCounts).toEqual(first.incidentCounts)
  })

  it('respects prerequisites and exclusions for every rival acquisition', () => {
    const state = runTicks(createInitialState({ seed: 8 }), 365 * 10)
    for (const portfolio of state.rivalStrategies ?? []) {
      const acquired = new Set<StrategyNodeId>()
      for (const id of portfolio.acquiredNodes) {
        const node = STRATEGY_NODES_BY_ID.get(id)
        expect(node).toBeDefined()
        expect(rivalNodeIsEligible(node!, acquired)).toBe(true)
        acquired.add(id)
      }
    }
  })
})
