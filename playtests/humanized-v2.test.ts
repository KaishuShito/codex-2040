import { describe, expect, it } from 'vitest'
import type { GameAction } from '../src/engine'
import passivePolicy from './policies/agent-06'
import {
  HUMAN_PROFILES,
  adaptLegacyPolicy,
  humanizedV2Seeds,
  observePlayerState,
  runHumanizedPlaythroughV2,
  type ObservationPolicy,
} from './humanized-v2'
import { createInitialState } from '../src/engine'

describe('humanized V2 playtest harness', () => {
  it('exposes only player-observable state and excludes hidden simulation streams', () => {
    const observation = observePlayerState(createInitialState({ seed: 123 }), HUMAN_PROFILES[0])
    expect(observation).toHaveProperty('compute')
    expect(observation).toHaveProperty('strategyNodes')
    expect(observation).not.toHaveProperty('seed')
    expect(observation).not.toHaveProperty('bubbleSeed')
    expect(observation).not.toHaveProperty('worldEventSeed')
    expect(observation).not.toHaveProperty('safetyGapDays')
    expect(observation).not.toHaveProperty('firedWorldEventIds')
  })

  it('separates scenario and behavior seeds and shares scenarios across all policies', () => {
    const first = humanizedV2Seeds('tuning', 2, 0, 0)
    const otherPolicy = humanizedV2Seeds('tuning', 2, 9, 4)
    const holdout = humanizedV2Seeds('holdout', 2, 0, 0)
    expect(otherPolicy.scenarioSeed).toBe(first.scenarioSeed)
    expect(otherPolicy.behaviorSeed).not.toBe(first.behaviorSeed)
    expect(holdout.scenarioSeed).not.toBe(first.scenarioSeed)
    expect(holdout.behaviorSeed).not.toBe(first.behaviorSeed)
  })

  it('is deterministic with independent scenario and behavior seeds', () => {
    const profile = HUMAN_PROFILES.find(({ id }) => id === 'competitive')!
    const policy = adaptLegacyPolicy(passivePolicy)
    const options = {
      split: 'holdout' as const,
      scenarioSeed: 111,
      behaviorSeed: 222,
      run: 1,
      disableDropout: true,
      sessionBudgetSeconds: 20_000,
    }
    expect(runHumanizedPlaythroughV2(policy, profile, options)).toEqual(
      runHumanizedPlaythroughV2(policy, profile, options),
    )
  }, 20_000)

  it('records timeout, first action latency, and inoperable exposure', () => {
    const profile = {
      ...HUMAN_PROFILES.find(({ id }) => id === 'novice')!,
      decisionIntervalDays: [0, 0] as const,
      actionFollowThrough: 1,
      mistakeRate: 0,
    }
    const actionPolicy: ObservationPolicy = {
      id: 'latency-probe',
      description: 'takes a valid first action',
      choice2029: 'race',
      choice2035: 'accelerate',
      decideObservation: (observation): GameAction | null => observation.resetCooldownSeconds === 0 ? { type: 'reset' } : null,
    }
    const result = runHumanizedPlaythroughV2(actionPolicy, profile, {
      split: 'tuning',
      scenarioSeed: 10,
      behaviorSeed: 20,
      run: 1,
      disableDropout: true,
      sessionBudgetSeconds: 5,
    })
    expect(result.timedOut).toBe(true)
    expect(result.completionReason).toBe('timeout')
    expect(result.timeToFirstActionSeconds).not.toBeNull()
    expect(result.inoperableSeconds).toBeGreaterThanOrEqual(0)
    expect(result.inoperableDays).toBeGreaterThanOrEqual(0)
  })

  it('turns mistakes into accepted alternative investments or speed changes', () => {
    const base = HUMAN_PROFILES.find(({ id }) => id === 'explorer')!
    const alwaysMistake = { ...base, mistakeRate: 1, actionFollowThrough: 1 }
    const policy: ObservationPolicy = {
      id: 'mistake-probe',
      description: 'always attempts reset',
      choice2029: 'race',
      choice2035: 'accelerate',
      decideObservation: (): GameAction => ({ type: 'reset' }),
    }
    const result = runHumanizedPlaythroughV2(policy, alwaysMistake, {
      split: 'tuning',
      scenarioSeed: 30,
      behaviorSeed: 40,
      run: 1,
      disableDropout: true,
      sessionBudgetSeconds: 30,
    })
    expect(result.mistakenActions).toBeGreaterThan(0)
    expect(result.mistakenInvestmentActions + result.mistakenSpeedActions).toBe(result.mistakenActions)
    expect(result.actionLog.some(({ action, accepted }) =>
      accepted && (action.type === 'strategy-node' || action.type === 'set-speed'))).toBe(true)
  })
})
