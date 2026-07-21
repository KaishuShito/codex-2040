import { describe, expect, it } from 'vitest'
import {
  AGI_PILL_SOURCES,
  COPY,
  SOURCE_TIER_LABEL_KEYS,
  getAgiPillSource,
  getAgiPillSourcesForTopic,
  getPillCopy,
  type SourceTier,
} from './content'

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
