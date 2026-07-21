import { describe, expect, it } from 'vitest'
import { PILL_POLICIES, pillPolicyById } from './policies'
import type { PillObservation } from './types'

const observation = (overrides: Partial<PillObservation> = {}): PillObservation => ({
  tick: 0,
  intelligence: 1,
  compute: 1.5,
  energy: 1,
  robotics: 1,
  resources: 1,
  safety: 1,
  governance: 1,
  socialFriction: 0.2,
  alignmentRisk: 0.2,
  captureRisk: 0.2,
  orbitalCapacity: 0,
  dysonFraction: 0,
  warning: null,
  terminal: false,
  ...overrides,
})

describe('AGI Pill human-like policies', () => {
  it('provides the required distinct strategies', () => {
    expect(new Set(PILL_POLICIES.map(({ id }) => id)).size).toBe(7)
    expect(PILL_POLICIES.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'balanced', 'passive', 'overaccelerate', 'safety-first', 'industry-first', 'governance-first',
    ]))
  })

  it('keeps passive play observational and makes pressured policies recover', () => {
    expect(pillPolicyById('passive').decide(observation())).toBe('observe')
    for (const policy of PILL_POLICIES.filter(({ id }) => id !== 'passive')) {
      expect(policy.decide(observation({ energy: 0.01, resources: 0.01 }))).toBe('resource-recovery')
    }
  })

  it('treats a completed Dyson swarm as a beginning, not the ending action', () => {
    const postDyson = observation({
      intelligence: 3,
      compute: 6,
      energy: 3,
      robotics: 3,
      resources: 3,
      safety: 4,
      governance: 4,
      orbitalCapacity: 2,
      dysonFraction: 1,
    })
    expect(pillPolicyById('balanced').decide(postDyson)).toBe('post-dyson')
    expect(pillPolicyById('industry-first').decide(postDyson)).toBe('post-dyson')
  })

  it('lets non-passive human policies react to a visible countdown warning', () => {
    const warned = observation({
      warning: { kind: 'rival-capture', countdownDays: 90, recoveryPolicies: ['cooperate', 'balanced'] },
    })
    expect(pillPolicyById('balanced').decide(warned)).toBe('cooperate')
    expect(pillPolicyById('governance-first').decide(warned)).toBe('cooperate')
    expect(pillPolicyById('passive').decide(warned)).toBe('observe')
  })
})
