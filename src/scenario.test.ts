import { describe, expect, it } from 'vitest'
import {
  ENDINGS,
  getDecisionMilestones,
  getDueMilestones,
  getSourceLabelMetadata,
  listSourceLabelMetadata,
  MILESTONE_DECK,
  SOURCE_LABELS,
} from './scenario'

describe('canonical scenario data', () => {
  it('orders a deterministic milestone deck from 2026 through 2040', () => {
    const dates = MILESTONE_DECK.map((milestone) => milestone.date)

    expect(dates).toEqual([...dates].sort())
    expect(dates.at(0)?.startsWith('2026-')).toBe(true)
    expect(dates.at(-1)?.startsWith('2040-')).toBe(true)
  })

  it('uses unique IDs for milestones, decisions, options, and endings', () => {
    const ids = [
      ...MILESTONE_DECK.map((milestone) => milestone.id),
      ...getDecisionMilestones().flatMap((milestone) => [
        milestone.decision!.id,
        ...milestone.decision!.options.map((option) => option.id),
      ]),
      ...ENDINGS.map((ending) => ending.id),
    ]

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes required choices in 2029 and 2035 that alter routes and endings', () => {
    const decisions = getDecisionMilestones()
    const choice2029 = decisions.find((milestone) => milestone.date.startsWith('2029-'))
    const choice2035 = decisions.find((milestone) => milestone.date.startsWith('2035-'))

    expect(choice2029?.decision?.required).toBe(true)
    expect(choice2029?.decision?.options.map((option) => option.id)).toEqual(expect.arrayContaining([
      'race-ahead',
      'temporary-slowdown',
      'verified-slowdown',
    ]))
    expect(choice2035?.decision?.required).toBe(true)
    expect(choice2035?.decision?.options.map((option) => option.id)).toContain('hold-the-line')

    for (const milestone of [choice2029, choice2035]) {
      expect(milestone?.decision?.options.every((option) =>
        option.setsFlags.length > 0 && option.endingAffinity.length > 0)).toBe(true)
      expect(new Set(milestone?.decision?.options.map((option) => option.route)).size).toBeGreaterThan(1)
    }
  })

  it('uses only the four canonical source labels and exposes their metadata', () => {
    expect(SOURCE_LABELS).toEqual(['AI 2027', 'AI 2040', 'Your Timeline', 'Live GM'])
    expect(listSourceLabelMetadata().map((source) => source.label)).toEqual(SOURCE_LABELS)

    for (const milestone of MILESTONE_DECK) {
      expect(SOURCE_LABELS).toContain(milestone.source)
      expect(getSourceLabelMetadata(milestone.source).label).toBe(milestone.source)
    }
    for (const ending of ENDINGS) expect(SOURCE_LABELS).toContain(ending.source)
  })

  it('provides player-facing scenario choices and explanations in Japanese', () => {
    const decisions = getDecisionMilestones()

    expect(decisions.find((milestone) => milestone.date.startsWith('2029-'))?.decision?.prompt)
      .toBe('自己改善が実用化競争を加速させるなか、フロンティアラボはどう動く？')
    expect(decisions.find((milestone) => milestone.date.startsWith('2035-'))?.decision?.options.map((option) => option.label))
      .toEqual(['一線を守る', '再加速'])
    expect(MILESTONE_DECK.every((milestone) => /[ぁ-んァ-ヶ一-龯]/u.test(`${milestone.title}${milestone.summary}${milestone.whyThisMatters}`))).toBe(true)
    expect(ENDINGS.every((ending) => /[ぁ-んァ-ヶ一-龯]/u.test(`${ending.title}${ending.summary}${ending.whyThisMatters}${ending.closingLine}`))).toBe(true)
  })

  it('defines all required endings and gates the beneficial S rank behind both major choices', () => {
    const endingIds = ENDINGS.map((ending) => ending.id)

    expect(endingIds).toEqual(expect.arrayContaining([
      'regulatory-freeze',
      'safety-incident',
      'misalignment',
      'pyrrhic-monopoly',
      'beneficial-abundance',
    ]))

    const beneficial = ENDINGS.find((ending) => ending.id === 'beneficial-abundance')
    expect(beneficial?.rank).toBe('S')
    expect(beneficial?.requiresFlags).toEqual(expect.arrayContaining([
      'chose-verified-slowdown-2029',
      'chose-deliberate-pause-2035',
    ]))
  })

  it('retrieves unconsumed milestones due in a date window', () => {
    const due = getDueMilestones({
      after: '2027-01-01',
      through: '2029-12-31',
      excludeIds: ['2027-race-pressure'],
    })

    expect(due.map((milestone) => milestone.id)).toEqual([
      '2027-expert-coding-agents',
      '2028-agent-economy',
      '2029-choose-a-path',
    ])
  })
})
