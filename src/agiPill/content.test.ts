import { describe, expect, it } from 'vitest'
import {
  AGI_PILL_SOURCES,
  AGI_PILL_SOURCE_REF_REGISTRY,
  CATALOG_SOURCE_TIER_LABELS,
  CAUSE_LABELS,
  COPY,
  ERA_LABELS,
  HEADROOM_LABELS,
  OUTCOME_LABELS,
  PHASE_LABELS,
  RIVAL_LABELS,
  RIVAL_POSTURE_LABELS,
  SOURCE_TIER_LABEL_KEYS,
  classifyResourceHeadroom,
  getAgiPillSource,
  getAgiPillSourcesForTopic,
  getPillCopy,
  type SourceTier,
} from './content'
import { AGI_PILL_EVENTS } from './events'
import { AGI_PILL_UPGRADES } from './upgrades'

describe('AGI Pill localized content', () => {
  it('keeps exact English/Japanese key parity', () => {
    expect(Object.keys(COPY.en).sort()).toEqual(Object.keys(COPY.ja).sort())
    expect(Object.values(COPY.en).every((value) => value.trim().length > 0)).toBe(true)
    expect(Object.values(COPY.ja).every((value) => value.trim().length > 0)).toBe(true)
  })

  it('offers a typed lookup API for UI integration', () => {
    expect(getPillCopy('en', 'mode.pill.name')).toBe('AGI Pill')
    expect(getPillCopy('ja', 'source.open')).toBe('出典と仮定')
  })

  it('does not state scenario dates or named risk estimates as settled predictions', () => {
    const allCopy = Object.values(COPY).flatMap(Object.values).join('\n')
    const allNotes = AGI_PILL_SOURCES.flatMap((source) => Object.values(source.note)).join('\n')

    expect(`${allCopy}\n${allNotes}`).not.toMatch(/will definitely|is certain to|guaranteed to|必ず起こ|確実に起こ|断定された予言/i)
    expect(COPY.en['mode.pill.warning']).toContain('not a forecast')
    expect(COPY.ja['mode.pill.warning']).toContain('予言ではなくシナリオ')
  })
})

describe('AGI Pill citation registry', () => {
  it('labels every evidence tier in both locales', () => {
    const tiers: SourceTier[] = ['primary', 'research-synthesis', 'reference-article', 'game-inference']

    expect(Object.keys(SOURCE_TIER_LABEL_KEYS).sort()).toEqual(tiers.sort())
    for (const key of Object.values(SOURCE_TIER_LABEL_KEYS)) {
      expect(getPillCopy('en', key)).toBeTruthy()
      expect(getPillCopy('ja', key)).toBeTruthy()
    }
  })

  it('resolves every sourceRef used by the event and upgrade catalogs', () => {
    const refs = new Set([
      ...AGI_PILL_EVENTS.flatMap((event) => event.sourceRefs),
      ...AGI_PILL_UPGRADES.flatMap((upgrade) => upgrade.sourceRefs),
    ])

    for (const ref of refs) {
      expect(AGI_PILL_SOURCE_REF_REGISTRY[ref], `normalized ref: ${ref}`).toBeTruthy()
      expect(getAgiPillSource(ref), `resolved source: ${ref}`).toBeTruthy()
    }
  })

  it('keeps URLs HTTPS-shaped and withholds fake citations from article/inference entries', () => {
    for (const source of AGI_PILL_SOURCES) {
      const { url } = source
      if (url) {
        expect(() => new URL(url)).not.toThrow()
        expect(new URL(url).protocol).toBe('https:')
      }

      if (source.tier === 'reference-article' || source.tier === 'game-inference') {
        expect(source.url).toBeUndefined()
      }
    }
  })

  it('distinguishes primary work, synthesis, the reference article, and game inference', () => {
    expect(AGI_PILL_SOURCES.some((source) => source.tier === 'primary')).toBe(true)
    expect(AGI_PILL_SOURCES.some((source) => source.tier === 'research-synthesis')).toBe(true)
    expect(getAgiPillSource('agi-pill-japanese-reference')?.tier).toBe('reference-article')
    expect(getAgiPillSource('agi-pill-system-model')?.tier).toBe('game-inference')
  })

  it('covers every core topic and supports topic-filtered integration', () => {
    const requiredTopics = [
      'intelligence-explosion',
      'industrial-explosion',
      'recursive-production',
      'superexponential-growth',
      'takeoff-speed',
      'physical-limits',
      'space-expansion',
      'risk-and-governance',
    ] as const

    for (const topic of requiredTopics) {
      const sources = getAgiPillSourcesForTopic(topic)
      expect(sources.length).toBeGreaterThan(0)
      expect(sources.some((source) => source.tier !== 'game-inference')).toBe(true)
    }
  })
})

describe('AGI Pill system labels', () => {
  const expectLocalized = (labels: Readonly<Record<string, { en: string; ja: string }>>) => {
    for (const label of Object.values(labels)) {
      expect(label.en.trim()).not.toBe('')
      expect(label.ja.trim()).not.toBe('')
    }
  }

  it('covers all engine phases, outcomes, causes, rivals, postures, and source tiers', () => {
    expect(Object.keys(PHASE_LABELS).sort()).toEqual(['post-dyson', 'year-1-3', 'year-3-5', 'year-5-10'])
    expect(Object.keys(ERA_LABELS).sort()).toEqual(Object.keys(PHASE_LABELS).sort())
    expect(Object.keys(OUTCOME_LABELS).sort()).toEqual(['active', 'industrial-accident', 'misalignment', 'pluralistic-expansion', 'rival-takeover', 'stagnation'])
    expect(Object.keys(CAUSE_LABELS)).toHaveLength(10)
    expect(Object.keys(RIVAL_LABELS).sort()).toEqual(['frontier-lab', 'open-collective', 'state-coalition'])
    expect(Object.keys(RIVAL_POSTURE_LABELS).sort()).toEqual(['competitive', 'cooperative', 'guarded'])
    expect(Object.keys(CATALOG_SOURCE_TIER_LABELS).sort()).toEqual(['game-inference', 'primary', 'reference-article', 'research-synthesis'])

    ;[PHASE_LABELS, ERA_LABELS, OUTCOME_LABELS, CAUSE_LABELS, RIVAL_LABELS, RIVAL_POSTURE_LABELS, CATALOG_SOURCE_TIER_LABELS]
      .forEach(expectLocalized)
  })

  it('classifies resource headroom at stable UI boundaries', () => {
    expect(classifyResourceHeadroom(0)).toBe('critical')
    expect(classifyResourceHeadroom(0.12)).toBe('tight')
    expect(classifyResourceHeadroom(0.3)).toBe('workable')
    expect(classifyResourceHeadroom(0.55)).toBe('abundant')
    expectLocalized(HEADROOM_LABELS)
  })
})
