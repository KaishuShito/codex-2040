import { describe, expect, it } from 'vitest'
import { createAgiPillState } from '../../src/agiPill/engine'
import { observeAgiPill, pillBatchSeeds, runPillWorldline } from './harness'

describe('AGI Pill production-engine harness', () => {
  it('does not expose engine RNG or hidden trajectory counters to policies', () => {
    const observation = observeAgiPill(createAgiPillState({ seed: 1 }))
    expect(observation).toHaveProperty('intelligence')
    expect(observation).not.toHaveProperty('seed')
    expect(observation).not.toHaveProperty('unsafeDays')
    expect(observation).not.toHaveProperty('incidentDebt')
    expect(observation).not.toHaveProperty('rivalDominanceDays')
  })

  it('repeats the same policy and seed exactly', () => {
    const first = runPillWorldline('balanced', { seed: 1234, repeat: 0, maxDays: 800 })
    const repeat = runPillWorldline('balanced', { seed: 1234, repeat: 1, maxDays: 800 })
    expect(repeat.fingerprint).toBe(first.fingerprint)
    expect(repeat.resources).toEqual(first.resources)
  })

  it('keeps scenario seeds independent from policy identity', () => {
    expect(pillBatchSeeds(4)).toEqual(pillBatchSeeds(4))
    expect(new Set(pillBatchSeeds(12)).size).toBe(12)
  })

  it('executes eligible authored events and funds affordable visible upgrades', () => {
    const result = runPillWorldline('safety-first', { seed: 1234, maxDays: 4_000 })
    expect(result.executedEventCount).toBe(result.dueEventCount)
    expect(result.executedEventCount).toBeGreaterThan(0)
    expect(result.eventOptionIds).toHaveLength(result.executedEventCount)
    expect(result.upgradePurchases).toBeGreaterThan(0)
    expect(result.upgradePurchases).toBeLessThanOrEqual(8)
    expect(result.purchasedUpgradeIds).toHaveLength(result.upgradePurchases)
  })
})
