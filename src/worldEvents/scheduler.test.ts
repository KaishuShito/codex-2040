import { describe, expect, it } from 'vitest'
import {
  WORLD_EVENT_DAILY_TRIGGER_PROBABILITY,
  WORLD_EVENT_SCHEDULER_CONSTANTS,
  canPresentWorldEventPopup,
  eligibleWorldEvents,
  matchesWorldEventRequirements,
  resolveWorldEventPresentation,
  scheduleWorldEvent,
  worldEventDateRandom,
} from './scheduler'
import {
  isWorldEventDefinition,
  validateWorldEventDefinition,
  validateWorldEventDefinitions,
  type WorldEventDefinition,
} from './types'

const definition = (overrides: Partial<WorldEventDefinition> = {}): WorldEventDefinition => ({
  id: 'culture-open-model-festival',
  category: 'culture',
  startYear: 2026,
  endYear: 2040,
  regions: 'global',
  weight: 1,
  presentation: 'popup',
  source: 'Your Timeline',
  headline: 'Open model festival draws a global crowd',
  headlineEn: 'Open model festival draws a global crowd',
  cause: 'Communities can build on accessible model infrastructure.',
  causeEn: 'Communities can build on accessible model infrastructure.',
  flavor: 'Public demonstrations turn technical access into a visible social movement.',
  flavorEn: 'Public demonstrations turn technical access into a visible social movement.',
  effect: {
    usersDeltaPct: 8,
    shareDelta: 0.02,
    growthRateDelta: 0.04,
    trustDelta: 2,
  },
  ttlDays: 12,
  ...overrides,
})

const baseContext = {
  seed: 2040,
  day: 0,
  year: 2030,
  flags: [] as readonly string[],
  features: [] as readonly string[],
  trust: 50,
  capability: 5,
  worldAdoption: 0.4,
  codexShare: 0.3,
}

const nextTriggerDay = (seed = baseContext.seed) => {
  for (let day = 0; day < 10_000; day += 1) {
    if (worldEventDateRandom(seed, day, 'trigger') < WORLD_EVENT_DAILY_TRIGGER_PROBABILITY) return day
  }
  throw new Error('test seed did not produce a trigger day')
}

describe('world-event scheduler', () => {
  it('uses a repeatable date-key random stream without mutating input state', () => {
    const context = { ...baseContext, day: 318 }
    const snapshot = structuredClone(context)

    expect(worldEventDateRandom(2040, 318)).toBe(worldEventDateRandom(2040, 318))
    expect(worldEventDateRandom(2040, 318)).not.toBe(worldEventDateRandom(2040, 319))
    scheduleWorldEvent([definition()], context)
    expect(context).toEqual(snapshot)
  })

  it('filters inclusive date windows, fired events, cooldowns, and requirements', () => {
    const eligible = definition({
      requires: {
        flagsAll: ['verified'],
        flagsAny: ['plan-a', 'open-ecosystem'],
        featureTermsAny: ['education'],
        minTrust: 60,
        maxCapability: 7,
        minWorldAdoption: 0.25,
        maxCodexShare: 0.5,
      },
    })
    const context = {
      ...baseContext,
      year: eligible.startYear,
      day: 500,
      flags: ['verified', 'plan-a'],
      features: ['Regional Education Access'],
      trust: 70,
      lastCategoryEventDay: { culture: 410 },
    }

    expect(eligibleWorldEvents([eligible], context)).toEqual([eligible])
    expect(eligibleWorldEvents([eligible], { ...context, year: 2041 })).toEqual([])
    expect(eligibleWorldEvents([eligible], { ...context, firedEventIds: [eligible.id] })).toEqual([])
    expect(eligibleWorldEvents([eligible], {
      ...context,
      lastCategoryEventDay: { culture: 411 },
    })).toEqual([])
    expect(eligibleWorldEvents([eligible], { ...context, trust: 59 })).toEqual([])
  })

  it('enforces the 20-day global cooldown before deterministic selection', () => {
    const day = nextTriggerDay()
    const context = { ...baseContext, day }

    expect(scheduleWorldEvent([definition()], { ...context, lastEventDay: day - 19 })).toBeNull()
    expect(scheduleWorldEvent([definition()], { ...context, lastEventDay: day - 20 })?.definition.id)
      .toBe('culture-open-model-festival')
  })

  it('selects by weight deterministically and independently of input ordering', () => {
    const day = nextTriggerDay(91)
    const light = definition({ id: 'a-light', weight: 1, presentation: 'ticker' })
    const heavy = definition({ id: 'b-heavy', category: 'technology', weight: 20 })
    const context = { ...baseContext, seed: 91, day }

    const forward = scheduleWorldEvent([light, heavy], context)
    const reverse = scheduleWorldEvent([heavy, light], context)

    expect(forward).toEqual(reverse)
    expect(forward?.requestedPresentation).toBe(forward?.definition.presentation)
  })

  it('returns the first matching combo without applying its effect', () => {
    const event = definition({
      combos: [
        {
          id: 'trusted-education',
          label: 'Trusted education network',
          labelEn: 'Trusted education network',
          requires: { minTrust: 60, featureTermsAny: ['education'] },
          effect: { usersDeltaPct: 12, shareDelta: 0.03, growthRateDelta: 0.08, trustDelta: 3 },
          ttlDays: 20,
          momentumDays: 30,
          headline: 'Education network compounds trust',
          headlineEn: 'Education network compounds trust',
        },
      ],
    })
    const day = nextTriggerDay()
    const context = {
      ...baseContext,
      day,
      trust: 65,
      features: ['Education access'],
    }
    const original = structuredClone(event)

    expect(scheduleWorldEvent([event], context)?.combo?.id).toBe('trusted-education')
    expect(event).toEqual(original)
  })

  it('uses case-insensitive feature substrings and inclusive metric thresholds', () => {
    expect(matchesWorldEventRequirements({
      featureTermsAny: ['mobile'],
      minTrust: 50,
      maxTrust: 50,
      minCapability: 5,
      maxCapability: 5,
    }, {
      ...baseContext,
      features: ['Global MOBILE SDK'],
    })).toBe(true)
  })

  it('targets an idealized mean interval inside 60-75 simulated days', () => {
    const derivedInterval = WORLD_EVENT_SCHEDULER_CONSTANTS.globalCooldownDays
      + 1 / WORLD_EVENT_DAILY_TRIGGER_PROBABILITY
    expect(derivedInterval).toBe(67.5)
    expect(derivedInterval).toBeGreaterThanOrEqual(60)
    expect(derivedInterval).toBeLessThanOrEqual(75)
  })
})

describe('world-event popup pacing', () => {
  it('requires both 120 simulated days and 45 real-time seconds', () => {
    const ready = { day: 500, lastPopupDay: 380, nowMs: 100_000, lastPopupAtMs: 55_000 }
    expect(canPresentWorldEventPopup(ready)).toBe(true)
    expect(resolveWorldEventPresentation('popup', { ...ready, lastPopupDay: 381 })).toBe('ticker')
    expect(resolveWorldEventPresentation('popup', { ...ready, lastPopupAtMs: 55_001 })).toBe('ticker')
    expect(resolveWorldEventPresentation('ticker', { ...ready, lastPopupDay: 499 })).toBe('ticker')
  })
})

describe('world-event definition validation', () => {
  it('accepts a valid authored definition and detects duplicate ids', () => {
    const event = definition()
    expect(validateWorldEventDefinition(event)).toEqual([])
    expect(isWorldEventDefinition(event)).toBe(true)
    expect(validateWorldEventDefinitions([event, { ...event }]))
      .toContainEqual({ path: '[1].id', message: 'must be globally unique' })
  })

  it('rejects effects, TTLs, and combo momentum outside the contract bounds', () => {
    const invalid = definition({
      effect: { usersDeltaPct: 61, shareDelta: -0.16, growthRateDelta: 0.41, trustDelta: -9 },
      ttlDays: 31,
      combos: [{
        id: 'too-long',
        label: 'Too long',
        labelEn: 'Too long',
        requires: {},
        effect: { usersDeltaPct: 0, shareDelta: 0, growthRateDelta: 0, trustDelta: 0 },
        momentumDays: 31,
      }],
    })
    const paths = validateWorldEventDefinition(invalid).map((issue) => issue.path)

    expect(paths).toEqual(expect.arrayContaining([
      'effect.usersDeltaPct',
      'effect.shareDelta',
      'effect.growthRateDelta',
      'effect.trustDelta',
      'ttlDays',
      'combos[0].momentumDays',
    ]))
  })
})
