import { describe, expect, it } from 'vitest'
import { formatExtinctionRiskRate, INITIAL_MARKET_BASELINE, isCrisisHeadline, shouldAutoPauseForNews } from './App'

describe('critical news routing', () => {
  it.each([
    'EXTINCTION RISK 50% // close the safety gap',
    'EXTINCTION RISK 80% // control loss is imminent',
  ])('auto-pauses and uses crisis presentation for %s', (headline) => {
    expect(shouldAutoPauseForNews({ headline, tone: 'warn' })).toBe(true)
    expect(isCrisisHeadline(headline)).toBe(true)
  })

  it('does not pause for an ordinary warning ticker', () => {
    const headline = 'ANTHRO expands its regional developer program'
    expect(shouldAutoPauseForNews({ headline, tone: 'warn' })).toBe(false)
    expect(isCrisisHeadline(headline)).toBe(false)
  })
})

describe('market-share baseline', () => {
  it('uses the same normalized opening market as the playable state', () => {
    const total = INITIAL_MARKET_BASELINE.codex
      + INITIAL_MARKET_BASELINE.rivals.reduce((sum, share) => sum + share, 0)
    expect(total).toBeCloseTo(1, 8)
  })
})

describe('extinction-risk rate', () => {
  it('formats dangerous-day movement as percentage points per day', () => {
    expect(formatExtinctionRiskRate(3, 120)).toBe('+2.5pt/日')
    expect(formatExtinctionRiskRate(-2, 120)).toBe('-1.7pt/日')
  })
})
