import { describe, expect, it } from 'vitest'
import {
  buildWorldlineShareText,
  buildXIntentHref,
  endingDistributionRows,
  formatActivePlayTime,
  marketShareOutcomeRows,
  resolvePublicShareUrl,
} from './EndingOverlay'

describe('anonymous worldline receipt helpers', () => {
  it('formats active play time without inventing a value for local-only results', () => {
    expect(formatActivePlayTime(null)).toBe('—')
    expect(formatActivePlayTime(65)).toBe('1:05')
    expect(formatActivePlayTime(3_661)).toBe('1:01:01')
  })

  it('keeps local origins out of public shares while accepting the deployed origin', () => {
    expect(resolvePublicShareUrl('http://localhost:5173')).toBeNull()
    expect(resolvePublicShareUrl('http://127.0.0.1:5173', 'https://codex-2040.example')).toBe('https://codex-2040.example')
    expect(resolvePublicShareUrl('https://codex-2040.sites.openai.com/some/path')).toBe('https://codex-2040.sites.openai.com')
    expect(resolvePublicShareUrl('javascript:alert(1)', 'not a url')).toBeNull()
  })

  it('builds a concise bilingual X result and adds a URL only when one is public', () => {
    const text = buildWorldlineShareText({
      rank: 'S',
      scoreOutOf100: 93.4,
      ending: 'beneficial-abundance',
      choice2029: 'verified-slowdown',
      choice2035: 'hold-the-line',
    })

    expect(text).toContain('Beneficial Abundance / 人類に益する豊かさ')
    expect(text).toContain('Verified slowdown / 国際検証つき減速')
    expect(text).toContain('93/100')

    const localIntent = new URL(buildXIntentHref(text, null))
    expect(localIntent.hostname).toBe('x.com')
    expect(localIntent.searchParams.get('text')).toBe(text)

    const publicIntent = new URL(buildXIntentHref(text, 'https://codex-2040.sites.openai.com'))
    expect(publicIntent.searchParams.get('text')).toBe(`${text}\nhttps://codex-2040.sites.openai.com`)
  })

  it('normalizes an aggregate ending distribution regardless of count scale', () => {
    const rows = endingDistributionRows({
      'managed-transition': 3,
      'beneficial-abundance': 1,
      'race-future': 0,
    })

    expect(rows.map((row) => row.id)).toEqual(['managed-transition', 'beneficial-abundance'])
    expect(rows[0]?.percent).toBe(75)
    expect(rows[1]?.percent).toBe(25)
    expect(endingDistributionRows(null)).toEqual([])
  })

  it('ranks final competitors and reports movement from the opening market', () => {
    const rows = marketShareOutcomeRows([
      { id: 'codex', name: 'CODEX', share: .28, baseline: .34 },
      { id: 'anthro', name: 'ANTHRO', share: .42, baseline: .22 },
      { id: 'goo', name: 'GOO', share: .3, baseline: .24 },
    ])

    expect(rows.map((row) => row.name)).toEqual(['ANTHRO', 'GOO', 'CODEX'])
    expect(rows[0]?.delta).toBeCloseTo(.2)
    expect(rows[2]?.delta).toBeCloseTo(-.06)
  })
})
