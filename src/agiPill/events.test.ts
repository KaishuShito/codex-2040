import { describe, expect, it } from 'vitest'
import { AGI_PILL_SOURCES } from './content'
import {
  AGI_PILL_EVENTS,
  AGI_PILL_EVENT_TAGS,
  AGI_PILL_METRICS,
  AGI_PILL_PHASES,
  isAgiPillEventEligible,
  toAgiPillEffectDescriptors,
  validateAgiPillEvents,
  type AgiPillEffects,
  type AgiPillEventDefinition,
  type AgiPillEventEligibilityState,
  type AgiPillLocalizedText,
} from './events'

const expectLocalized = (text: AgiPillLocalizedText) => {
  expect(text.en.trim().length).toBeGreaterThan(0)
  expect(text.ja.trim().length).toBeGreaterThan(0)
}

const eligibilityState = (overrides: Partial<AgiPillEventEligibilityState> = {}): AgiPillEventEligibilityState => ({
  day: 500,
  phase: 'year-1-3',
  intelligence: 30,
  compute: 20,
  energy: 20,
  robots: 30,
  resources: 60,
  safety: 20,
  governance: 20,
  friction: 20,
  risk: 20,
  rivalPressure: 20,
  orbitalIndustry: 0,
  dysonProgress: 0,
  postDysonExpansion: 0,
  flags: [],
  ...overrides,
})

describe('AGI Pill event catalog', () => {
  it('is structurally complete, bilingual, and globally unique', () => {
    expect(validateAgiPillEvents(AGI_PILL_EVENTS)).toEqual([])
    expect(new Set(AGI_PILL_EVENTS.map((event) => event.id)).size).toBe(AGI_PILL_EVENTS.length)

    for (const event of AGI_PILL_EVENTS) {
      expectLocalized(event.title)
      expectLocalized(event.summary)
      expectLocalized(event.causalChain)
      expect(AGI_PILL_PHASES).toContain(event.phase)
      expect(event.causes.length).toBeGreaterThan(0)
      expect(event.options.length).toBeGreaterThanOrEqual(2)
      expect(event.sourceTier).toMatch(/^(primary|research-synthesis|reference-article|game-inference)$/)
      expect(event.sourceRefs.length).toBeGreaterThan(0)

      for (const cause of event.causes) {
        expectLocalized(cause.text)
        expect(cause.requires.length).toBeGreaterThan(0)
        for (const condition of cause.requires) expect(AGI_PILL_METRICS).toContain(condition.metric)
      }

      for (const option of event.options) {
        expectLocalized(option.label)
        expectLocalized(option.description)
        expect(option.setsFlags.length).toBeGreaterThan(0)
        expect(Object.keys(option.effects).length).toBeGreaterThan(0)
        expect(option.recovery.windowYears).toBeGreaterThan(0)
        expectLocalized(option.recovery.trigger)
        expectLocalized(option.recovery.action)
        expect(Object.keys(option.recovery.effects).length).toBeGreaterThan(0)
        expect(toAgiPillEffectDescriptors(option.effects)).toEqual(
          Object.entries(option.effects).map(([metric, value]) => ({ metric, operation: 'add', value })),
        )
      }
    }
  })

  it('uses only source IDs present in the player-facing source registry', () => {
    const sourceIds = new Set(AGI_PILL_SOURCES.map((source) => source.id))
    for (const event of AGI_PILL_EVENTS) {
      for (const sourceRef of event.sourceRefs) expect(sourceIds, `${event.id}/${sourceRef}`).toContain(sourceRef)
    }
  })

  it('deterministically gates eligibility by phase, earliest day, and cause requirements', () => {
    const event = AGI_PILL_EVENTS.find(({ id }) => id === 'pill-researcher-copy-flywheel')
    expect(event).toBeDefined()
    if (event === undefined) return

    const eligible = eligibilityState({ intelligence: 18, compute: 14 })
    expect(isAgiPillEventEligible(event, eligible)).toBe(true)
    expect(isAgiPillEventEligible(event, { ...eligible, phase: 'year-3-5' })).toBe(true)
    expect(isAgiPillEventEligible(event, { ...eligible, compute: 13.99 })).toBe(false)
    expect(isAgiPillEventEligible(event, eligible, { earliestDay: 501 })).toBe(false)
    expect(isAgiPillEventEligible(event, eligible, { earliestDay: 500 })).toBe(true)
    expect(isAgiPillEventEligible(event, eligible)).toBe(isAgiPillEventEligible(event, eligible))

    const laterEvent = AGI_PILL_EVENTS.find(({ phase }) => phase === 'year-3-5')
    expect(laterEvent).toBeDefined()
    if (laterEvent) expect(isAgiPillEventEligible(laterEvent, eligible)).toBe(false)
  })

  it('allows any complete cause to unlock while requiring every predicate within that cause', () => {
    const base = AGI_PILL_EVENTS[0]
    const event: AgiPillEventDefinition = {
      ...base,
      causes: [
        {
          text: base.causes[0].text,
          requires: [
            { metric: 'compute', op: 'gt', value: 50 },
            { metric: 'energy', op: 'lt', value: 5 },
          ],
        },
        {
          text: base.causes[0].text,
          requires: [
            { metric: 'safety', op: 'eq', value: 20 },
            { metric: 'governance', op: 'lte', value: 20 },
          ],
        },
      ],
    }

    const state = eligibilityState()
    expect(isAgiPillEventEligible(event, state)).toBe(true)
    expect(isAgiPillEventEligible(event, { ...state, safety: 19 })).toBe(false)
  })

  it('keeps normal early safe choices above canonical black-start compute and energy floors', () => {
    const safeOptionIds = new Set([
      'copy-with-audit-cells',
      'constitutional-compute-escrow',
      'adaptive-tripwire-pause',
      'open-incident-and-redesign',
    ])
    const canonicalInitial = { compute: 1.2, energy: 1 }
    const catalog: readonly AgiPillEventDefinition[] = AGI_PILL_EVENTS
    const earlySafeOptions = catalog
      .filter((event) => event.phase === 'year-1-3')
      .flatMap((event) => event.options)
      .filter((option) => safeOptionIds.has(option.id))

    expect(earlySafeOptions).toHaveLength(safeOptionIds.size)
    for (const option of earlySafeOptions) {
      expect(canonicalInitial.compute + (option.effects.compute ?? 0), option.id).toBeGreaterThan(0)
      expect(canonicalInitial.energy + (option.effects.energy ?? 0), option.id).toBeGreaterThan(0)
    }
  })

  it('covers every time horizon with at least four decision events', () => {
    for (const phase of AGI_PILL_PHASES) {
      expect(AGI_PILL_EVENTS.filter((event) => event.phase === phase).length, phase).toBeGreaterThanOrEqual(4)
    }
  })

  it('covers every critical branch in the playable event deck', () => {
    const coveredTags = new Set(AGI_PILL_EVENTS.flatMap((event) => event.tags))
    for (const tag of AGI_PILL_EVENT_TAGS) expect(coveredTags, tag).toContain(tag)
  })

  it('keeps all immediate and recovery effects finite and on known metrics', () => {
    for (const event of AGI_PILL_EVENTS) {
      for (const option of event.options) {
        for (const effects of [option.effects, option.recovery.effects]) {
          for (const [metric, value] of Object.entries(effects)) {
            expect(AGI_PILL_METRICS, `${event.id}/${option.id}/${metric}`).toContain(metric)
            expect(Number.isFinite(value), `${event.id}/${option.id}/${metric}`).toBe(true)
            expect(Math.abs(value), `${event.id}/${option.id}/${metric}`).toBeLessThanOrEqual(30)
          }
        }
      }
    }
  })

  it('gives every dangerous branch a recovery that repairs at least one control metric', () => {
    for (const event of AGI_PILL_EVENTS) {
      for (const option of event.options) {
        const effects: AgiPillEffects = option.effects
        const recoveryEffects: AgiPillEffects = option.recovery.effects
        const harmsControl = (effects.safety ?? 0) < 0
          || (effects.governance ?? 0) < 0
          || (effects.risk ?? 0) > 0
        if (!harmsControl) continue

        const repairsControl = (recoveryEffects.safety ?? 0) > 0
          || (recoveryEffects.governance ?? 0) > 0
          || (recoveryEffects.risk ?? 0) < 0
        expect(repairsControl, `${event.id}/${option.id}`).toBe(true)
      }
    }
  })
})
