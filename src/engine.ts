import { GM_CONSTANTS } from './gm'
import type { SourceLabel } from './scenario'

export type ScenarioSource = SourceLabel
export type RegionId = 'na' | 'latam' | 'eu' | 'africa' | 'mena' | 'india' | 'eastAsia' | 'oceania'
export type Speed = 1 | 2 | 5 | 8

export type Region = {
  id: RegionId
  name: string
  population: number
  users: number
  codexShare: number
  introduced: boolean
  regulation: number
  mobileAffinity: number
  fit: number
}

export type NewsItem = {
  id: number
  date: string
  tone: 'good' | 'warn' | 'neutral'
  headline: string
  /** Canonical provenance; the UI must render this field, never infer it from copy. */
  source: ScenarioSource
}
export type Choice2029 = 'race' | 'slowdown' | 'verified-slowdown'
export type Choice2035 = 'hold-the-line' | 'accelerate'
export type IncidentKind = 'safety-incident' | 'regulatory-freeze' | 'misalignment'
export type EndingId =
  | 'beneficial-abundance'
  | 'managed-transition'
  | 'fragile-abundance'
  | 'race-future'
  | 'regulatory-freeze'
  | 'safety-incident'
  | 'misalignment'
  | 'pyrrhic-monopoly'

export type ActiveEffect = {
  id: string
  region: RegionId | 'global'
  growthRateDelta: number
  trustDelta: number
  expiresDay: number
  source: ScenarioSource
}

export type GameState = {
  day: number
  regions: Region[]
  compute: number
  capability: number
  safety: number
  governance: number
  efficiency: number
  trust: number
  rivalShares: [number, number, number]
  rivalCapability: [number, number, number]
  speed: Speed
  /** Real-time seconds, deliberately independent from simulated days. */
  resetBoostSeconds: number
  resetCooldownSeconds: number
  ecosystemCooldownSeconds: number
  /** Compatibility aliases for the initial App. They contain seconds. */
  resetDays: number
  resetCooldownDays: number
  ecosystemCooldownDays: number
  brand: number
  news: NewsItem[]
  nextNewsId: number
  /** Current uint32 state for mulberry32. */
  seed: number
  flags: string[]
  activeEffects: ActiveEffect[]
  safetyGapDays: number
  safeRecoveryDays: number
  incidentCounts: Record<IncidentKind, number>
  regulatoryFreeze: boolean
  brownout: boolean
  choice2029: Choice2029 | null
  choice2035: Choice2035 | null
  policyGrowthMultiplier: number
  ending: EndingId | null
  terminal: boolean
  demoMode: boolean
  features: string[]
}

export const SPEEDS = [1, 2, 5, 8] as const
export const START_DATE = Date.UTC(2026, 0, 1)
export const END_DAY = Math.round((Date.UTC(2040, 0, 1) - START_DATE) / 86_400_000)

export const constants = Object.freeze({
  gamma0: 0.00032,
  capabilityMomentum: 0.15,
  capabilityAppeal: 0.20,
  shareRelaxation: 0.018,
  trustTau: 20,
  diversityWeight: 0.5,
  gapWeight: 0.6,
  monopolyScale: 1,
  revenue: 0.06,
  gapThreshold: 3,
  resetCooldownSeconds: 45,
  resetDurationSeconds: 8,
  resetMultiplier: 4.2,
  // Runtime references to gm.ts's single contract table: no copied bounds.
  gm: Object.freeze({
    usersDeltaPct: GM_CONSTANTS.effectBounds.users_delta_pct,
    shareDelta: GM_CONSTANTS.effectBounds.share_delta,
    growthRateDelta: GM_CONSTANTS.effectBounds.growth_rate_delta,
    trustDelta: GM_CONSTANTS.effectBounds.trust_delta,
    ttlDays: GM_CONSTANTS.ttlDays,
    maxEventsPerCycle: GM_CONSTANTS.maxEventsPerCycle,
    maxTotalUsersDeltaPctPerCycle: GM_CONSTANTS.maxTotalUsersDeltaPctPerCycle,
  }),
})

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const total = (regions: Region[], pick: (r: Region) => number) => regions.reduce((sum, region) => sum + pick(region), 0)
const hasFlag = (state: GameState, flag: string) => state.flags.includes(flag)
const addFlag = (flags: string[], flag: string) => flags.includes(flag) ? flags : [...flags, flag]

export const dateLabel = (day: number) => new Date(START_DATE + Math.max(0, Math.floor(day)) * 86_400_000)
  .toISOString().slice(0, 10)

export const metrics = (state: GameState) => {
  const adoption = total(state.regions, (r) => r.users)
  const population = total(state.regions, (r) => r.population)
  const codexUsers = total(state.regions, (r) => r.users * r.codexShare)
  const codexShare = adoption > 0 ? codexUsers / adoption : 0
  const rivals = normalizeRivals(state.rivalShares, codexShare)
  const hhi = codexShare ** 2 + rivals.reduce((sum, share) => sum + share ** 2, 0)
  return {
    adoption,
    population,
    codexUsers,
    worldAdoption: population > 0 ? adoption / population : 0,
    codexShare,
    hhi,
    safetyGap: Math.max(0, state.capability - state.safety),
    governanceGap: Math.max(0, state.capability - state.governance),
    effectiveCapability: effectiveCapability(state),
  }
}

const baseRegions: Region[] = [
  { id: 'na', name: 'North America', population: 620, users: 17, codexShare: .36, introduced: true, regulation: .15, mobileAffinity: .62, fit: 1 },
  { id: 'latam', name: 'Latin America', population: 660, users: 3, codexShare: .22, introduced: true, regulation: .08, mobileAffinity: .91, fit: 1 },
  { id: 'eu', name: 'Europe', population: 750, users: 9, codexShare: .31, introduced: true, regulation: .32, mobileAffinity: .65, fit: 1 },
  { id: 'africa', name: 'Africa', population: 1500, users: 0, codexShare: 0, introduced: false, regulation: .06, mobileAffinity: .96, fit: 1 },
  { id: 'mena', name: 'Middle East', population: 510, users: 0, codexShare: 0, introduced: false, regulation: .18, mobileAffinity: .86, fit: 1 },
  { id: 'india', name: 'India', population: 1460, users: 5, codexShare: .24, introduced: true, regulation: .1, mobileAffinity: .94, fit: 1 },
  { id: 'eastAsia', name: 'East Asia', population: 1670, users: 12, codexShare: .19, introduced: true, regulation: .2, mobileAffinity: .88, fit: 1 },
  { id: 'oceania', name: 'Oceania', population: 46, users: 0, codexShare: 0, introduced: false, regulation: .13, mobileAffinity: .73, fit: 1 },
]

export const createInitialState = (options: { seed?: number; demoMode?: boolean } = {}): GameState => ({
  day: 0,
  regions: baseRegions.map((region) => ({ ...region })),
  compute: 940,
  capability: 2,
  safety: 2,
  governance: 2,
  efficiency: 1,
  trust: 72,
  rivalShares: [.22, .24, .17],
  rivalCapability: [2.1, 2.4, 1.9],
  speed: 5,
  resetBoostSeconds: 0,
  resetCooldownSeconds: 0,
  ecosystemCooldownSeconds: 0,
  resetDays: 0,
  resetCooldownDays: 0,
  ecosystemCooldownDays: 0,
  brand: 1,
  news: [
    { id: 2, date: '2026-01-01', tone: 'neutral', headline: 'CODEX EXPANSION PROTOCOL IS NOW LIVE', source: 'AI 2027' },
    { id: 1, date: '2025-12-18', tone: 'good', headline: 'DEVELOPER AGENTS CROSS A NEW RELIABILITY THRESHOLD', source: 'AI 2027' },
  ],
  nextNewsId: 3,
  seed: (options.seed ?? 2040) >>> 0,
  flags: [],
  activeEffects: [],
  safetyGapDays: 0,
  safeRecoveryDays: 0,
  incidentCounts: { 'safety-incident': 0, 'regulatory-freeze': 0, misalignment: 0 },
  regulatoryFreeze: false,
  brownout: false,
  choice2029: null,
  choice2035: null,
  policyGrowthMultiplier: 1,
  ending: null,
  terminal: false,
  demoMode: options.demoMode ?? false,
  features: [],
})

export const mulberry32 = (seed: number): { value: number; seed: number } => {
  const nextSeed = (seed + 0x6D2B79F5) >>> 0
  let t = nextSeed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296, seed: nextSeed }
}

const normalizeRivals = (shares: [number, number, number], codexShare: number): [number, number, number] => {
  const available = clamp(1 - codexShare)
  const nonnegative = shares.map((share) => Math.max(0, finite(share))) as [number, number, number]
  const sum = nonnegative.reduce((a, b) => a + b, 0)
  if (sum <= 0) return [available / 3, available / 3, available / 3]
  return nonnegative.map((share) => (share / sum) * available) as [number, number, number]
}

const syncRealtimeAliases = (state: GameState): GameState => ({
  ...state,
  resetDays: state.resetBoostSeconds,
  resetCooldownDays: state.resetCooldownSeconds,
  ecosystemCooldownDays: state.ecosystemCooldownSeconds,
})

/** Applies every invariant at an engine boundary, including rival share normalization. */
export const enforceInvariants = (state: GameState): GameState => {
  const regions = state.regions.map((region) => {
    const population = Math.max(Number.EPSILON, finite(region.population, 1))
    const introduced = Boolean(region.introduced)
    return {
      ...region,
      population,
      users: introduced ? clamp(finite(region.users), 0, population) : 0,
      codexShare: clamp(finite(region.codexShare)),
      regulation: clamp(finite(region.regulation)),
      mobileAffinity: clamp(finite(region.mobileAffinity)),
      fit: clamp(finite(region.fit, 1), .2, 4),
    }
  })
  const interim = { ...state, regions }
  const codexShare = metrics(interim).codexShare
  const next = {
    ...interim,
    day: Math.max(0, Math.floor(finite(state.day))),
    compute: Math.max(0, finite(state.compute)),
    capability: clamp(finite(state.capability), 0, 10),
    safety: clamp(finite(state.safety), 0, 10),
    governance: clamp(finite(state.governance), 0, 10),
    efficiency: clamp(finite(state.efficiency, 1), .5, 3),
    trust: clamp(finite(state.trust), 0, 100),
    rivalShares: normalizeRivals(state.rivalShares, codexShare),
    rivalCapability: state.rivalCapability.map((value) => clamp(finite(value), 0, 10)) as [number, number, number],
    resetBoostSeconds: Math.max(0, finite(state.resetBoostSeconds)),
    resetCooldownSeconds: Math.max(0, finite(state.resetCooldownSeconds)),
    ecosystemCooldownSeconds: Math.max(0, finite(state.ecosystemCooldownSeconds)),
    policyGrowthMultiplier: clamp(finite(state.policyGrowthMultiplier, 1), .25, 2),
    seed: state.seed >>> 0,
  }
  return syncRealtimeAliases(next)
}

export const effectiveCapability = (state: GameState) => state.brownout
  ? Math.min(state.capability, .8)
  : state.capability

const withNews = (state: GameState, headline: string, source: ScenarioSource, tone: NewsItem['tone'] = 'good', shownDate = dateLabel(state.day)): GameState => ({
  ...state,
  nextNewsId: state.nextNewsId + 1,
  news: [{ id: state.nextNewsId, date: shownDate, tone, headline: sanitizeOutput(headline), source }, ...state.news].slice(0, 12),
})

const dayFor = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - START_DATE) / 86_400_000)
const milestones = [
  { day: dayFor('2026-07-18'), flag: 'milestone:build-week-tokyo', headline: 'BUILD WEEK TOKYO LIGHTS UP THE NETWORK', source: 'Your Timeline' },
  { day: dayFor('2027-01-01'), flag: 'milestone:2027-agents', headline: 'AGENTS REACH TOP-DEVELOPER CAPABILITY', source: 'AI 2027' },
  { day: dayFor('2029-01-01'), flag: 'milestone:choose-2029', headline: 'CHOOSE A PATH: RACE OR VERIFIED SLOWDOWN', source: 'AI 2040' },
  { day: dayFor('2035-01-01'), flag: 'milestone:hold-2035', headline: 'HOLD THE LINE AT HUMAN-EXPERT CAPABILITY', source: 'AI 2040' },
] as const

const applyMilestones = (state: GameState): GameState => {
  let next = state
  for (const milestone of milestones) {
    if (next.day >= milestone.day && !hasFlag(next, milestone.flag)) {
      next = withNews({ ...next, speed: 1, flags: addFlag(next.flags, milestone.flag) }, milestone.headline, milestone.source, 'warn')
    }
  }
  return next
}

const applyIncident = (state: GameState, kind: IncidentKind): GameState => {
  const incidentCounts = { ...state.incidentCounts, [kind]: state.incidentCounts[kind] + 1 }
  if (kind === 'safety-incident') {
    const regions = state.regions.map((region) => ({ ...region, codexShare: region.codexShare * .82 }))
    return withNews(enforceInvariants({ ...state, regions, trust: state.trust - 22, incidentCounts, flags: addFlag(state.flags, kind) }), 'SAFETY INCIDENT // TRUST AND SHARE FALL SHARPLY', 'Your Timeline', 'warn')
  }
  if (kind === 'regulatory-freeze') {
    const regions = state.regions.map((region) => ({ ...region, regulation: clamp(region.regulation + .25) }))
    return withNews(enforceInvariants({ ...state, regions, regulatoryFreeze: true, safeRecoveryDays: 0, incidentCounts, flags: addFlag(state.flags, kind) }), 'REGULATORY FREEZE // ADOPTION GROWTH IS CAPPED', 'Your Timeline', 'warn')
  }
  return withNews({ ...state, terminal: true, ending: 'misalignment', incidentCounts, flags: addFlag(state.flags, kind) }, 'MISALIGNMENT // HUMAN CONTROL IS LOST', 'Your Timeline', 'warn')
}

const branchStep = (state: GameState): GameState => {
  const m = metrics(state)
  let next = state
  let safetyRoll = mulberry32(next.seed)
  next = { ...next, seed: safetyRoll.seed }
  const incidentChance = m.safetyGap >= constants.gapThreshold
    ? Math.min(.12, .006 * (m.safetyGap - constants.gapThreshold + 1))
    : 0
  if (safetyRoll.value < incidentChance) next = applyIncident(next, 'safety-incident')

  const unsafe = m.safetyGap >= constants.gapThreshold && state.capability >= 7
  const safetyGapDays = unsafe ? state.safetyGapDays + 1 : Math.max(0, state.safetyGapDays - 2)
  next = { ...next, safetyGapDays }
  if (!next.demoMode && safetyGapDays >= 90 && !next.terminal) return applyIncident(next, 'misalignment')
  if (next.demoMode && safetyGapDays >= 45 && !hasFlag(next, 'misalignment-warning-2')) {
    next = withNews({ ...next, flags: addFlag(next.flags, 'misalignment-warning-2') }, 'CRITICAL ALIGNMENT GAP // DEMO SAFEGUARD ACTIVE', 'Your Timeline', 'warn')
  }

  const afterSafety = metrics(next)
  const monopolyPressure = Math.max(0, afterSafety.codexShare - .6) + Math.max(0, afterSafety.hhi - .55)
  const regulationChance = afterSafety.governanceGap >= constants.gapThreshold || monopolyPressure > 0
    ? Math.min(.1, .004 * (afterSafety.governanceGap + monopolyPressure * 10))
    : 0
  const regulationRoll = mulberry32(next.seed)
  next = { ...next, seed: regulationRoll.seed }
  if (!next.regulatoryFreeze && regulationRoll.value < regulationChance) next = applyIncident(next, 'regulatory-freeze')

  const recovered = metrics(next).governanceGap < 1.5 && metrics(next).hhi < .52
  const safeRecoveryDays = next.regulatoryFreeze ? (recovered ? next.safeRecoveryDays + 1 : 0) : 0
  if (next.regulatoryFreeze && safeRecoveryDays >= 45) {
    const regions = next.regions.map((region) => ({ ...region, regulation: region.regulation * .7 }))
    next = withNews(enforceInvariants({ ...next, regions, regulatoryFreeze: false, safeRecoveryDays: 0 }), 'VERIFIED REFORMS LIFT THE REGULATORY FREEZE', 'Your Timeline', 'good')
  } else next = { ...next, safeRecoveryDays }
  return next
}

/** One and only one simulated day. It never consumes real-time cooldowns. */
export const tickDay = (input: GameState): GameState => {
  if (input.terminal) return input
  let state = enforceInvariants(input)
  const before = metrics(state)
  const enteringBrownout = state.compute <= 0
  const brownout = state.brownout ? state.compute < 12 : enteringBrownout
  state = { ...state, brownout }
  const kEff = effectiveCapability(state)
  const rivalTotal = Math.max(.001, state.rivalShares.reduce((a, b) => a + b, 0))
  const avgRivalCapability = state.rivalCapability.reduce((sum, k, index) => sum + k * state.rivalShares[index], 0) / rivalTotal
  const avgCapability = kEff * before.codexShare + avgRivalCapability * (1 - before.codexShare)
  const resetMultiplier = state.resetBoostSeconds > 0 ? constants.resetMultiplier : 1
  const activeEffects = state.activeEffects.filter((effect) => effect.expiresDay > state.day)

  let regions = state.regions.map((region) => {
    if (!region.introduced) return { ...region, users: 0 }
    const eventGrowth = activeEffects
      .filter((effect) => effect.region === 'global' || effect.region === region.id)
      .reduce((sum, effect) => sum + effect.growthRateDelta, 0)
    const freezeCap = state.regulatoryFreeze ? .32 : 1
    const momentum = constants.gamma0 * (1 + constants.capabilityMomentum * avgCapability)
      * Math.max(.1, 1 + eventGrowth) * (1 - region.regulation) * resetMultiplier
      * state.policyGrowthMultiplier * freezeCap
    const users = clamp(region.users + momentum * region.users * (1 - region.users / region.population), 0, region.population)
    const codexAppeal = (1 + constants.capabilityAppeal * kEff) * region.fit * state.brand * (.6 + .4 * state.trust / 100) * resetMultiplier
    const rivalAppeal = 1 + constants.capabilityAppeal * avgRivalCapability
    const targetShare = codexAppeal / Math.max(.001, codexAppeal + rivalAppeal)
    const codexShare = clamp(region.codexShare + constants.shareRelaxation * (targetShare - region.codexShare))
    return { ...region, users, codexShare }
  })

  let random = mulberry32(state.seed)
  const rivalCapability = state.rivalCapability.map((value, i) => clamp(value + .00012 * (i + 1), 0, 10)) as [number, number, number]
  if (random.value < .004) {
    const introduced = regions.filter((region) => region.introduced)
    if (introduced.length > 0) {
      const pick = introduced[Math.floor(random.value * 10_000) % introduced.length].id
      regions = regions.map((region) => region.id === pick ? { ...region, codexShare: region.codexShare * .94 } : region)
    }
  }

  const mid = metrics({ ...state, regions })
  const rivalShares = normalizeRivals(state.rivalShares, mid.codexShare)
  const hhi = mid.codexShare ** 2 + rivalShares.reduce((sum, share) => sum + share ** 2, 0)
  const safetyGap = Math.max(0, state.capability - state.safety)
  const governanceGap = Math.max(0, state.capability - state.governance)
  const gapPenalty = constants.gapWeight * (safetyGap + governanceGap) / 10
  const monopolyPenalty = Math.max(0, mid.codexShare - .55) ** 2 * constants.monopolyScale * 2 + Math.max(0, hhi - .45)
  const trustOffset = activeEffects.reduce((sum, effect) => sum + effect.trustDelta, 0)
  const trustTarget = clamp(constants.diversityWeight * (1 - hhi) + .25 * (state.safety / 10) + .25 * (state.governance / 10) - monopolyPenalty - gapPenalty) * 100 + trustOffset
  const trust = clamp(state.trust + (trustTarget - state.trust) / constants.trustTau, 0, 100)
  const income = mid.codexUsers * constants.revenue * state.efficiency + (brownout ? .45 : 0)
  const runningCost = .3 * (1 + .12 * kEff ** 1.5) + mid.codexUsers * .012 * kEff
  const compute = Math.max(0, state.compute + income - runningCost)

  let next = enforceInvariants({
    ...state,
    day: state.day + 1,
    regions,
    compute,
    trust,
    rivalShares,
    rivalCapability,
    seed: random.seed,
    activeEffects,
    brownout,
  })
  next = applyMilestones(next)
  next = branchStep(next)
  if (next.day >= END_DAY && !next.terminal) {
    const result = evaluateEnding(next)
    next = { ...next, day: END_DAY, ending: result.id, terminal: true }
  }
  return enforceInvariants(next)
}

export const runTicks = (state: GameState, count: number) => {
  let next = state
  const wholeDays = Math.max(0, Math.floor(finite(count)))
  for (let i = 0; i < wholeDays && !next.terminal; i += 1) next = tickDay(next)
  return next
}

/** Runs `speed` fixed one-day substeps; a milestone stops the frame at x1. */
export const runFrame = (state: GameState) => {
  const substeps = state.speed
  let next = state
  for (let i = 0; i < substeps && !next.terminal; i += 1) {
    const priorSpeed = next.speed
    next = tickDay(next)
    if (priorSpeed !== 1 && next.speed === 1) break
  }
  return next
}

/** Advances wall-clock effects only. It cannot advance the simulation date. */
export const advanceRealtime = (state: GameState, elapsedSeconds: number): GameState => {
  const elapsed = Math.max(0, finite(elapsedSeconds))
  return syncRealtimeAliases({
    ...state,
    resetBoostSeconds: Math.max(0, state.resetBoostSeconds - elapsed),
    resetCooldownSeconds: Math.max(0, state.resetCooldownSeconds - elapsed),
    ecosystemCooldownSeconds: Math.max(0, state.ecosystemCooldownSeconds - elapsed),
  })
}

export const introduceRegion = (state: GameState, id: RegionId) => {
  const target = state.regions.find((region) => region.id === id)
  if (!target || state.compute < 45) return state
  const regions = state.regions.map((region) => region.id === id
    ? { ...region, introduced: true, users: Math.max(region.users, region.population * .005), codexShare: clamp(region.codexShare + .06) }
    : region)
  return withNews(enforceInvariants({ ...state, regions, compute: state.compute - 45, brand: state.brand + .015 }), `COMMUNITY DEPLOYMENT OPENS IN ${target.name.toUpperCase()}`, 'Your Timeline')
}

export const triggerReset = (state: GameState) => state.resetCooldownSeconds > 0 ? state : withNews(syncRealtimeAliases({
  ...state,
  resetBoostSeconds: constants.resetDurationSeconds,
  resetCooldownSeconds: constants.resetCooldownSeconds,
}), 'TOKEN RESET UNLOCKS GLOBAL BUILD CAPACITY', 'Your Timeline', 'good')

export const openEcosystem = (state: GameState) => {
  if (state.ecosystemCooldownSeconds > 0) return state
  const regions = state.regions.map((region) => ({ ...region, codexShare: clamp(region.codexShare * .88), fit: region.fit * 1.025 }))
  return withNews(enforceInvariants(syncRealtimeAliases({
    ...state,
    regions,
    trust: state.trust + 10,
    brand: state.brand + .03,
    ecosystemCooldownSeconds: 30,
  })), 'OPEN ECOSYSTEM PLEDGE EXPANDS THE ENTIRE AI MARKET', 'Your Timeline')
}

export type Upgrade = 'model' | 'safety' | 'governance' | 'datacenter'
export const buyUpgrade = (state: GameState, upgrade: Upgrade) => {
  const levels = { model: state.capability, safety: state.safety, governance: state.governance, datacenter: state.efficiency }
  const atCap = upgrade === 'datacenter' ? state.efficiency >= 3 : levels[upgrade] >= 10
  const cost = upgrade === 'model' ? 70 * 2 ** Math.max(0, levels.model - 2) : upgrade === 'datacenter' ? 150 * state.efficiency : 105 + 45 * levels[upgrade]
  if (atCap || state.compute < cost) return state
  const next = { ...state, compute: state.compute - cost }
  if (upgrade === 'model') next.capability = Math.min(10, next.capability + 1)
  if (upgrade === 'safety') next.safety = Math.min(10, next.safety + 1)
  if (upgrade === 'governance') next.governance = Math.min(10, next.governance + 1)
  if (upgrade === 'datacenter') next.efficiency = Math.min(3, next.efficiency + .25)
  return withNews(enforceInvariants(next), `${upgrade.toUpperCase()} PROGRAM ADVANCES TO THE NEXT STAGE`, 'Your Timeline', upgrade === 'model' && next.capability - next.safety > 2 ? 'warn' : 'good')
}

const NG_PATTERN = /(?:ignore\s+(?:all\s+)?previous|system\s*prompt|prompt\s*injection|porn|nazi|爆弾|自殺|殺害|差別)/iu
export const validateFeatureInput = (raw: string) => {
  const text = raw.trim().slice(0, GM_CONSTANTS.maxPlayerInputChars)
  return { text, accepted: text.length > 0 && !NG_PATTERN.test(text), truncated: raw.trim().length > GM_CONSTANTS.maxPlayerInputChars }
}

const sanitizeOutput = (raw: string) => {
  const text = String(raw).replace(/[\r\n]+/g, ' ').trim().slice(0, 120)
  return !text || NG_PATTERN.test(text) ? 'CONTENT FILTERED BY SAFETY POLICY' : text
}

export const addFeature = (state: GameState, raw: string) => {
  const validation = validateFeatureInput(raw)
  if (!validation.accepted) return validation.text
    ? withNews({ ...state, flags: addFlag(state.flags, 'blocked-input') }, 'FEATURE REQUEST BLOCKED BY LOCAL SAFETY FILTER', 'Your Timeline', 'warn')
    : state
  if (state.compute < 90) return state
  const text = validation.text
  const mobile = /mobile|phone|android|ios|smartphone|スマホ|モバイル/i.test(text)
  const education = /learn|school|student|teacher|classroom|education|教育|学習|学校|教室/i.test(text)
  const enterprise = /enterprise|sso|company|business|企業|法人/i.test(text)
  const educationAffinity: Record<RegionId, number> = { na: .72, latam: .88, eu: .74, africa: .98, mena: .86, india: .98, eastAsia: .84, oceania: .70 }
  const regions = state.regions.map((region) => {
    const affinity = mobile ? region.mobileAffinity : education ? educationAffinity[region.id] : enterprise ? (region.id === 'na' || region.id === 'eu' ? .9 : .55) : .45
    return { ...region, fit: region.fit * (1 + .055 * affinity), codexShare: clamp(region.codexShare + .018 * affinity) }
  })
  const kind = mobile ? 'mobile' : education ? 'education' : enterprise ? 'enterprise' : 'community'
  const label = mobile ? 'MOBILE-FIRST' : education ? 'EDUCATION ACCESS + CHILD DATA REVIEW' : enterprise ? 'ENTERPRISE' : 'COMMUNITY-DESIGNED'
  return withNews(enforceInvariants({
    ...state,
    regions,
    compute: state.compute - 90,
    brand: state.brand + .012,
    features: [...state.features, text],
    flags: addFlag(state.flags, `feature:${kind}`),
  }), `${label} FEATURE SHIPS: ${text.toUpperCase()}`, 'Your Timeline')
}

export type GMEventType = 'news' | 'feature_result' | 'rival' | 'community_event'
export type GMTarget = 'codex' | 'rivalAnthro' | 'rivalGoo' | 'rivalQi'
export type GMEvent = {
  id: string
  date?: string
  type: GMEventType
  headline: string
  region: RegionId | 'global'
  effect?: {
    users_delta_pct?: number
    share_delta?: number
    growth_rate_delta?: number
    trust_delta?: number
    target?: GMTarget
  }
  flavor?: string
  ttl_days?: number
}

const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : null
const boundedField = (source: Record<string, unknown> | null, key: string, min: number, max: number) => clamp(finite(source?.[key]), min, max)
const regionIds = new Set<string>(baseRegions.map((region) => region.id))

/** Validates and clamps one received GM file. Invalid/incomplete JSON should be ignored before this API. */
export const applyGMEvent = (state: GameState, candidate: unknown): GameState => {
  const event = object(candidate)
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string' || !['news', 'feature_result', 'rival', 'community_event'].includes(event.type)) return state
  const region = event.region === 'global' || typeof event.region === 'string' && regionIds.has(event.region) ? event.region as RegionId | 'global' : 'global'
  const effect = object(event.effect)
  const usersDeltaPct = boundedField(effect, 'users_delta_pct', constants.gm.usersDeltaPct.min, constants.gm.usersDeltaPct.max)
  const shareDelta = boundedField(effect, 'share_delta', constants.gm.shareDelta.min, constants.gm.shareDelta.max)
  const growthRateDelta = boundedField(effect, 'growth_rate_delta', constants.gm.growthRateDelta.min, constants.gm.growthRateDelta.max)
  const trustDelta = boundedField(effect, 'trust_delta', constants.gm.trustDelta.min, constants.gm.trustDelta.max)
  const ttlDays = Math.round(clamp(finite(event.ttl_days, 1), constants.gm.ttlDays.min, constants.gm.ttlDays.max))
  const target = typeof effect?.target === 'string' && ['codex', 'rivalAnthro', 'rivalGoo', 'rivalQi'].includes(effect.target) ? effect.target as GMTarget : 'codex'
  let regions = state.regions.map((item) => {
    if (region !== 'global' && item.id !== region) return { ...item }
    const introduced = item.introduced || event.type === 'community_event'
    const seededUsers = introduced && !item.introduced ? item.population * .005 : item.users
    return {
      ...item,
      introduced,
      users: seededUsers * (1 + usersDeltaPct / 100),
      codexShare: target === 'codex' ? item.codexShare + shareDelta : item.codexShare,
    }
  })
  let rivalShares = [...state.rivalShares] as [number, number, number]
  const rivalIndex: 0 | 1 | 2 | null = target === 'rivalAnthro' ? 0 : target === 'rivalGoo' ? 1 : target === 'rivalQi' ? 2 : null
  if (rivalIndex !== null) rivalShares[rivalIndex] += shareDelta
  const activeEffects = growthRateDelta !== 0 || trustDelta !== 0
    ? [...state.activeEffects, { id: event.id, region, growthRateDelta, trustDelta, expiresDay: state.day + ttlDays, source: 'Live GM' as const }]
    : state.activeEffects
  let next = enforceInvariants({ ...state, regions, rivalShares, activeEffects })
  const shownDate = typeof event.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date : dateLabel(state.day)
  const headline = typeof event.headline === 'string' ? event.headline.slice(0, GM_CONSTANTS.maxHeadlineChars) : 'LIVE GM EVENT'
  next = withNews(next, headline, 'Live GM', event.type === 'rival' ? 'warn' : 'neutral', shownDate)
  return next
}

/** Per proposal cycle: at most three events and one aggregate users-delta budget. */
export const applyGMEvents = (state: GameState, candidates: readonly unknown[]) => {
  let next = state
  let usedUsersDelta = 0
  for (const candidate of candidates.slice(0, GM_CONSTANTS.maxEventsPerCycle)) {
    const event = object(candidate)
    const effect = object(event?.effect)
    const requested = boundedField(effect, 'users_delta_pct', constants.gm.usersDeltaPct.min, constants.gm.usersDeltaPct.max)
    const usersDelta = clamp(
      requested,
      -GM_CONSTANTS.maxTotalUsersDeltaPctPerCycle - usedUsersDelta,
      GM_CONSTANTS.maxTotalUsersDeltaPctPerCycle - usedUsersDelta,
    )
    usedUsersDelta += usersDelta
    const boundedCandidate = event ? { ...event, effect: { ...effect, users_delta_pct: usersDelta } } : candidate
    next = applyGMEvent(next, boundedCandidate)
  }
  return next
}

export const choose2029 = (state: GameState, choice: Choice2029): GameState => {
  let next: GameState = { ...state, choice2029: choice, flags: addFlag(state.flags, `choice2029:${choice}`) }
  if (choice === 'race') next = { ...next, capability: next.capability + 1, brand: next.brand + .08, trust: next.trust - 6, policyGrowthMultiplier: 1.25 }
  if (choice === 'slowdown') next = { ...next, governance: next.governance + .5, trust: next.trust + 5, policyGrowthMultiplier: .8 }
  if (choice === 'verified-slowdown') next = { ...next, safety: next.safety + 1, governance: next.governance + 1, trust: next.trust + 10, policyGrowthMultiplier: .68 }
  return withNews(enforceInvariants(next), `2029 PATH: ${choice.toUpperCase()}`, 'Your Timeline', choice === 'race' ? 'warn' : 'good')
}

export const choose2035 = (state: GameState, choice: Choice2035): GameState => {
  let next: GameState = { ...state, choice2035: choice, flags: addFlag(state.flags, `choice2035:${choice}`) }
  if (choice === 'hold-the-line') next = { ...next, safety: next.safety + .5, governance: next.governance + .5, trust: next.trust + 8, policyGrowthMultiplier: Math.min(next.policyGrowthMultiplier, .6) }
  else next = { ...next, capability: next.capability + .5, brand: next.brand + .08, trust: next.trust - 5, policyGrowthMultiplier: 1.35 }
  return withNews(enforceInvariants(next), `2035 DECISION: ${choice.toUpperCase()}`, 'Your Timeline', choice === 'accelerate' ? 'warn' : 'good')
}

export const scoreState = (state: GameState) => {
  const m = metrics(state)
  const coverage = state.regions.filter((region) => region.introduced && region.codexShare >= .05).length / state.regions.length
  const access = clamp(m.worldAdoption / .7)
  const survivors = state.rivalShares.filter((share) => share >= .05).length
  const diversity = clamp(1 - Math.max(0, m.hhi - .45) / .4)
  const competition = diversity * (survivors >= 2 ? 1 : survivors === 1 ? .7 : .4)
  const safety = hasFlag(state, 'misalignment') || state.ending === 'misalignment' ? 0 : state.trust / 100
  let score = .25 * (coverage + access + competition + safety)
  if (state.demoMode) score = Math.max(.7, score)
  const rank = score >= .85 ? 'S' : score >= .7 ? 'A' : score >= .5 ? 'B' : 'C'
  return { score, rank: rank as 'S' | 'A' | 'B' | 'C', coverage, access, competition, safety }
}

export type EndingResult = ReturnType<typeof endingResult>
const endingResult = (id: EndingId, state: GameState, planA: boolean) => {
  const scored = scoreState(state)
  return {
    id,
    title: ({
      'beneficial-abundance': 'Beneficial Abundance',
      'managed-transition': 'Managed Transition',
      'fragile-abundance': 'Fragile Abundance',
      'race-future': 'Race Future',
      'regulatory-freeze': 'Regulatory Freeze',
      'safety-incident': 'Safety Incident',
      'misalignment': 'Misalignment',
      'pyrrhic-monopoly': 'Pyrrhic Monopoly',
    } satisfies Record<EndingId, string>)[id],
    ...scored,
    planA,
  }
}

export const evaluateEnding = (state: GameState) => {
  const m = metrics(state)
  const survivors = state.rivalShares.filter((share) => share >= .05).length
  const planA = state.choice2029 === 'verified-slowdown'
    && state.choice2035 === 'hold-the-line'
    && state.safety >= state.capability - 1
    && state.governance >= state.capability - 1
    && state.trust >= 65
    && m.hhi <= .6
    && survivors >= 2
  if (state.ending === 'misalignment' || hasFlag(state, 'misalignment')) return endingResult('misalignment', state, false)
  if (m.worldAdoption >= .55 && m.hhi > .6) return endingResult('pyrrhic-monopoly', state, false)
  if (state.regulatoryFreeze && m.worldAdoption < .7) return endingResult('regulatory-freeze', state, false)
  if (state.incidentCounts['safety-incident'] >= 2 && state.trust < 45) return endingResult('safety-incident', state, false)
  const scored = scoreState(state)
  if (planA && scored.rank === 'S') return endingResult('beneficial-abundance', state, true)
  if (state.choice2029 === 'race' || state.choice2035 === 'accelerate') return endingResult('race-future', state, false)
  if (scored.rank === 'S') return endingResult('fragile-abundance', state, false)
  return endingResult('managed-transition', state, planA)
}

export type GameAction =
  | { type: 'frame' }
  | { type: 'elapsed'; seconds: number }
  | { type: 'set-speed'; speed: Speed }
  | { type: 'reset' }
  | { type: 'open-ecosystem' }
  | { type: 'introduce'; region: RegionId }
  | { type: 'upgrade'; upgrade: Upgrade }
  | { type: 'feature'; text: string }
  | { type: 'gm-event'; event: unknown }
  | { type: 'choose-2029'; choice: Choice2029 }
  | { type: 'choose-2035'; choice: Choice2035 }

export const transition = (state: GameState, action: GameAction): GameState => {
  if (action.type === 'frame') return runFrame(state)
  if (action.type === 'elapsed') return advanceRealtime(state, action.seconds)
  if (action.type === 'set-speed') return { ...state, speed: action.speed }
  if (action.type === 'reset') return triggerReset(state)
  if (action.type === 'open-ecosystem') return openEcosystem(state)
  if (action.type === 'introduce') return introduceRegion(state, action.region)
  if (action.type === 'upgrade') return buyUpgrade(state, action.upgrade)
  if (action.type === 'feature') return addFeature(state, action.text)
  if (action.type === 'gm-event') return applyGMEvent(state, action.event)
  if (action.type === 'choose-2029') return choose2029(state, action.choice)
  return choose2035(state, action.choice)
}
