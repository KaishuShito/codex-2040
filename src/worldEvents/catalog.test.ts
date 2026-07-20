import { describe, expect, it } from 'vitest'
import { COMPETITION_EVENTS } from './data/competition'
import { CULTURE_EVENTS } from './data/culture'
import { DISASTER_EVENTS } from './data/disaster'
import { POLICY_EVENTS } from './data/policy'
import { TECHNOLOGY_EVENTS } from './data/technology'
import {
  WORLD_EVENT_BOUNDS,
  WORLD_EVENT_REGION_IDS,
  WORLD_EVENT_SOURCES,
  WORLD_EVENT_TARGETS,
  validateWorldEventDefinitions,
  type WorldEventCategory,
  type WorldEventDefinition,
  type WorldEventEffect,
} from './types'

const CATALOGS = [
  ['disaster', DISASTER_EVENTS],
  ['culture', CULTURE_EVENTS],
  ['policy', POLICY_EVENTS],
  ['competition', COMPETITION_EVENTS],
  ['technology', TECHNOLOGY_EVENTS],
] as const satisfies readonly (readonly [WorldEventCategory, readonly WorldEventDefinition[]])[]

const ALL_EVENTS = CATALOGS.flatMap(([, events]) => events)
const FORBIDDEN_DIRECT_FIELDS = [
  'compute',
  'capability',
  'safety',
  'governance',
  'regulation',
  'terminal',
  'incident',
  'choice',
] as const

const expectNonEmptyText = (value: string) => {
  expect(typeof value).toBe('string')
  expect(value.trim().length).toBeGreaterThan(0)
}

const expectEffectWithinBounds = (effect: WorldEventEffect) => {
  expect(effect.usersDeltaPct).toBeGreaterThanOrEqual(WORLD_EVENT_BOUNDS.usersDeltaPct.min)
  expect(effect.usersDeltaPct).toBeLessThanOrEqual(WORLD_EVENT_BOUNDS.usersDeltaPct.max)
  expect(effect.shareDelta).toBeGreaterThanOrEqual(WORLD_EVENT_BOUNDS.shareDelta.min)
  expect(effect.shareDelta).toBeLessThanOrEqual(WORLD_EVENT_BOUNDS.shareDelta.max)
  expect(effect.growthRateDelta).toBeGreaterThanOrEqual(WORLD_EVENT_BOUNDS.growthRateDelta.min)
  expect(effect.growthRateDelta).toBeLessThanOrEqual(WORLD_EVENT_BOUNDS.growthRateDelta.max)
  expect(effect.trustDelta).toBeGreaterThanOrEqual(WORLD_EVENT_BOUNDS.trustDelta.min)
  expect(effect.trustDelta).toBeLessThanOrEqual(WORLD_EVENT_BOUNDS.trustDelta.max)
  if (effect.target !== undefined) expect(WORLD_EVENT_TARGETS).toContain(effect.target)
}

const collectForbiddenFieldPaths = (value: unknown, path: string): string[] => {
  if (value === null || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenFieldPaths(item, `${path}[${index}]`))
  }

  return Object.entries(value).flatMap(([key, nested]) => [
    ...(FORBIDDEN_DIRECT_FIELDS.includes(key as (typeof FORBIDDEN_DIRECT_FIELDS)[number])
      ? [`${path}.${key}`]
      : []),
    ...collectForbiddenFieldPaths(nested, `${path}.${key}`),
  ])
}

describe('world-event catalog', () => {
  it('contains exactly 100 globally unique events, with exactly 20 per category', () => {
    expect(ALL_EVENTS).toHaveLength(100)
    expect(new Set(ALL_EVENTS.map((event) => event.id)).size).toBe(100)

    for (const [category, events] of CATALOGS) {
      expect(events, category).toHaveLength(20)
      expect(events.every((event) => event.category === category), category).toBe(true)
    }
  })

  it('keeps every definition complete and within the canonical schema', () => {
    expect(validateWorldEventDefinitions(ALL_EVENTS)).toEqual([])

    for (const event of ALL_EVENTS) {
      expectNonEmptyText(event.id)
      expectNonEmptyText(event.headline)
      expectNonEmptyText(event.cause)
      expectNonEmptyText(event.flavor)
      expect(Number.isInteger(event.startYear), event.id).toBe(true)
      expect(Number.isInteger(event.endYear), event.id).toBe(true)
      expect(event.startYear, event.id).toBeGreaterThanOrEqual(2026)
      expect(event.startYear, event.id).toBeLessThanOrEqual(2040)
      expect(event.endYear, event.id).toBeGreaterThanOrEqual(event.startYear)
      expect(event.endYear, event.id).toBeLessThanOrEqual(2040)
      expect(Number.isFinite(event.weight), event.id).toBe(true)
      expect(event.weight, event.id).toBeGreaterThan(0)
      expect(WORLD_EVENT_SOURCES, event.id).toContain(event.source)

      if (event.regions !== 'global') {
        expect(event.regions.length, event.id).toBeGreaterThan(0)
        expect(new Set(event.regions).size, event.id).toBe(event.regions.length)
        for (const region of event.regions) expect(WORLD_EVENT_REGION_IDS, event.id).toContain(region)
      }
    }
  })

  it('bounds base and combo effects, TTLs, and combo momentum', () => {
    for (const event of ALL_EVENTS) {
      expectEffectWithinBounds(event.effect)
      expect(Number.isInteger(event.ttlDays), event.id).toBe(true)
      expect(event.ttlDays, event.id).toBeGreaterThanOrEqual(WORLD_EVENT_BOUNDS.ttlDays.min)
      expect(event.ttlDays, event.id).toBeLessThanOrEqual(WORLD_EVENT_BOUNDS.ttlDays.max)

      for (const combo of event.combos ?? []) {
        expectNonEmptyText(combo.id)
        expectNonEmptyText(combo.label)
        expectEffectWithinBounds(combo.effect)
        if (combo.ttlDays !== undefined) {
          expect(Number.isInteger(combo.ttlDays), `${event.id}/${combo.id}`).toBe(true)
          expect(combo.ttlDays, `${event.id}/${combo.id}`).toBeGreaterThanOrEqual(WORLD_EVENT_BOUNDS.ttlDays.min)
          expect(combo.ttlDays, `${event.id}/${combo.id}`).toBeLessThanOrEqual(WORLD_EVENT_BOUNDS.ttlDays.max)
        }
        if (combo.momentumDays !== undefined) {
          expect(Number.isInteger(combo.momentumDays), `${event.id}/${combo.id}`).toBe(true)
          expect(combo.momentumDays, `${event.id}/${combo.id}`).toBeGreaterThanOrEqual(WORLD_EVENT_BOUNDS.comboMomentumDays.min)
          expect(combo.momentumDays, `${event.id}/${combo.id}`).toBeLessThanOrEqual(WORLD_EVENT_BOUNDS.comboMomentumDays.max)
        }
      }
    }
  })

  it('provides at least two combos per category without engine-owned direct fields', () => {
    for (const [category, events] of CATALOGS) {
      expect(events.flatMap((event) => event.combos ?? []).length, category).toBeGreaterThanOrEqual(2)
    }
    expect(collectForbiddenFieldPaths(ALL_EVENTS, 'events')).toEqual([])
  })

  it('reserves popups for roughly 10-30 percent of the 100-event catalog', () => {
    const popupCount = ALL_EVENTS.filter((event) => event.presentation === 'popup').length

    expect(popupCount).toBeGreaterThanOrEqual(10)
    expect(popupCount).toBeLessThanOrEqual(30)
  })
})
