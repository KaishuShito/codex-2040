import { describe, expect, it } from 'vitest'
import { getEventSourceUrl } from './sourceLinks'

describe('event source links', () => {
  it('deep-links AI 2027 events to the closest dated scenario section', () => {
    expect(getEventSourceUrl('AI 2027', '2026-01-01'))
      .toBe('https://ai-2027.com/race#early-2026-coding-automation')
    expect(getEventSourceUrl('AI 2027', '2027-09-30'))
      .toBe('https://ai-2027.com/race#september-2027-agent-4-the-superhuman-ai-researcher')
    expect(getEventSourceUrl('AI 2027', '2028-08-01'))
      .toBe('https://ai-2027.com/race#race-2028-12-31')
  })

  it('deep-links AI 2040 events to the selected Plan A branch and year', () => {
    expect(getEventSourceUrl('AI 2040', '2029-01-15'))
      .toBe('https://ai-2040.com/?choices=plan-a-root#plan-a--2029-choose-a-path')
    expect(getEventSourceUrl('AI 2040', '2035-01-15'))
      .toBe('https://ai-2040.com/?choices=plan-a-root#plan-a--2035-pause-at-top-expert-ai')
    expect(getEventSourceUrl('AI 2040', '2040-01-01'))
      .toBe('https://ai-2040.com/?choices=plan-a-root#plan-a--2040-passing-the-torch-to-ais')
  })

  it('does not present game-generated provenance as a paper link', () => {
    expect(getEventSourceUrl('Your Timeline', '2028-01-01')).toBeUndefined()
    expect(getEventSourceUrl('Live GM', '2028-01-01')).toBeUndefined()
  })

  it('falls back to the canonical scenario page when no exact section is known', () => {
    expect(getEventSourceUrl('AI 2027', 'not-a-date')).toBe('https://ai-2027.com/race')
    expect(getEventSourceUrl('AI 2040', '2027-01-01')).toBe('https://ai-2040.com/?choices=plan-a-root')
  })
})
