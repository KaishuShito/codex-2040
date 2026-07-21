import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ModeApp from './ModeApp'
import AgiPillGame, { decodeAgiPillState, shouldPauseForAgiPillWarning } from './AgiPillGame'
import { createAgiPillState } from './agiPill/engine'

describe('mode routing', () => {
  it('offers explicit Standard and AGI Pill choices to a fresh session', () => {
    const html = renderToStaticMarkup(<ModeApp />)
    expect(html).toContain('シミュレーションモードを選択')
    expect(html).toContain('Standard')
    expect(html).toContain('AGIピル')
    expect(html).toContain('既存セーブ・D1互換')
    expect(html).toContain('Dysonは序章、その先へ')
  })

  it('renders the bilingual Pill disclosure before starting', () => {
    const html = renderToStaticMarkup(<AgiPillGame locale="en" onLocaleChange={() => undefined} onChooseMode={() => undefined} />)
    expect(html).toContain('TAKE THE AGI PILL?')
    expect(html).toContain('scenario, not a forecast')
    expect(html).toContain('Begin simulation')
  })

  it('rejects malformed Pill saves and hydrates a valid deterministic state', () => {
    expect(decodeAgiPillState({ mode: 'agi-pill' })).toBeNull()
    const state = createAgiPillState({ seed: 42 })
    expect(decodeAgiPillState(state)?.runSeed).toBe(42)
    expect(decodeAgiPillState({ ...state, policy: 'evil' })).toBeNull()
    expect(decodeAgiPillState({ ...state, warning: { kind: 'unknown', startedDay: 0, countdownDays: 1, recoveryPolicies: [] } })).toBeNull()
    expect(decodeAgiPillState({ ...state, warning: { kind: 'resource-lock', startedDay: 'never', countdownDays: Number.NaN, recoveryPolicies: ['resource-recovery'] } })).toBeNull()
  })

  it('treats every Pill warning as a human decision boundary', () => {
    expect(shouldPauseForAgiPillWarning(null)).toBe(false)
    expect(shouldPauseForAgiPillWarning({ kind: 'misalignment', startedDay: 10, countdownDays: 30, recoveryPolicies: ['safety-first'] })).toBe(true)
  })
})
