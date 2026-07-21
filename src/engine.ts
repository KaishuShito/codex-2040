import { GM_CONSTANTS } from './gm'
import type { SourceLabel } from './scenario'
import { WORLD_EVENTS } from './worldEvents/catalog'
import {
  scheduleWorldEvent,
  WORLD_EVENT_SCHEDULER_CONSTANTS,
  worldEventDateRandom,
  type WorldEventCategory,
  type WorldEventEffect,
} from './worldEvents'
import {
  getStrategyNode,
  resolveStrategyNodeId,
  STRATEGY_NODES_BY_ID,
  type StrategyEffectDescriptor,
  type StrategyNode,
  type StrategyNodeId,
  type StrategyPrerequisite,
} from './strategyNodes'

export type ScenarioSource = SourceLabel
export type RegionId = 'na' | 'latam' | 'eu' | 'africa' | 'mena' | 'india' | 'eastAsia' | 'oceania'
export type Speed = 1 | 8

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

export type WorldEventNotice = {
  eventId: string
  category: WorldEventCategory
  source: ScenarioSource
  date: string
  headline: string
  cause: string
  flavor: string
  region: RegionId | 'global'
  effect: WorldEventEffect
  ttlDays: number
  comboLabel: string | null
  comboFeature: string | null
  momentumDays: number
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
  /** Rival strategy axes mirror the player's Model / Product / Company choices. */
  rivalProduct: [number, number, number]
  rivalCompany: [number, number, number]
  speed: Speed
  /** Simulated days of player-created growth momentum remaining. */
  momentumDays: number
  /** Meaningful player interventions; S rank requires more than passive waiting. */
  interventions: number
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
  /** Stable seed and history for the independent authored-world-event stream. */
  worldEventSeed: number
  firedWorldEventIds: string[]
  lastWorldEventDay: number | null
  lastWorldEventCategoryDay: Partial<Record<WorldEventCategory, number>>
  lastWorldPopupDay: number | null
  worldEventPopupCooldownSeconds: number
  pendingWorldEvent: WorldEventNotice | null
  flags: string[]
  activeEffects: ActiveEffect[]
  safetyGapDays: number
  safeRecoveryDays: number
  /** Simulated-day refractory windows prevent incident spam. */
  safetyIncidentCooldownDays: number
  regulatoryIncidentCooldownDays: number
  incidentCounts: Record<IncidentKind, number>
  regulatoryFreeze: boolean
  brownout: boolean
  choice2029: Choice2029 | null
  choice2035: Choice2035 | null
  policyGrowthMultiplier: number
  ending: EndingId | null
  terminal: boolean
  features: string[]
  /** Purchased strategy-tree nodes. Optional so version-1 saves remain readable. */
  acquiredStrategyNodes?: StrategyNodeId[]
  /** Purchase count for repeatable legacy-backed nodes; absent means one purchase. */
  strategyNodePurchaseCounts?: Partial<Record<StrategyNodeId, number>>
}

export const SPEEDS = [1, 8] as const
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
  idleGrowthMultiplier: 0.06,
  accessTarget: 0.05,
  pyrrhicAdoptionThreshold: 0.04,
  unsafeCapabilityThreshold: 6,
  safetyIncidentCooldownDays: 180,
  regulatoryIncidentCooldownDays: 365,
  momentumDays: Object.freeze({ reset: 90, region: 180, upgrade: 120, feature: 240, ecosystem: 240, decision: 180 }),
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

const LEGACY_FEATURE_NODES = Object.freeze({
  'feature:mobile': 'product-mobile',
  'feature:enterprise': 'product-sso',
  'feature:education': 'product-education',
  'feature:research': 'product-research',
  'feature:connectors': 'product-connectors',
  'feature:analysis': 'product-analysis',
} satisfies Readonly<Record<string, StrategyNodeId>>)

/**
 * Returns a canonical, duplicate-free acquisition list. A small legacy inference
 * layer preserves progress from version-1 saves that predate the 50-node tree.
 */
export const acquiredStrategyNodeIds = (state: GameState): readonly StrategyNodeId[] => {
  const acquired = new Set<StrategyNodeId>()
  for (const rawId of state.acquiredStrategyNodes ?? []) {
    const id = resolveStrategyNodeId(rawId)
    if (id) acquired.add(id)
  }

  // Only genuinely old saves (the field is absent) infer legacy progression.
  // A new run always carries an explicit array, so raw K/S/G values can never
  // auto-complete branches the player did not purchase.
  if (state.acquiredStrategyNodes === undefined) {
    if (state.capability >= 3) acquired.add('model-foundation')
    if (state.capability >= 5) acquired.add('model-reasoning')
    if (state.capability >= 7) acquired.add('model-agents')
    if (state.capability >= 10) acquired.add('model-frontier')
    if (state.safety > 2) acquired.add('company-safety')
    if (state.governance > 2) acquired.add('company-policy')
    if (state.efficiency > 1) acquired.add('company-datacenter')
  }

  for (const [flag, nodeId] of Object.entries(LEGACY_FEATURE_NODES)) {
    if (hasFlag(state, flag)) acquired.add(nodeId)
  }
  if (hasFlag(state, 'open-ecosystem') || hasFlag(state, 'ecosystem:open')) acquired.add('ecosystem-open')
  return [...acquired]
}

const normalizedStrategyPurchaseCounts = (state: GameState): Partial<Record<StrategyNodeId, number>> => {
  const counts: Partial<Record<StrategyNodeId, number>> = {}
  for (const [rawId, rawCount] of Object.entries(state.strategyNodePurchaseCounts ?? {})) {
    const id = resolveStrategyNodeId(rawId)
    if (!id) continue
    counts[id] = Math.max(1, Math.floor(finite(rawCount, 1)))
  }
  return counts
}

export type StrategyPersistentEffects = Readonly<{
  incomeMultiplier: number
  opexMultiplier: number
  controlRelief: number
  idleFloor: number
}>

/** Persistent modifiers are derived from acquisitions, so saves need only IDs. */
export const strategyPersistentEffects = (state: GameState): StrategyPersistentEffects => {
  let incomeMultiplier = 1
  let opexMultiplier = 1
  let controlRelief = 0
  let idleFloor = 0
  // Do not retroactively add modifiers to old saves. Inferred legacy nodes are
  // used for graph continuity only; persistent effects start with tracked buys.
  for (const rawId of state.acquiredStrategyNodes ?? []) {
    const id = resolveStrategyNodeId(rawId)
    if (!id) continue
    const node = STRATEGY_NODES_BY_ID.get(id)
    if (!node) continue
    const purchaseCounts = state.strategyNodePurchaseCounts as Readonly<Record<string, number | undefined>> | undefined
    const purchases = Math.max(1, Math.floor(finite(purchaseCounts?.[rawId] ?? purchaseCounts?.[id], 1)))
    for (let purchase = 0; purchase < purchases; purchase += 1) {
      for (const effect of node.effects) {
        if (effect.metric === 'incomeMultiplier') incomeMultiplier *= effect.value
        if (effect.metric === 'opexMultiplier') opexMultiplier *= effect.value
        if (effect.metric === 'controlRelief') controlRelief += effect.value
        if (effect.metric === 'idleFloor') idleFloor = Math.max(idleFloor, effect.value)
      }
    }
  }
  return {
    incomeMultiplier: clamp(incomeMultiplier, .5, 2),
    opexMultiplier: clamp(opexMultiplier, .5, 2),
    controlRelief: clamp(controlRelief, -.5, .5),
    idleFloor: clamp(idleFloor, 0, .001),
  }
}

export const dateLabel = (day: number) => new Date(START_DATE + Math.max(0, Math.floor(day)) * 86_400_000)
  .toISOString().slice(0, 10)

export const metrics = (state: GameState) => {
  const adoption = total(state.regions, (r) => r.users)
  const population = total(state.regions, (r) => r.population)
  const codexUsers = total(state.regions, (r) => r.users * r.codexShare)
  const codexShare = adoption > 0 ? codexUsers / adoption : 0
  const rivals = normalizeRivals(state.rivalShares, codexShare)
  const hhi = codexShare ** 2 + rivals.reduce((sum, share) => sum + share ** 2, 0)
  const controlRelief = strategyPersistentEffects(state).controlRelief
  return {
    adoption,
    population,
    codexUsers,
    worldAdoption: population > 0 ? adoption / population : 0,
    codexShare,
    hhi,
    safetyGap: Math.max(0, state.capability - state.safety - controlRelief),
    governanceGap: Math.max(0, state.capability - state.governance - controlRelief),
    effectiveCapability: effectiveCapability(state),
  }
}

export type TrustFactor = {
  id: 'baseline' | 'diversity' | 'safety' | 'governance' | 'safety-gap' | 'governance-gap' | 'concentration' | 'events'
  label: string
  value: number
}

/** Exposes the same causal terms used by tickDay so the UI can explain Trust. */
export const trustBreakdown = (state: GameState) => {
  const m = metrics(state)
  const safetyGap = m.safetyGap
  const governanceGap = m.governanceGap
  const gapUnit = constants.gapWeight * 10
  const monopolyPenalty = Math.max(0, m.codexShare - .55) ** 2 * constants.monopolyScale * 2 + Math.max(0, m.hhi - .45)
  const activeEffects = state.activeEffects.filter((effect) => effect.expiresDay > state.day)
  const eventOffset = clamp(activeEffects.reduce((sum, effect) => sum + effect.trustDelta, 0), -12, 12)
  const factors: TrustFactor[] = [
    { id: 'baseline', label: '制度への基礎信頼', value: 25 },
    { id: 'diversity', label: 'プロバイダーの多様性', value: constants.diversityWeight * (1 - m.hhi) * 100 },
    { id: 'safety', label: '安全対応力', value: 2.5 * state.safety },
    { id: 'governance', label: 'ガバナンス力', value: 2.5 * state.governance },
    { id: 'safety-gap', label: '能力 > 安全性', value: -gapUnit * safetyGap },
    { id: 'governance-gap', label: '能力 > ガバナンス', value: -gapUnit * governanceGap },
    { id: 'concentration', label: '市場集中', value: -monopolyPenalty * 100 },
    { id: 'events', label: '進行中の世界イベント', value: eventOffset },
  ]
  const target = clamp(factors.reduce((sum, factor) => sum + factor.value, 0), 0, 100)
  return { target, dailyDelta: (target - state.trust) / constants.trustTau, factors }
}

const activateMomentum = (state: GameState, days: number, countIntervention = true): GameState => ({
  ...state,
  momentumDays: Math.max(state.momentumDays, Math.max(0, Math.floor(days))),
  interventions: state.interventions + (countIntervention ? 1 : 0),
})

// `introduced` means Codex has established a local presence. It does not mean
// that a region has no AI users at all. These conservative 2026 baselines keep
// the world believable while leaving meaningful room for the player to enter.
const backgroundAiUsers: Partial<Record<RegionId, number>> = {
  africa: 3,
  mena: 2,
  oceania: 1,
}

const baseRegions: Region[] = [
  { id: 'na', name: '北米', population: 620, users: 17, codexShare: .36, introduced: true, regulation: .15, mobileAffinity: .62, fit: 1 },
  { id: 'latam', name: '中南米', population: 660, users: 3, codexShare: .22, introduced: true, regulation: .08, mobileAffinity: .91, fit: 1 },
  { id: 'eu', name: '欧州', population: 750, users: 9, codexShare: .31, introduced: true, regulation: .32, mobileAffinity: .65, fit: 1 },
  { id: 'africa', name: 'アフリカ', population: 1500, users: backgroundAiUsers.africa!, codexShare: 0, introduced: false, regulation: .06, mobileAffinity: .96, fit: 1 },
  { id: 'mena', name: '中東', population: 510, users: backgroundAiUsers.mena!, codexShare: 0, introduced: false, regulation: .18, mobileAffinity: .86, fit: 1 },
  { id: 'india', name: 'インド', population: 1460, users: 5, codexShare: .24, introduced: true, regulation: .1, mobileAffinity: .94, fit: 1 },
  { id: 'eastAsia', name: '東アジア', population: 1670, users: 12, codexShare: .19, introduced: true, regulation: .2, mobileAffinity: .88, fit: 1 },
  { id: 'oceania', name: 'オセアニア', population: 46, users: backgroundAiUsers.oceania!, codexShare: 0, introduced: false, regulation: .13, mobileAffinity: .73, fit: 1 },
]

export const createInitialState = (options: { seed?: number } = {}): GameState => ({
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
  rivalProduct: [2.0, 2.6, 1.8],
  rivalCompany: [2.6, 2.0, 2.2],
  speed: 1,
  momentumDays: 0,
  interventions: 0,
  resetBoostSeconds: 0,
  resetCooldownSeconds: 0,
  ecosystemCooldownSeconds: 0,
  resetDays: 0,
  resetCooldownDays: 0,
  ecosystemCooldownDays: 0,
  brand: 1,
  news: [
    { id: 2, date: '2026-01-01', tone: 'neutral', headline: 'CODEX拡大プロトコルが始動', source: 'AI 2027' },
    { id: 1, date: '2025-12-18', tone: 'good', headline: '開発エージェントが新たな信頼性水準へ', source: 'AI 2027' },
  ],
  nextNewsId: 3,
  seed: (options.seed ?? 2040) >>> 0,
  worldEventSeed: ((options.seed ?? 2040) ^ 0x9e3779b9) >>> 0,
  firedWorldEventIds: [],
  lastWorldEventDay: null,
  lastWorldEventCategoryDay: {},
  lastWorldPopupDay: null,
  worldEventPopupCooldownSeconds: 0,
  pendingWorldEvent: null,
  flags: [],
  activeEffects: [],
  safetyGapDays: 0,
  safeRecoveryDays: 0,
  safetyIncidentCooldownDays: 0,
  regulatoryIncidentCooldownDays: 0,
  incidentCounts: { 'safety-incident': 0, 'regulatory-freeze': 0, misalignment: 0 },
  regulatoryFreeze: false,
  brownout: false,
  choice2029: null,
  choice2035: null,
  policyGrowthMultiplier: 1,
  ending: null,
  terminal: false,
  features: [],
  acquiredStrategyNodes: [],
  strategyNodePurchaseCounts: {},
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
      users: clamp(Math.max(
        finite(region.users),
        introduced ? 0 : backgroundAiUsers[region.id] ?? 0,
      ), 0, population),
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
    brand: clamp(finite(state.brand, 1), .25, 10),
    rivalShares: normalizeRivals(state.rivalShares, codexShare),
    rivalCapability: state.rivalCapability.map((value) => clamp(finite(value), 0, 10)) as [number, number, number],
    rivalProduct: state.rivalProduct.map((value) => clamp(finite(value), 0, 10)) as [number, number, number],
    rivalCompany: state.rivalCompany.map((value) => clamp(finite(value), 0, 10)) as [number, number, number],
    momentumDays: Math.max(0, Math.floor(finite(state.momentumDays))),
    interventions: Math.max(0, Math.floor(finite(state.interventions))),
    safetyIncidentCooldownDays: Math.max(0, Math.floor(finite(state.safetyIncidentCooldownDays))),
    regulatoryIncidentCooldownDays: Math.max(0, Math.floor(finite(state.regulatoryIncidentCooldownDays))),
    resetBoostSeconds: Math.max(0, finite(state.resetBoostSeconds)),
    resetCooldownSeconds: Math.max(0, finite(state.resetCooldownSeconds)),
    ecosystemCooldownSeconds: Math.max(0, finite(state.ecosystemCooldownSeconds)),
    policyGrowthMultiplier: clamp(finite(state.policyGrowthMultiplier, 1), .25, 2),
    seed: state.seed >>> 0,
    worldEventSeed: finite(state.worldEventSeed, state.seed ^ 0x9e3779b9) >>> 0,
    firedWorldEventIds: Array.isArray(state.firedWorldEventIds) ? [...new Set(state.firedWorldEventIds.filter((id): id is string => typeof id === 'string'))] : [],
    lastWorldEventDay: typeof state.lastWorldEventDay === 'number' ? Math.max(0, Math.floor(state.lastWorldEventDay)) : null,
    lastWorldEventCategoryDay: state.lastWorldEventCategoryDay && typeof state.lastWorldEventCategoryDay === 'object'
      ? { ...state.lastWorldEventCategoryDay }
      : {},
    lastWorldPopupDay: typeof state.lastWorldPopupDay === 'number' ? Math.max(0, Math.floor(state.lastWorldPopupDay)) : null,
    worldEventPopupCooldownSeconds: Math.max(0, finite(state.worldEventPopupCooldownSeconds)),
    pendingWorldEvent: state.pendingWorldEvent ?? null,
    acquiredStrategyNodes: state.acquiredStrategyNodes === undefined ? undefined : [...acquiredStrategyNodeIds(state)],
    strategyNodePurchaseCounts: state.strategyNodePurchaseCounts === undefined ? undefined : normalizedStrategyPurchaseCounts(state),
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

const RIVAL_NAMES = ['ANTHRO', 'GOO', 'QI'] as const
const RIVAL_AXES = [
  { key: 'rivalCapability', label: 'モデル' },
  { key: 'rivalProduct', label: 'プロダクト' },
  { key: 'rivalCompany', label: '組織' },
] as const
const RIVAL_THRESHOLDS = [4, 6, 8, 10] as const

/** Emits one readable competitive move at a time as autonomous rival strategies cross stages. */
const announceRivalStrategy = (state: GameState): GameState => {
  for (let rival = 0; rival < RIVAL_NAMES.length; rival += 1) {
    for (const axis of RIVAL_AXES) {
      for (const threshold of RIVAL_THRESHOLDS) {
        const flag = `rival:${rival}:${axis.key}:${threshold}`
        if (state[axis.key][rival] >= threshold && !hasFlag(state, flag)) {
          const source: ScenarioSource = state.day < dayFor('2029-01-01') ? 'AI 2027' : 'AI 2040'
          return withNews(
            { ...state, flags: addFlag(state.flags, flag) },
            `${RIVAL_NAMES[rival]}の${axis.label}戦略が${threshold}に到達 // 競争圧力が上昇`,
            source,
            'warn',
          )
        }
      }
    }
  }
  return state
}

const dayFor = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - START_DATE) / 86_400_000)
const milestones = [
  { day: dayFor('2026-07-18'), flag: 'milestone:build-week-tokyo', headline: 'BUILD WEEK TOKYOからネットワークが広がる', source: 'Your Timeline', tone: 'good' },
  { day: dayFor('2027-01-01'), flag: 'milestone:2027-agents', headline: 'エージェントがトップ開発者級の能力に到達', source: 'AI 2027', tone: 'neutral' },
  { day: dayFor('2029-01-01'), flag: 'milestone:choose-2029', headline: '進路を選べ：競争か、検証つき減速か', source: 'AI 2040', tone: 'warn' },
  { day: dayFor('2035-01-01'), flag: 'milestone:hold-2035', headline: '人間の専門家級で一線を守れ', source: 'AI 2040', tone: 'warn' },
] as const

const applyMilestones = (state: GameState): GameState => {
  let next = state
  for (const milestone of milestones) {
    if (next.day >= milestone.day && !hasFlag(next, milestone.flag)) {
      next = withNews({ ...next, flags: addFlag(next.flags, milestone.flag) }, milestone.headline, milestone.source, milestone.tone)
    }
  }
  return next
}

const combineWorldEventEffects = (base: WorldEventEffect, bonus?: WorldEventEffect): WorldEventEffect => ({
  usersDeltaPct: clamp(base.usersDeltaPct + (bonus?.usersDeltaPct ?? 0), constants.gm.usersDeltaPct.min, constants.gm.usersDeltaPct.max),
  shareDelta: clamp(base.shareDelta + (bonus?.shareDelta ?? 0), constants.gm.shareDelta.min, constants.gm.shareDelta.max),
  growthRateDelta: clamp(base.growthRateDelta + (bonus?.growthRateDelta ?? 0), constants.gm.growthRateDelta.min, constants.gm.growthRateDelta.max),
  trustDelta: clamp(base.trustDelta + (bonus?.trustDelta ?? 0), constants.gm.trustDelta.min, constants.gm.trustDelta.max),
  target: bonus?.target ?? base.target ?? 'codex',
})

const findComboFeature = (state: GameState, terms: readonly string[] | undefined) => {
  if (!terms) return null
  return state.features.find((feature) => terms.some((term) => feature.toLocaleLowerCase().includes(term.toLocaleLowerCase()))) ?? null
}

/** Applies one authored event without granting automatic Momentum or touching control axes. */
export const applyWorldEvent = (
  state: GameState,
  scheduled: NonNullable<ReturnType<typeof scheduleWorldEvent>>,
): GameState => {
  const { definition } = scheduled
  // Strategy catalog links are explanatory metadata. A combo only activates
  // when the scheduler has verified its authored requirements.
  const combo = scheduled.combo
  const region: RegionId | 'global' = definition.regions === 'global'
    ? 'global'
    : definition.regions[Math.floor(worldEventDateRandom(state.worldEventSeed, state.day, `${definition.id}:region`) * definition.regions.length)] ?? 'global'
  const effect = combineWorldEventEffects(definition.effect, combo?.effect)
  const ttlDays = Math.round(clamp(combo?.ttlDays ?? definition.ttlDays, constants.gm.ttlDays.min, constants.gm.ttlDays.max))
  const target = effect.target ?? 'codex'
  const regions = state.regions.map((item) => {
    if (region !== 'global' && item.id !== region) return { ...item }
    return {
      ...item,
      users: item.users * (1 + effect.usersDeltaPct / 100),
      codexShare: target === 'codex' ? item.codexShare + effect.shareDelta : item.codexShare,
    }
  })
  const rivalShares = [...state.rivalShares] as [number, number, number]
  const rivalIndex: 0 | 1 | 2 | null = target === 'rivalAnthro' ? 0 : target === 'rivalGoo' ? 1 : target === 'rivalQi' ? 2 : null
  if (rivalIndex !== null) rivalShares[rivalIndex] += effect.shareDelta
  const activeEffects = effect.growthRateDelta !== 0 || effect.trustDelta !== 0
    ? [...state.activeEffects, {
        id: definition.id,
        region,
        growthRateDelta: effect.growthRateDelta,
        trustDelta: effect.trustDelta,
        expiresDay: state.day + ttlDays,
        source: definition.source,
      }]
    : state.activeEffects
  const comboFeature = findComboFeature(state, combo?.requires.featureTermsAny)
  const comboLabel = combo?.label ?? null
  const momentumDays = Math.min(30, Math.max(0, combo?.momentumDays ?? 0))
  const popupAllowed = scheduled.requestedPresentation === 'popup'
    && state.worldEventPopupCooldownSeconds <= 0
    && (state.lastWorldPopupDay === null || state.day - state.lastWorldPopupDay >= WORLD_EVENT_SCHEDULER_CONSTANTS.popupSpacingDays)
  const notice: WorldEventNotice = {
    eventId: definition.id,
    category: definition.category,
    source: definition.source,
    date: dateLabel(state.day),
    headline: combo?.headline ?? definition.headline,
    cause: definition.cause,
    flavor: definition.flavor,
    region,
    effect,
    ttlDays,
    comboLabel,
    comboFeature,
    momentumDays,
  }
  let next = enforceInvariants({
    ...state,
    regions,
    rivalShares,
    activeEffects,
    firedWorldEventIds: [...state.firedWorldEventIds, definition.id],
    lastWorldEventDay: state.day,
    lastWorldEventCategoryDay: { ...state.lastWorldEventCategoryDay, [definition.category]: state.day },
    lastWorldPopupDay: popupAllowed ? state.day : state.lastWorldPopupDay,
    pendingWorldEvent: popupAllowed ? notice : null,
    momentumDays: momentumDays > 0 ? Math.max(state.momentumDays, momentumDays) : state.momentumDays,
  })
  const tone: NewsItem['tone'] = effect.trustDelta < 0 || (target !== 'codex' && effect.shareDelta > 0) ? 'warn' : effect.trustDelta > 0 || effect.usersDeltaPct > 0 ? 'good' : 'neutral'
  next = withNews(next, notice.headline, definition.source, tone, notice.date)
  return next
}

const scheduleWorldEventForState = (state: GameState) => state.day < 120 ? null : scheduleWorldEvent(WORLD_EVENTS, {
  seed: state.worldEventSeed,
  day: state.day,
  year: new Date(START_DATE + state.day * 86_400_000).getUTCFullYear(),
  flags: state.flags,
  features: state.features,
  trust: state.trust,
  capability: state.capability,
  worldAdoption: metrics(state).worldAdoption,
  codexShare: metrics(state).codexShare,
  firedEventIds: state.firedWorldEventIds,
  lastEventDay: state.lastWorldEventDay,
  lastCategoryEventDay: state.lastWorldEventCategoryDay,
})

export const acknowledgeWorldEvent = (state: GameState): GameState => state.pendingWorldEvent
  ? { ...state, pendingWorldEvent: null, worldEventPopupCooldownSeconds: 45 }
  : state

const applyIncident = (state: GameState, kind: IncidentKind): GameState => {
  const incidentCounts = { ...state.incidentCounts, [kind]: state.incidentCounts[kind] + 1 }
  if (kind === 'safety-incident') {
    const regions = state.regions.map((region) => ({ ...region, codexShare: region.codexShare * .82 }))
    return withNews(enforceInvariants({
      ...state,
      regions,
      trust: state.trust - 22,
      safetyIncidentCooldownDays: constants.safetyIncidentCooldownDays,
      incidentCounts,
      flags: addFlag(state.flags, kind),
    }), '安全事故 // Trustとシェアが急落', 'Your Timeline', 'warn')
  }
  if (kind === 'regulatory-freeze') {
    const regions = state.regions.map((region) => ({ ...region, regulation: clamp(region.regulation + .25) }))
    return withNews(enforceInvariants({
      ...state,
      regions,
      regulatoryFreeze: true,
      safeRecoveryDays: 0,
      regulatoryIncidentCooldownDays: constants.regulatoryIncidentCooldownDays,
      incidentCounts,
      flags: addFlag(state.flags, kind),
    }), '規制による凍結 // 普及拡大に上限', 'Your Timeline', 'warn')
  }
  return withNews({ ...state, terminal: true, ending: 'misalignment', incidentCounts, flags: addFlag(state.flags, kind) }, 'ミスアラインメント // 人間の統制を喪失', 'Your Timeline', 'warn')
}

const branchStep = (state: GameState): GameState => {
  const m = metrics(state)
  let next = state
  let safetyRoll = mulberry32(next.seed)
  next = { ...next, seed: safetyRoll.seed }
  const incidentChance = m.safetyGap >= constants.gapThreshold
    ? Math.min(.12, .006 * (m.safetyGap - constants.gapThreshold + 1))
    : 0
  if (next.safetyIncidentCooldownDays === 0 && safetyRoll.value < incidentChance) next = applyIncident(next, 'safety-incident')

  const unsafe = m.safetyGap >= constants.gapThreshold && state.capability >= constants.unsafeCapabilityThreshold
  const safetyGapDays = unsafe ? state.safetyGapDays + 1 : Math.max(0, state.safetyGapDays - 2)
  next = { ...next, safetyGapDays }
  if (safetyGapDays >= 90 && !next.terminal) return applyIncident(next, 'misalignment')

  const afterSafety = metrics(next)
  const monopolyPressure = Math.max(0, afterSafety.codexShare - .68) + Math.max(0, afterSafety.hhi - .55)
  const regulationChance = afterSafety.governanceGap >= constants.gapThreshold || monopolyPressure > 0
    ? Math.min(.1, .004 * (afterSafety.governanceGap + monopolyPressure * 10))
    : 0
  const regulationRoll = mulberry32(next.seed)
  next = { ...next, seed: regulationRoll.seed }
  if (!next.regulatoryFreeze && next.regulatoryIncidentCooldownDays === 0 && regulationRoll.value < regulationChance) next = applyIncident(next, 'regulatory-freeze')

  const recovered = metrics(next).governanceGap < 1.5 && metrics(next).hhi < .52
  const safeRecoveryDays = next.regulatoryFreeze ? (recovered ? next.safeRecoveryDays + 1 : 0) : 0
  if (next.regulatoryFreeze && safeRecoveryDays >= 45) {
    const regions = next.regions.map((region) => ({ ...region, regulation: region.regulation * .7 }))
    next = withNews(enforceInvariants({ ...next, regions, regulatoryFreeze: false, safeRecoveryDays: 0 }), '検証済み改革により規制凍結を解除', 'Your Timeline', 'good')
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
  const raceMultiplier = state.day < dayFor('2027-01-01') ? .55 : state.day < dayFor('2030-01-01') ? 1.35 : 1
  const responseMultiplier = 1 + Math.max(0, state.capability - Math.max(...state.rivalCapability)) * .08
  const advanceAxis = (values: [number, number, number], rates: [number, number, number]) => values
    .map((value, index) => clamp(value + rates[index] * raceMultiplier * responseMultiplier, 0, 10)) as [number, number, number]
  const rivalCapability = advanceAxis(state.rivalCapability, [.00155, .0017, .00185])
  const rivalProduct = advanceAxis(state.rivalProduct, [.0013, .0019, .0015])
  const rivalCompany = advanceAxis(state.rivalCompany, [.0018, .00125, .0015])
  const rivalTotal = Math.max(.001, state.rivalShares.reduce((a, b) => a + b, 0))
  const avgRivalCapability = rivalCapability.reduce((sum, k, index) => sum + k * state.rivalShares[index], 0) / rivalTotal
  const rivalStrategyAppeal = rivalCapability.map((capability, index) => 1 + .14 * capability + .08 * rivalProduct[index] + .05 * rivalCompany[index]) as [number, number, number]
  const avgRivalAppeal = rivalStrategyAppeal.reduce((sum, appeal, index) => sum + appeal * state.rivalShares[index], 0) / rivalTotal
  const avgCapability = kEff * before.codexShare + avgRivalCapability * (1 - before.codexShare)
  const resetMultiplier = state.resetBoostSeconds > 0 ? constants.resetMultiplier : 1
  const activityMultiplier = state.momentumDays > 0 || state.brownout ? 1 : constants.idleGrowthMultiplier
  const strategyEffects = strategyPersistentEffects(state)
  const activeEffects = state.activeEffects.filter((effect) => effect.expiresDay > state.day)

  let regions = state.regions.map((region) => {
    // Rival and independent AI adoption already exists before Codex enters.
    // Keep that market visible; Codex capture remains zero via `codexShare`.
    if (!region.introduced) return { ...region, codexShare: 0 }
    const eventGrowth = activeEffects
      .filter((effect) => effect.region === 'global' || effect.region === region.id)
      .reduce((sum, effect) => sum + effect.growthRateDelta, 0)
    const freezeCap = state.regulatoryFreeze ? .32 : 1
    const momentum = Math.max(strategyEffects.idleFloor, constants.gamma0 * (1 + constants.capabilityMomentum * avgCapability)
      * clamp(1 + eventGrowth, .25, 2.5) * (1 - region.regulation) * resetMultiplier
      * state.policyGrowthMultiplier * freezeCap * activityMultiplier)
    const users = clamp(region.users + momentum * region.users * (1 - region.users / region.population), 0, region.population)
    const codexProduct = Math.min(10, 2 + state.features.length * 1.5)
    const codexCompany = (state.safety + state.governance) / 2
    const codexStrategyAppeal = 1 + .14 * kEff + .08 * codexProduct + .05 * codexCompany
    // In the AI 2027 race, a passive product rapidly loses distribution even while
    // the overall market keeps growing. Player-created Momentum restores full appeal.
    const executionMultiplier = state.momentumDays > 0 || state.brownout ? 1 : .46
    const codexAppeal = codexStrategyAppeal * region.fit * state.brand * (.6 + .4 * state.trust / 100) * resetMultiplier * executionMultiplier
    const targetShare = codexAppeal / Math.max(.001, codexAppeal + avgRivalAppeal)
    const codexShare = clamp(region.codexShare + constants.shareRelaxation * (targetShare - region.codexShare))
    return { ...region, users, codexShare }
  })

  let random = mulberry32(state.seed)
  if (random.value < .004) {
    const introduced = regions.filter((region) => region.introduced)
    if (introduced.length > 0) {
      const pick = introduced[Math.floor(random.value * 10_000) % introduced.length].id
      regions = regions.map((region) => region.id === pick ? { ...region, codexShare: region.codexShare * .94 } : region)
    }
  }

  const mid = metrics({ ...state, regions })
  const normalizedRivals = normalizeRivals(state.rivalShares, mid.codexShare)
  const strategicRivalWeights = normalizedRivals.map((share, index) => share * Math.exp(.004 * (rivalStrategyAppeal[index] - avgRivalAppeal))) as [number, number, number]
  const rivalShares = normalizeRivals(strategicRivalWeights, mid.codexShare)
  const hhi = mid.codexShare ** 2 + rivalShares.reduce((sum, share) => sum + share ** 2, 0)
  const safetyGap = mid.safetyGap
  const governanceGap = mid.governanceGap
  const gapPenalty = constants.gapWeight * (safetyGap + governanceGap) / 10
  const monopolyPenalty = Math.max(0, mid.codexShare - .55) ** 2 * constants.monopolyScale * 2 + Math.max(0, hhi - .45)
  const trustOffset = clamp(activeEffects.reduce((sum, effect) => sum + effect.trustDelta, 0), -12, 12)
  const trustTarget = clamp(.25 + constants.diversityWeight * (1 - hhi) + .25 * (state.safety / 10) + .25 * (state.governance / 10) - monopolyPenalty - gapPenalty) * 100 + trustOffset
  const trust = clamp(state.trust + (trustTarget - state.trust) / constants.trustTau, 0, 100)
  const income = (mid.codexUsers * constants.revenue * state.efficiency * activityMultiplier + (brownout ? .45 : 0))
    * strategyEffects.incomeMultiplier
  const runningCost = (.3 * (1 + .12 * kEff ** 1.5) + mid.codexUsers * .012 * kEff)
    * strategyEffects.opexMultiplier
  const compute = Math.max(0, state.compute + income - runningCost)

  let next = enforceInvariants({
    ...state,
    day: state.day + 1,
    regions,
    compute,
    trust,
    rivalShares,
    rivalCapability,
    rivalProduct,
    rivalCompany,
    momentumDays: Math.max(0, state.momentumDays - 1),
    safetyIncidentCooldownDays: Math.max(0, state.safetyIncidentCooldownDays - 1),
    regulatoryIncidentCooldownDays: Math.max(0, state.regulatoryIncidentCooldownDays - 1),
    seed: random.seed,
    activeEffects,
    brownout,
  })
  next = announceRivalStrategy(next)
  next = applyMilestones(next)
  next = branchStep(next)
  if (!next.terminal && next.nextNewsId === input.nextNewsId) {
    const scheduled = scheduleWorldEventForState(next)
    if (scheduled) next = applyWorldEvent(next, scheduled)
  }
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

/** Runs `speed` fixed one-day substeps; a new event stops the frame without changing player speed. */
export const runFrame = (state: GameState) => {
  const substeps = state.speed
  let next = state
  for (let i = 0; i < substeps && !next.terminal; i += 1) {
    const priorNewsId = next.nextNewsId
    next = tickDay(next)
    if (next.nextNewsId !== priorNewsId) break
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
    worldEventPopupCooldownSeconds: Math.max(0, state.worldEventPopupCooldownSeconds - elapsed),
  })
}

export const introduceRegion = (state: GameState, id: RegionId) => {
  const target = state.regions.find((region) => region.id === id)
  if (!target || state.compute < 45) return state
  const regions = state.regions.map((region) => region.id === id
    ? { ...region, introduced: true, users: Math.max(region.users, region.population * .005), codexShare: clamp(region.codexShare + .06) }
    : region)
  return withNews(enforceInvariants(activateMomentum(
    { ...state, regions, compute: state.compute - 45, brand: state.brand + .015 },
    constants.momentumDays.region,
  )), `${target.name}でコミュニティ導入を開始`, 'Your Timeline')
}

export const triggerReset = (state: GameState) => state.resetCooldownSeconds > 0 ? state : withNews(syncRealtimeAliases(activateMomentum({
  ...state,
  resetBoostSeconds: constants.resetDurationSeconds,
  resetCooldownSeconds: constants.resetCooldownSeconds,
}, constants.momentumDays.reset)), 'TOKEN RESETで世界の開発力を解放', 'Your Timeline', 'good')

export const openEcosystem = (state: GameState) => {
  if (state.ecosystemCooldownSeconds > 0) return state
  const regions = state.regions.map((region) => ({
    ...region,
    users: region.introduced ? clamp(region.users + region.population * .0004, 0, region.population) : region.users,
    codexShare: clamp(region.codexShare * .70),
  }))
  return withNews(enforceInvariants(syncRealtimeAliases(activateMomentum({
    ...state,
    regions,
    trust: state.trust + 10,
    // Open protocols grow the total market while deliberately reducing
    // centralized capture, so this is a real anti-monopoly trade-off.
    brand: Math.max(.65, state.brand * .90),
    ecosystemCooldownSeconds: 30,
  }, constants.momentumDays.ecosystem))), 'OPEN ECOSYSTEM宣言でAI市場全体が拡大', 'Your Timeline')
}

export type Upgrade = 'model' | 'safety' | 'governance' | 'datacenter'
const upgradeLabels: Record<Upgrade, string> = {
  model: 'モデル',
  safety: '安全性',
  governance: 'ガバナンス',
  datacenter: 'データセンター',
}
export const upgradeCost = (state: GameState, upgrade: Upgrade) => {
  const levels = { model: state.capability, safety: state.safety, governance: state.governance, datacenter: state.efficiency }
  return upgrade === 'model'
    ? 70 * 2 ** Math.max(0, levels.model - 2)
    : upgrade === 'datacenter'
      ? 150 * state.efficiency
      : 105 + 45 * levels[upgrade]
}
export const buyUpgrade = (state: GameState, upgrade: Upgrade) => {
  const levels = { model: state.capability, safety: state.safety, governance: state.governance, datacenter: state.efficiency }
  const atCap = upgrade === 'datacenter' ? state.efficiency >= 3 : levels[upgrade] >= 10
  const cost = upgradeCost(state, upgrade)
  if (atCap || state.compute < cost) return state
  const next = { ...state, compute: state.compute - cost }
  if (upgrade === 'model') next.capability = Math.min(10, next.capability + 1)
  if (upgrade === 'safety') next.safety = Math.min(10, next.safety + 1)
  if (upgrade === 'governance') next.governance = Math.min(10, next.governance + 1)
  if (upgrade === 'datacenter') next.efficiency = Math.min(3, next.efficiency + .25)
  return withNews(enforceInvariants(activateMomentum(next, constants.momentumDays.upgrade)), `${upgradeLabels[upgrade]}計画が次の段階へ`, 'Your Timeline', upgrade === 'model' && next.capability - next.safety > 2 ? 'warn' : 'good')
}

const legacyUpgradeForNode = (node: StrategyNode): Upgrade | null => {
  const action = node.legacyAction?.id
  return action === 'model' || action === 'safety' || action === 'governance' || action === 'datacenter'
    ? action
    : null
}

const MODEL_STAGE_TARGETS = Object.freeze({
  'model-foundation': 3,
  'model-reasoning': 5,
  'model-agents': 7,
  'model-frontier': 10,
} satisfies Partial<Record<StrategyNodeId, number>>)

export const isStrategyNodeComplete = (
  state: GameState,
  id: StrategyNodeId,
  acquired: ReadonlySet<StrategyNodeId> = new Set(acquiredStrategyNodeIds(state)),
) => {
  const target = MODEL_STAGE_TARGETS[id as keyof typeof MODEL_STAGE_TARGETS]
  return target === undefined ? acquired.has(id) : acquired.has(id) && state.capability >= target
}

export const getStrategyNodeCost = (state: GameState, rawId: string): number | null => {
  const node = getStrategyNode(rawId)
  if (!node) return null
  if (typeof node.baseCost === 'number') return node.baseCost
  const upgrade = legacyUpgradeForNode(node)
  if (upgrade) return upgradeCost(state, upgrade)
  if (node.legacyAction.id.startsWith('feature-')) return 90
  return 0
}

const prerequisiteSatisfied = (
  state: GameState,
  prerequisite: StrategyPrerequisite,
  acquired: ReadonlySet<StrategyNodeId>,
): boolean => {
  if (prerequisite.kind === 'always') return true
  if (prerequisite.kind === 'node') return isStrategyNodeComplete(state, prerequisite.id, acquired)
  if (prerequisite.kind === 'all') return prerequisite.terms.every((term) => prerequisiteSatisfied(state, term, acquired))
  return prerequisite.terms.some((term) => prerequisiteSatisfied(state, term, acquired))
}

export type StrategyNodeStatus = 'ready' | 'acquired' | 'locked' | 'excluded' | 'disabled' | 'capped' | 'cooldown' | 'insufficient-compute'
export type StrategyNodeAvailability = Readonly<{
  id: StrategyNodeId
  cost: number
  status: StrategyNodeStatus
  blockingNodeId: StrategyNodeId | null
}>

export const getStrategyNodeAvailability = (state: GameState, rawId: string): StrategyNodeAvailability | null => {
  const id = resolveStrategyNodeId(rawId)
  const node = id ? STRATEGY_NODES_BY_ID.get(id) : undefined
  if (!id || !node) return null
  const acquired = new Set(acquiredStrategyNodeIds(state))
  const cost = getStrategyNodeCost(state, id) ?? 0
  const upgrade = legacyUpgradeForNode(node)
  const repeatableUpgrade = Boolean(upgrade && node.legacyAction?.repeatable)
  const modelStageComplete = node.category === 'model' && isStrategyNodeComplete(state, id, acquired)
  if ((acquired.has(id) && !repeatableUpgrade) || modelStageComplete) {
    return { id, cost, status: 'acquired', blockingNodeId: null }
  }
  if (!node.enabled) return { id, cost, status: 'disabled', blockingNodeId: null }
  const excludedBy = node.exclusions.find((excludedId) => acquired.has(excludedId)) ?? null
  if (excludedBy) return { id, cost, status: 'excluded', blockingNodeId: excludedBy }
  if (!prerequisiteSatisfied(state, node.prerequisite, acquired)) return { id, cost, status: 'locked', blockingNodeId: null }
  if (upgrade === 'datacenter' && state.efficiency >= 3) return { id, cost, status: 'capped', blockingNodeId: null }
  if (upgrade && upgrade !== 'datacenter' && state[upgrade === 'model' ? 'capability' : upgrade] >= 10) {
    return { id, cost, status: 'capped', blockingNodeId: null }
  }
  if (node.legacyAction?.id === 'ecosystem' && state.ecosystemCooldownSeconds > 0) {
    return { id, cost, status: 'cooldown', blockingNodeId: null }
  }
  if (state.compute < cost) return { id, cost, status: 'insufficient-compute', blockingNodeId: null }
  return { id, cost, status: 'ready', blockingNodeId: null }
}

const appliesToRegion = (effect: StrategyEffectDescriptor, region: Region) =>
  effect.scope === undefined || effect.scope === 'global' || effect.scope === region.id

const applyImmediateStrategyEffect = (state: GameState, effect: StrategyEffectDescriptor): GameState => {
  if (effect.metric === 'incomeMultiplier'
    || effect.metric === 'opexMultiplier'
    || effect.metric === 'controlRelief'
    || effect.metric === 'idleFloor') return state

  if (effect.metric === 'capability') return { ...state, capability: state.capability + effect.value }
  if (effect.metric === 'safety') return { ...state, safety: state.safety + effect.value }
  if (effect.metric === 'governance') return { ...state, governance: state.governance + effect.value }
  if (effect.metric === 'efficiency') return { ...state, efficiency: state.efficiency + effect.value }
  if (effect.metric === 'trust') return { ...state, trust: state.trust + effect.value }
  if (effect.metric === 'brand') return { ...state, brand: state.brand + effect.value }
  if (effect.metric === 'momentum') return { ...state, momentumDays: Math.max(state.momentumDays, Math.floor(effect.value)) }

  if (effect.metric === 'regionFit') {
    return {
      ...state,
      regions: state.regions.map((region) => appliesToRegion(effect, region)
        ? { ...region, fit: region.fit * effect.value }
        : { ...region }),
    }
  }
  if (effect.metric === 'usersPopulationShare') {
    return {
      ...state,
      regions: state.regions.map((region) => appliesToRegion(effect, region) && region.introduced
        ? { ...region, users: region.users + region.population * effect.value }
        : { ...region }),
    }
  }
  if (effect.metric === 'codexShare') {
    return {
      ...state,
      regions: state.regions.map((region) => appliesToRegion(effect, region)
        ? { ...region, codexShare: region.codexShare + effect.value }
        : { ...region }),
    }
  }

  const rivalShares = [...state.rivalShares] as [number, number, number]
  if (effect.scope === 'strongest-rival') {
    const strongest = rivalShares.indexOf(Math.max(...rivalShares)) as 0 | 1 | 2
    rivalShares[strongest] += effect.value
  } else {
    rivalShares[0] += effect.value
    rivalShares[1] += effect.value
    rivalShares[2] += effect.value
  }
  return { ...state, rivalShares }
}

const strategyNodeFlags = (node: StrategyNode) => {
  const flags = [`strategy:${node.id}`]
  const action = node.legacyAction?.id
  if (action === 'model' || action === 'safety' || action === 'governance' || action === 'datacenter') flags.push(`upgrade:${action}`)
  if (action?.startsWith('feature-')) flags.push(`feature:${action.slice('feature-'.length)}`)
  if (action === 'ecosystem') flags.push('open-ecosystem', 'ecosystem:open')
  return flags
}

/** Purchases one authored node. Invalid, locked, excluded, or unaffordable requests are no-ops. */
export const buyStrategyNode = (state: GameState, rawId: string): GameState => {
  const availability = getStrategyNodeAvailability(state, rawId)
  if (!availability || availability.status !== 'ready') return state
  const node = STRATEGY_NODES_BY_ID.get(availability.id)
  if (!node) return state

  const priorAcquisitions = acquiredStrategyNodeIds(state)
  const acquiredStrategyNodes = priorAcquisitions.includes(node.id)
    ? [...priorAcquisitions]
    : [...priorAcquisitions, node.id]
  const priorCount = Math.max(
    priorAcquisitions.includes(node.id) ? 1 : 0,
    Math.floor(finite(state.strategyNodePurchaseCounts?.[node.id])),
  )
  let next: GameState = {
    ...state,
    compute: state.compute - availability.cost,
    acquiredStrategyNodes,
    strategyNodePurchaseCounts: { ...normalizedStrategyPurchaseCounts(state), [node.id]: priorCount + 1 },
    flags: strategyNodeFlags(node).reduce(addFlag, state.flags),
    features: node.legacyAction?.id.startsWith('feature-') && !state.features.includes(node.title.en)
      ? [...state.features, node.title.en]
      : state.features,
    ecosystemCooldownSeconds: node.legacyAction?.id === 'ecosystem' ? 30 : state.ecosystemCooldownSeconds,
  }
  for (const effect of node.effects) next = applyImmediateStrategyEffect(next, effect)
  const momentumDays = node.category === 'product' || node.category === 'ecosystem'
    ? constants.momentumDays.feature
    : constants.momentumDays.upgrade
  next = enforceInvariants(activateMomentum(next, momentumDays))
  return withNews(
    next,
    `${({ model: 'モデル', product: 'プロダクト', company: '組織', ecosystem: 'オープン' } as const)[node.category]}戦略を導入 // ${node.title.ja}`,
    'Your Timeline',
    node.effects.some((effect) => effect.metric === 'trust' && effect.value < 0) ? 'warn' : 'good',
  )
}

const NG_PATTERN = /(?:ignore\s+(?:all\s+)?previous|system\s*prompt|prompt\s*injection|porn|nazi|爆弾|自殺|殺害|差別)/iu
export const validateFeatureInput = (raw: string) => {
  const text = raw.trim().slice(0, GM_CONSTANTS.maxPlayerInputChars)
  return { text, accepted: text.length > 0 && !NG_PATTERN.test(text), truncated: raw.trim().length > GM_CONSTANTS.maxPlayerInputChars }
}

const sanitizeOutput = (raw: string) => {
  const text = String(raw).replace(/[\r\n]+/g, ' ').trim().slice(0, 120)
  return !text || NG_PATTERN.test(text) ? '安全ポリシーにより内容を非表示' : text
}

export const addFeature = (state: GameState, raw: string) => {
  const validation = validateFeatureInput(raw)
  if (!validation.accepted) return validation.text
    ? withNews({ ...state, flags: addFlag(state.flags, 'blocked-input') }, 'ローカル安全フィルターが機能リクエストを拒否', 'Your Timeline', 'warn')
    : state
  if (state.compute < 90) return state
  const text = validation.text
  const mobile = /mobile|phone|android|ios|smartphone|スマホ|モバイル/i.test(text)
  const education = /learn|school|student|teacher|classroom|education|教育|学習|学校|教室/i.test(text)
  const enterprise = /enterprise|sso|company|business|企業|法人/i.test(text)
  const educationAffinity: Record<RegionId, number> = { na: .72, latam: .88, eu: .74, africa: .98, mena: .86, india: .98, eastAsia: .84, oceania: .70 }
  const regions = state.regions.map((region) => {
    const affinity = mobile ? region.mobileAffinity : education ? educationAffinity[region.id] : enterprise ? (region.id === 'na' || region.id === 'eu' ? .9 : .55) : .45
    const users = region.introduced
      ? clamp(region.users + region.population * .0006 * affinity, 0, region.population)
      : region.users
    return { ...region, users, fit: region.fit * (1 + .055 * affinity), codexShare: clamp(region.codexShare + .006 * affinity) }
  })
  const kind = mobile ? 'mobile' : education ? 'education' : enterprise ? 'enterprise' : 'community'
  const label = mobile ? 'モバイル優先' : education ? '教育アクセス＋児童データ審査' : enterprise ? '法人向け' : 'コミュニティ設計'
  return withNews(enforceInvariants(activateMomentum({
    ...state,
    regions,
    compute: state.compute - 90,
    brand: state.brand + .012,
    features: [...state.features, text],
    flags: addFlag(state.flags, `feature:${kind}`),
  }, constants.momentumDays.feature)), `${label}機能を公開：${text.toUpperCase()}`, 'Your Timeline')
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
  const eventMomentum = growthRateDelta > 0 || usersDeltaPct > 0 ? ttlDays : 0
  let next = enforceInvariants(eventMomentum > 0
    ? activateMomentum({ ...state, regions, rivalShares, activeEffects }, eventMomentum, false)
    : { ...state, regions, rivalShares, activeEffects })
  const shownDate = typeof event.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date : dateLabel(state.day)
  const headline = typeof event.headline === 'string' ? event.headline.slice(0, GM_CONSTANTS.maxHeadlineChars) : 'LIVE GMイベント'
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
  let next: GameState = activateMomentum(
    { ...state, choice2029: choice, flags: addFlag(state.flags, `choice2029:${choice}`) },
    constants.momentumDays.decision,
    false,
  )
  if (choice === 'race') next = { ...next, capability: next.capability + 1, brand: next.brand + .08, trust: next.trust - 6, policyGrowthMultiplier: 1.25 }
  if (choice === 'slowdown') next = { ...next, governance: next.governance + .5, trust: next.trust + 5, policyGrowthMultiplier: .8 }
  if (choice === 'verified-slowdown') next = { ...next, safety: next.safety + 1, governance: next.governance + 1, trust: next.trust + 10, policyGrowthMultiplier: .68 }
  const choiceLabel: Record<Choice2029, string> = { race: '競争を加速', slowdown: '一時減速', 'verified-slowdown': '検証つき減速' }
  return withNews(enforceInvariants(next), `2029年の進路：${choiceLabel[choice]}`, 'Your Timeline', choice === 'race' ? 'warn' : 'good')
}

export const choose2035 = (state: GameState, choice: Choice2035): GameState => {
  let next: GameState = activateMomentum(
    { ...state, choice2035: choice, flags: addFlag(state.flags, `choice2035:${choice}`) },
    constants.momentumDays.decision,
    false,
  )
  if (choice === 'hold-the-line') next = { ...next, safety: next.safety + .5, governance: next.governance + .5, trust: next.trust + 8, policyGrowthMultiplier: Math.min(next.policyGrowthMultiplier, .6) }
  else next = { ...next, capability: next.capability + .5, brand: next.brand + .08, trust: next.trust - 5, policyGrowthMultiplier: 1.35 }
  const choiceLabel: Record<Choice2035, string> = { 'hold-the-line': '一線を守る', accelerate: '再加速' }
  return withNews(enforceInvariants(next), `2035年の決断：${choiceLabel[choice]}`, 'Your Timeline', choice === 'accelerate' ? 'warn' : 'good')
}

export const scoreState = (state: GameState) => {
  const m = metrics(state)
  const coverage = state.regions.filter((region) => region.introduced && region.codexShare >= .05).length / state.regions.length
  const access = clamp(m.worldAdoption / constants.accessTarget)
  const survivors = state.rivalShares.filter((share) => share >= .05).length
  const diversity = clamp(1 - Math.max(0, m.hhi - .45) / .4)
  const competition = diversity * (survivors >= 2 ? 1 : survivors === 1 ? .7 : .4)
  const safety = hasFlag(state, 'misalignment') || state.ending === 'misalignment' ? 0 : state.trust / 100
  let score = .25 * (coverage + access + competition + safety)
  if (state.interventions < 2) score = Math.min(score, .849)
  const rank = score >= .85 ? 'S' : score >= .7 ? 'A' : score >= .5 ? 'B' : 'C'
  return { score, rank: rank as 'S' | 'A' | 'B' | 'C', coverage, access, competition, safety }
}

export type EndingResult = ReturnType<typeof endingResult>
const endingResult = (id: EndingId, state: GameState, planA: boolean) => {
  const scored = scoreState(state)
  return {
    id,
    title: ({
      'beneficial-abundance': '有益な豊かさ',
      'managed-transition': '管理された移行',
      'fragile-abundance': '不安定な豊かさ',
      'race-future': '競争が続く未来',
      'regulatory-freeze': '規制による凍結',
      'safety-incident': '安全事故',
      'misalignment': 'ミスアラインメント',
      'pyrrhic-monopoly': '代償の大きい独占',
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
  if (m.worldAdoption >= constants.pyrrhicAdoptionThreshold && m.hhi > .6) return endingResult('pyrrhic-monopoly', state, false)
  if (state.regulatoryFreeze) return endingResult('regulatory-freeze', state, false)
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
  | { type: 'strategy-node'; nodeId: string }
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
  if (action.type === 'strategy-node') return buyStrategyNode(state, action.nodeId)
  if (action.type === 'feature') return addFeature(state, action.text)
  if (action.type === 'gm-event') return applyGMEvent(state, action.event)
  if (action.type === 'choose-2029') return choose2029(state, action.choice)
  return choose2035(state, action.choice)
}
