import { describe, expect, it } from 'vitest'
import passivePolicy from './policies/agent-06'
import { HUMAN_PROFILES, runHumanizedPlaythrough } from './humanized'

describe('humanized playtest harness', () => {
  it('is deterministic for an identical policy, profile, and seed', () => {
    const profile = HUMAN_PROFILES.find(({ id }) => id === 'novice')!
    const first = runHumanizedPlaythrough(passivePolicy, profile, { seed: 42_040, run: 1 })
    const second = runHumanizedPlaythrough(passivePolicy, profile, { seed: 42_040, run: 1 })

    expect(second).toEqual(first)
    expect(first.synthetic).toBe(true)
    expect(first.completed).toBe(true)
    expect(first.policyCalls).toBeGreaterThan(0)
    expect(first.realSecondsElapsed).toBeGreaterThan(0)
  }, 20_000)

  it('defines five behaviorally distinct profiles with bounded probabilities', () => {
    expect(HUMAN_PROFILES.map(({ id }) => id)).toEqual(['novice', 'cautious', 'competitive', 'explorer', 'frugal'])
    expect(new Set(HUMAN_PROFILES.map(({ decisionIntervalDays }) => decisionIntervalDays.join(':'))).size).toBe(5)
    for (const profile of HUMAN_PROFILES) {
      expect(profile.actionFollowThrough).toBeGreaterThan(0)
      expect(profile.actionFollowThrough).toBeLessThanOrEqual(1)
      expect(profile.mistakeRate).toBeGreaterThanOrEqual(0)
      expect(profile.mistakeRate).toBeLessThan(1)
      expect(profile.bubbleCatchRate).toBeGreaterThanOrEqual(0)
      expect(profile.bubbleCatchRate).toBeLessThanOrEqual(1)
    }
  })
})
