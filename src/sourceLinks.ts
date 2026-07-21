import type { SourceLabel } from './scenario'

const AI_2027_RACE_URL = 'https://ai-2027.com/race'
const AI_2040_PLAN_A_URL = 'https://ai-2040.com/?choices=plan-a-root'

const AI_2027_SECTION_BY_PERIOD = [
  { through: '2025-04', anchor: 'section-narrative-0' },
  { through: '2025-08', anchor: 'mid-2025-stumbling-agents' },
  { through: '2025-12', anchor: 'late-2025-the-worlds-most-expensive-ai' },
  { through: '2026-04', anchor: 'early-2026-coding-automation' },
  { through: '2026-08', anchor: 'mid-2026-china-wakes-up' },
  { through: '2026-12', anchor: 'late-2026-ai-takes-some-jobs' },
  { through: '2027-01', anchor: 'january-2027-agent-2-never-finishes-learning' },
  { through: '2027-02', anchor: 'february-2027-china-steals-agent-2' },
  { through: '2027-03', anchor: 'march-2027-algorithmic-breakthroughs' },
  { through: '2027-04', anchor: 'april-2027-alignment-for-agent-3' },
  { through: '2027-05', anchor: 'may-2027-national-security' },
  { through: '2027-06', anchor: 'june-2027-self-improving-ai' },
  { through: '2027-07', anchor: 'july-2027-the-cheap-remote-worker' },
  { through: '2027-08', anchor: 'august-2027-the-geopolitics-of-superintelligence' },
  { through: '2027-09', anchor: 'september-2027-agent-4-the-superhuman-ai-researcher' },
  { through: '2027-10', anchor: 'october-2027-government-oversight' },
  { through: '2027-11', anchor: 'november-2027-superhuman-politicking' },
  { through: '2027-12', anchor: 'december-2027-the-agent-5-collective' },
  { through: '2028-06', anchor: 'race-2028-06-30' },
  { through: '2028-12', anchor: 'race-2028-12-31' },
] as const

const AI_2040_PLAN_A_SECTION_BY_YEAR: Readonly<Record<number, string>> = {
  2029: 'plan-a--2029-choose-a-path',
  2030: 'plan-a--2030-plan-a-is-established',
  2031: 'plan-a--2031-safety-cases',
  2032: 'plan-a--2032-controlled-explosive-growth',
  2033: 'plan-a--2033-the-citizen-s-dividend',
  2034: 'plan-a--2034-mutually-assured-compute-destruction',
  2035: 'plan-a--2035-pause-at-top-expert-ai',
  2036: 'plan-a--2036-life-after-work',
  2037: 'plan-a--2037-the-apocalyptic-arrival-of-truth-on-earth',
  2038: 'plan-a--2038-ai-alignment-is-now-a-science',
  2039: 'plan-a--2039-beginning-to-trust-ais',
  2040: 'plan-a--2040-passing-the-torch-to-ais',
}

const validMonth = (date: string): string | null => /^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(date)
  ? date.slice(0, 7)
  : null

/**
 * Returns an authoritative reference-scenario URL for an event-history badge.
 * Player-created and generated events deliberately have no outbound citation.
 */
export const getEventSourceUrl = (source: SourceLabel, date: string): string | undefined => {
  const month = validMonth(date)

  if (source === 'AI 2027') {
    if (!month) return AI_2027_RACE_URL
    const section = AI_2027_SECTION_BY_PERIOD.find(({ through }) => month <= through)
    return section ? `${AI_2027_RACE_URL}#${section.anchor}` : AI_2027_RACE_URL
  }

  if (source === 'AI 2040') {
    const year = month ? Number(month.slice(0, 4)) : Number.NaN
    const section = AI_2040_PLAN_A_SECTION_BY_YEAR[year]
    return section ? `${AI_2040_PLAN_A_URL}#${section}` : AI_2040_PLAN_A_URL
  }

  return undefined
}

