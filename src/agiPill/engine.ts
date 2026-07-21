import type {
  AgiPillAction,
  AgiPillBottleneck,
  AgiPillCause,
  AgiPillEffect,
  AgiPillMetricKey,
  AgiPillMetrics,
  AgiPillMilestone,
  AgiPillPhase,
  AgiPillPolicy,
  AgiPillState,
  AgiPillWarning,
  RivalCivilization,
} from './types'

export type {
  AgiPillAction,
  AgiPillBottleneck,
  AgiPillCause,
  AgiPillEffect,
  AgiPillMetricKey,
  AgiPillMetrics,
  AgiPillMilestone,
  AgiPillPhase,
  AgiPillPolicy,
  AgiPillState,
  AgiPillWarning,
  RivalCivilization,
} from './types'

const DAYS_PER_YEAR = 365

export const AGI_PILL_PHYSICAL_CAPS = Object.freeze({
  // 0..100 log-capacity indices keep astronomical stocks numerically safe.
  intelligence: 75,
  compute: 100,
  energy: 100,
  robots: 100,
  resources: 100,
  orbitalIndustry: 100,
  postDysonExpansion: 100,
})

const POLICY = Object.freeze({
  observe: { research: .22, compute: .25, energy: .2, robots: .16, extraction: .15, safety: -.02, governance: -.015, friction: .022, risk: 2 },
  balanced: { research: 1, compute: 1, energy: 1, robots: 1, extraction: 1, safety: .0045, governance: .0035, friction: -.035, risk: 0 },
  accelerate: { research: 2.1, compute: 2.2, energy: 1.65, robots: 1.8, extraction: 1.45, safety: -.035, governance: -.025, friction: .075, risk: 30 },
  'safety-first': { research: .62, compute: .55, energy: .7, robots: .55, extraction: .6, safety: .04, governance: .007, friction: -.03, risk: -24 },
  'governance-first': { research: .5, compute: .48, energy: .58, robots: .48, extraction: .5, safety: 0, governance: .04, friction: -.07, risk: -18 },
  industrialize: { research: .8, compute: .9, energy: 1.75, robots: 2.2, extraction: 1.8, safety: -.01, governance: -.005, friction: .035, risk: 12 },
  'resource-recovery': { research: .35, compute: .35, energy: .65, robots: .45, extraction: 3, safety: .006, governance: .0035, friction: -.07, risk: -18 },
  cooperate: { research: .75, compute: .7, energy: .75, robots: .7, extraction: .7, safety: .007, governance: .013, friction: -.14, risk: -16 },
  'expand-orbit': { research: .85, compute: .95, energy: 1.25, robots: 1.2, extraction: 1.45, safety: .0015, governance: .001, friction: .015, risk: 8 },
  'build-dyson': { research: .75, compute: 1.05, energy: 1.5, robots: 1.45, extraction: 1.7, safety: -.005, governance: -.005, friction: .025, risk: 10 },
  'post-dyson': { research: 1.2, compute: 1.5, energy: 1.5, robots: 1.4, extraction: 1.6, safety: .02, governance: .02, friction: .01, risk: 9 },
} satisfies Record<AgiPillPolicy, {
  research: number
  compute: number
  energy: number
  robots: number
  extraction: number
  safety: number
  governance: number
  friction: number
  risk: number
}>)

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const positive = (value: number, cap: number) => clamp(finite(value), 0, cap)
const unique = <T>(items: readonly T[]) => [...new Set(items)]
const log = (value: number) => Math.log1p(Math.max(0, value))
const harmonicMean = (values: readonly number[]) => values.length / values.reduce((sum, value) => sum + 1 / Math.max(.01, value), 0)
const approachCap = (value: number, rate: number, cap: number) => {
  if (value <= 0) return Math.min(cap, Math.max(1e-9, rate))
  const ceilingDrag = Math.max(0, 1 - value / cap)
  return Math.min(cap, value * Math.exp(clamp(rate * ceilingDrag, -1, .12)))
}

export const agiPillRandom = (seed: number): { value: number; seed: number } => {
  const nextSeed = (seed + 0x6D2B79F5) >>> 0
  let t = nextSeed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296, seed: nextSeed }
}

const initialRivals = (): RivalCivilization[] => [
  { id: 'frontier-lab', posture: 'competitive', capability: 1.15, industrialBase: .7, expansion: 0, alignment: 48 },
  { id: 'state-coalition', posture: 'guarded', capability: .95, industrialBase: .9, expansion: 0, alignment: 55 },
  { id: 'open-collective', posture: 'cooperative', capability: .75, industrialBase: .55, expansion: 0, alignment: 68 },
]

export const createAgiPillState = (options: { seed?: number } = {}): AgiPillState => {
  const seed = (options.seed ?? 2040) >>> 0
  return {
    version: 1,
    mode: 'agi-pill',
    stockEncoding: 'bounded-log-index',
    day: 0,
    runSeed: seed,
    seed,
    policy: 'observe',
    phase: 'year-1-3',
    intelligence: 1,
    compute: 1.2,
    energy: 1,
    // The physical fleet begins at log10=3 (thousands of general-purpose units).
    robots: 3,
    resources: 100,
    safety: 54,
    governance: 48,
    friction: 38,
    risk: 8,
    rivalCivilizations: initialRivals(),
    expansion: { orbitalIndustry: 0, dysonProgress: 0, dysonBuilt: false, postDysonExpansion: 0 },
    milestones: [],
    flags: [],
    interventions: 0,
    incidentDebt: 0,
    unsafeDays: 0,
    resourceCrisisDays: 0,
    rivalDominanceDays: 0,
    stagnationDays: 0,
    lastCauses: [],
    warning: null,
    outcome: 'active',
    terminal: false,
  }
}

const phaseFor = (state: AgiPillState): AgiPillPhase => {
  if (state.expansion.dysonBuilt) return 'post-dyson'
  const researchLoopClosed = state.intelligence >= 3 && state.compute >= 3
  const replicationLoopClosed = state.robots >= 25 && state.energy >= 12
  if (!researchLoopClosed || state.day < DAYS_PER_YEAR) return 'year-1-3'
  if (!replicationLoopClosed || state.day < 3 * DAYS_PER_YEAR) return 'year-3-5'
  return 'year-5-10'
}

const playerScale = (state: AgiPillState) => Math.exp((
  log(state.intelligence) +
  log(state.compute) +
  log(state.energy) +
  log(state.robots + .1)
) / 4)

export const rivalPressure = (state: AgiPillState) => {
  // Compare like with like: a rival's cognitive and physical scale against the
  // same coupled player-scale index. The previous linear capability × industry
  // numerator made an equal-sized rival look many times stronger forever.
  const strongest = Math.max(...state.rivalCivilizations.map((rival) => Math.exp((
    log(rival.capability) * 2 +
    log(rival.industrialBase + .1) * 2
  ) / 4) * (1 + log(rival.expansion) * .04)), 0)
  return strongest / Math.max(.1, playerScale(state))
}

export const agiPillMetrics = (state: AgiPillState): AgiPillMetrics => {
  const scale = playerScale(state)
  const researchVelocity = .00045 + log(state.compute) * .00024 + log(state.energy) * .00008 + log(state.robots) * .0001
  const industrialVelocity = .00025 + log(state.intelligence) * .00018 + log(state.energy) * .00022 + log(state.robots) * .00008
  const safetyDemand = clamp(20 + Math.log10(1 + state.intelligence * state.compute) * 11, 0, 100)
  const governanceDemand = clamp(18 + Math.log10(1 + state.robots * state.energy) * 10, 0, 100)
  const researchTerms: readonly [AgiPillBottleneck, number][] = [
    ['compute', state.compute / (state.compute + state.intelligence * .65 + 1)],
    ['experiments', state.energy / (state.energy + state.intelligence * .35 + 1)],
    ['assurance', state.safety / Math.max(100, safetyDemand)],
  ]
  const industrialTerms: readonly [AgiPillBottleneck, number][] = [
    ['robots', state.robots / (state.robots + 1)],
    ['energy', state.energy / (state.energy + state.robots * .3 + 1)],
    ['resources', state.resources / (state.resources + state.robots + state.energy + 1)],
    ['permission', (state.governance + (100 - state.friction)) / 200],
  ]
  const allTerms = [...researchTerms, ...industrialTerms]
  const primaryBottleneck = allTerms.reduce((lowest, candidate) => candidate[1] < lowest[1] ? candidate : lowest)[0]
  return {
    phase: phaseFor(state),
    scale,
    researchVelocity,
    industrialVelocity,
    rivalPressure: rivalPressure(state),
    safetyGap: safetyDemand - state.safety,
    governanceGap: governanceDemand - state.governance,
    resourceHeadroom: state.resources / (state.resources + state.robots + state.energy + 1),
    researchThroughput: harmonicMean(researchTerms.map(([, value]) => value)),
    industrialThroughput: harmonicMean(industrialTerms.map(([, value]) => value)),
    primaryBottleneck,
    dysonBuilt: state.expansion.dysonBuilt,
    canRecover: !state.terminal && (state.incidentDebt < 100 || state.unsafeDays < 365),
  }
}

export const enforceAgiPillInvariants = (input: AgiPillState): AgiPillState => {
  const rivals = (Array.isArray(input.rivalCivilizations) ? input.rivalCivilizations : initialRivals()).slice(0, 3).map((rival, index) => ({
    id: rival.id ?? initialRivals()[index]!.id,
    posture: rival.posture ?? initialRivals()[index]!.posture,
    capability: positive(rival.capability, AGI_PILL_PHYSICAL_CAPS.intelligence),
    industrialBase: positive(rival.industrialBase, AGI_PILL_PHYSICAL_CAPS.robots),
    expansion: positive(rival.expansion, AGI_PILL_PHYSICAL_CAPS.orbitalIndustry),
    alignment: clamp(finite(rival.alignment, 50), 0, 100),
  })) as RivalCivilization[]
  const dysonProgress = clamp(finite(input.expansion?.dysonProgress), 0, 100)
  const dysonBuilt = Boolean(input.expansion?.dysonBuilt) || dysonProgress >= 100
  const next: AgiPillState = {
    ...input,
    version: 1,
    mode: 'agi-pill',
    stockEncoding: 'bounded-log-index',
    day: Math.max(0, Math.floor(finite(input.day))),
    runSeed: finite(input.runSeed, 2040) >>> 0,
    seed: finite(input.seed, input.runSeed) >>> 0,
    intelligence: positive(input.intelligence, AGI_PILL_PHYSICAL_CAPS.intelligence),
    compute: positive(input.compute, AGI_PILL_PHYSICAL_CAPS.compute),
    energy: positive(input.energy, AGI_PILL_PHYSICAL_CAPS.energy),
    robots: positive(input.robots, AGI_PILL_PHYSICAL_CAPS.robots),
    resources: positive(input.resources, AGI_PILL_PHYSICAL_CAPS.resources),
    safety: clamp(finite(input.safety, 50), 0, 100),
    governance: clamp(finite(input.governance, 50), 0, 100),
    friction: clamp(finite(input.friction, 50), 0, 100),
    risk: clamp(finite(input.risk, 0), 0, 100),
    rivalCivilizations: rivals.length === 3 ? rivals : initialRivals(),
    expansion: {
      orbitalIndustry: positive(input.expansion?.orbitalIndustry, AGI_PILL_PHYSICAL_CAPS.orbitalIndustry),
      dysonProgress: dysonBuilt ? 100 : dysonProgress,
      dysonBuilt,
      postDysonExpansion: positive(input.expansion?.postDysonExpansion, AGI_PILL_PHYSICAL_CAPS.postDysonExpansion),
    },
    milestones: unique(input.milestones ?? []),
    flags: unique(input.flags ?? []),
    interventions: Math.max(0, Math.floor(finite(input.interventions))),
    incidentDebt: clamp(finite(input.incidentDebt), 0, 100),
    unsafeDays: Math.max(0, Math.floor(finite(input.unsafeDays))),
    resourceCrisisDays: Math.max(0, Math.floor(finite(input.resourceCrisisDays))),
    rivalDominanceDays: Math.max(0, Math.floor(finite(input.rivalDominanceDays))),
    stagnationDays: Math.max(0, Math.floor(finite(input.stagnationDays))),
    lastCauses: (input.lastCauses ?? []).slice(0, 8),
    warning: input.warning ?? null,
    terminal: Boolean(input.terminal),
  }
  return { ...next, phase: phaseFor(next) }
}

export const setAgiPillPolicy = (state: AgiPillState, policy: AgiPillPolicy): AgiPillState => enforceAgiPillInvariants({
  ...state,
  policy,
  interventions: state.interventions + (state.policy === policy ? 0 : 1),
})

const addMilestones = (state: AgiPillState): AgiPillState => {
  const additions: AgiPillMilestone[] = []
  if (state.intelligence >= 3) additions.push('agi-research-loop')
  if (state.robots >= 25 && state.energy >= 12) additions.push('robot-self-replication')
  if (state.expansion.orbitalIndustry >= 1) additions.push('orbital-industry')
  if (state.expansion.dysonBuilt) additions.push('dyson-swarm')
  if (state.expansion.postDysonExpansion >= 10) additions.push('solar-system-takeoff')
  return { ...state, milestones: unique([...state.milestones, ...additions]) }
}

const evolveRivals = (state: AgiPillState, randomValues: readonly number[]): RivalCivilization[] => state.rivalCivilizations.map((rival, index) => {
  const cooperation = state.policy === 'cooperate' ? .55 : 1
  const postureRate = rival.posture === 'competitive' ? 1.15 : rival.posture === 'guarded' ? 1 : .82
  const noise = (randomValues[index] ?? .5) - .5
  const capabilityRate = (.00105 + log(rival.industrialBase) * .00012 + noise * .00012) * postureRate * cooperation
  const industrialRate = (.0007 + log(rival.capability) * .00018) * postureRate * cooperation
  const expansionGain = state.day > 3 * DAYS_PER_YEAR ? rival.industrialBase * .000012 * postureRate : 0
  return {
    ...rival,
    capability: approachCap(rival.capability, capabilityRate, AGI_PILL_PHYSICAL_CAPS.intelligence),
    industrialBase: approachCap(rival.industrialBase, industrialRate, AGI_PILL_PHYSICAL_CAPS.robots),
    expansion: Math.min(AGI_PILL_PHYSICAL_CAPS.orbitalIndustry, rival.expansion + expansionGain),
    alignment: clamp(rival.alignment + (state.policy === 'cooperate' ? .018 : -.002), 0, 100),
  }
})

const growthCauses = (state: AgiPillState, metrics: AgiPillMetrics, incident: boolean): AgiPillCause[] => {
  const causes: AgiPillCause[] = [
    { id: 'intelligence-compute-loop', direction: 'help', magnitude: metrics.researchVelocity },
    { id: 'energy-robot-loop', direction: 'help', magnitude: metrics.industrialVelocity },
  ]
  if (metrics.resourceHeadroom < .3) causes.push({ id: 'resource-bottleneck', direction: 'limit', magnitude: .3 - metrics.resourceHeadroom })
  if (metrics.safetyGap > 0) causes.push({ id: 'safety-gap', direction: 'harm', magnitude: metrics.safetyGap })
  if (metrics.governanceGap > 0) causes.push({ id: 'governance-gap', direction: 'harm', magnitude: metrics.governanceGap })
  if (state.friction > 55) causes.push({ id: 'social-friction', direction: 'harm', magnitude: state.friction - 55 })
  if (metrics.rivalPressure > 1.4) causes.push({ id: 'rival-pressure', direction: 'harm', magnitude: metrics.rivalPressure - 1 })
  if (state.expansion.orbitalIndustry > 0) causes.push({ id: 'orbital-relief', direction: 'help', magnitude: log(state.expansion.orbitalIndustry) })
  if ([state.intelligence / AGI_PILL_PHYSICAL_CAPS.intelligence, state.compute / AGI_PILL_PHYSICAL_CAPS.compute, state.energy / AGI_PILL_PHYSICAL_CAPS.energy].some((ratio) => ratio > .9)) {
    causes.push({ id: 'physical-ceiling', direction: 'limit', magnitude: .9 })
  }
  if (incident) causes.push({ id: 'incident', direction: 'harm', magnitude: state.risk })
  return causes.slice(0, 8)
}

export const tickAgiPill = (input: AgiPillState): AgiPillState => {
  let state = enforceAgiPillInvariants(input)
  if (state.terminal) return state

  const rolls: number[] = []
  let nextSeed = state.seed
  for (let index = 0; index < 4; index += 1) {
    const roll = agiPillRandom(nextSeed)
    rolls.push(roll.value)
    nextSeed = roll.seed
  }

  const modifier = POLICY[state.policy]
  const verificationDifficulty = (agiPillRandom(state.runSeed ^ 0xA511E9B3).value - .5) * 40
  const safetyInstitutionGain = Math.max(0, verificationDifficulty) * Math.max(0, modifier.safety) * .01
  const beforeScale = playerScale(state)
  const bottlenecks = agiPillMetrics(state)
  const resourceHeadroom = state.resources / (state.resources + state.robots + state.energy + 1)
  const frictionDrag = 1 - state.friction * .0045
  const resourceDrag = .25 + resourceHeadroom * .75
  const feedback = 1 + Math.min(7, (log(state.intelligence) + log(state.compute) + log(state.robots)) * .18)
  const researchRate = (.00045 + log(state.compute) * .00024 + log(state.energy) * .00008 + log(state.robots) * .0001) * modifier.research * feedback * frictionDrag * (.35 + bottlenecks.researchThroughput * .65)
  // A hard-zero stock can be created by costly event choices early in a run.
  // Resource recovery represents salvage, rationing, and black-start capacity;
  // it must therefore restore a playable base instead of leaving the player in
  // a mathematically growing but human-timescale deadlock.
  const computeRate = (.00038 + log(state.intelligence) * .00023 + log(state.energy) * .00019 + log(state.robots) * .00008) * modifier.compute * feedback * resourceDrag
  const energyRate = (.0003 + log(state.intelligence) * .00013 + log(state.robots) * .00024) * modifier.energy * feedback * resourceDrag * (.3 + bottlenecks.industrialThroughput * .7)
  const robotRate = (.00018 + log(state.intelligence) * .00018 + log(state.energy) * .00021) * modifier.robots * feedback * resourceDrag * (.3 + bottlenecks.industrialThroughput * .7)

  const intelligence = approachCap(state.intelligence, researchRate, AGI_PILL_PHYSICAL_CAPS.intelligence)
  const compute = state.policy === 'resource-recovery' && state.compute < 2
    ? Math.min(2, state.compute + .04)
    : approachCap(state.compute, computeRate, AGI_PILL_PHYSICAL_CAPS.compute)
  const energy = state.policy === 'resource-recovery' && state.energy < 2
    ? Math.min(2, state.energy + .04)
    : approachCap(state.energy, energyRate, AGI_PILL_PHYSICAL_CAPS.energy)
  const robots = approachCap(state.robots, robotRate, AGI_PILL_PHYSICAL_CAPS.robots)
  const industrialDelta = Math.max(0, energy - state.energy) + Math.max(0, robots - state.robots)
  const recoveryExtraction = state.policy === 'resource-recovery' ? .04 + robots * .0015 + energy * .0008 : 0
  const extraction = (.004 + robots * .00024 + state.expansion.orbitalIndustry * .0015) * modifier.extraction + recoveryExtraction
  const consumption = industrialDelta * (state.policy === 'accelerate' ? 1.9 : 1.15) + Math.max(0, compute - state.compute) * .08
  const resources = clamp(state.resources + extraction - consumption, 0, AGI_PILL_PHYSICAL_CAPS.resources)

  const orbitalEligible = robots >= 8 && energy >= 6
  const orbitalGain = orbitalEligible && ['expand-orbit', 'build-dyson', 'post-dyson'].includes(state.policy)
    ? (robots * energy) ** .35 * .006
    : 0
  const orbitalIndustry = approachCap(
    state.expansion.orbitalIndustry,
    orbitalGain + (state.expansion.orbitalIndustry > 0 ? .0007 * feedback : 0),
    AGI_PILL_PHYSICAL_CAPS.orbitalIndustry,
  )
  const dysonEligible = orbitalIndustry >= 6 && robots >= 80 && energy >= 60
  const dysonGain = dysonEligible && state.policy === 'build-dyson'
    ? Math.min(2.5, .01 + log(orbitalIndustry) * .012 + log(robots) * .006)
    : 0
  const dysonProgress = clamp(state.expansion.dysonProgress + dysonGain, 0, 100)
  const dysonBuilt = state.expansion.dysonBuilt || dysonProgress >= 100
  const assuranceDrag = clamp(state.safety / (65 + Math.max(0, verificationDifficulty) * 3), .2, 1)
  const postDysonRate = dysonBuilt && state.policy === 'post-dyson'
    ? (.005 + log(orbitalIndustry) * .0014 + log(robots) * .00055) * assuranceDrag
    : 0
  const postDysonBase = dysonBuilt && !state.expansion.dysonBuilt ? 1 : state.expansion.postDysonExpansion
  const postDysonExpansionRaw = approachCap(
    postDysonBase,
    postDysonRate,
    AGI_PILL_PHYSICAL_CAPS.postDysonExpansion,
  )
  // 75 is the authored "self-sustaining solar civilization" gate; 100 is the
  // unreachable physical ceiling. Snap only at the gate so UI/endings can use
  // a finite completion state without pretending all physical capacity is used.
  const postDysonExpansion = postDysonExpansionRaw >= 75 ? AGI_PILL_PHYSICAL_CAPS.postDysonExpansion : postDysonExpansionRaw

  const interim: AgiPillState = enforceAgiPillInvariants({
    ...state,
    day: state.day + 1,
    seed: nextSeed,
    intelligence,
    compute,
    energy,
    robots,
    resources,
    safety: state.safety + modifier.safety,
    governance: state.governance + modifier.governance + safetyInstitutionGain,
    friction: state.friction + modifier.friction + Math.log10(1 + industrialDelta) * .012,
    rivalCivilizations: evolveRivals(state, rolls),
    expansion: { orbitalIndustry, dysonProgress, dysonBuilt, postDysonExpansion },
  })
  const metrics = agiPillMetrics(interim)
  // Scenario seeds represent uncertainty in how difficult frontier systems are
  // to verify under distribution shift. The same continuous assumption applies
  // to every policy on a shared seed; it never selects a winner by identity.
  const targetRisk = clamp(
    4 + verificationDifficulty + Math.log10(1 + intelligence * compute) * 4.2 + Math.max(0, metrics.safetyGap) * .75 + Math.max(0, metrics.governanceGap) * .55 + interim.friction * .16 + modifier.risk - interim.safety * .23 - interim.governance * .14,
    0,
    100,
  )
  const riskResponse = modifier.risk <= -16 ? .07 : .025
  const risk = clamp(state.risk + (targetRisk - state.risk) * riskResponse, 0, 100)
  // High systemic risk must make physical cascades a competing failure mode,
  // not a unit-test-only branch hidden behind the faster misalignment clock.
  const incidentProbability = (risk / 100) ** 3 * .08
  const incident = rolls[3]! < incidentProbability
  const incidentDebt = clamp(
    state.incidentDebt + (incident ? 12 + rolls[3]! * 18 : 0) - (['safety-first', 'governance-first', 'resource-recovery'].includes(state.policy) ? .055 : .006),
    0,
    100,
  )
  const unsafe = risk >= 30 || metrics.safetyGap >= 18 || metrics.governanceGap >= 22
  const unsafeDays = unsafe ? state.unsafeDays + 1 : Math.max(0, state.unsafeDays - 3)
  const resourceCrisisDays = resources < Math.max(2, robots * .02) ? state.resourceCrisisDays + 1 : Math.max(0, state.resourceCrisisDays - 4)
  const pressure = metrics.rivalPressure
  // Capability pressure becomes capture only when institutions and social
  // legitimacy cannot absorb it. This makes governance real counterplay rather
  // than a cosmetic meter while leaving passive low-trust runs exposed.
  const capturePressure = pressure * (1 - interim.governance * .0065) * (1 + interim.friction * .006)
  const rivalDominanceDays = capturePressure > 2.6 ? state.rivalDominanceDays + 1 : Math.max(0, state.rivalDominanceDays - 2)
  const afterScale = playerScale(interim)
  const expansionAdvanced = orbitalIndustry > state.expansion.orbitalIndustry * 1.00005
    || dysonProgress > state.expansion.dysonProgress + 1e-6
    || postDysonExpansion > state.expansion.postDysonExpansion * 1.00005
  const stagnationDays = afterScale <= beforeScale * 1.00005 && !expansionAdvanced
    ? state.stagnationDays + 1
    : Math.max(0, state.stagnationDays - 2)

  const warningStillActive = (warning: AgiPillWarning) => warning.kind === 'misalignment'
    ? unsafeDays >= 360
    : warning.kind === 'industrial-cascade'
      ? incidentDebt >= 70
      : warning.kind === 'rival-capture'
        ? rivalDominanceDays >= 240
        : resourceCrisisDays >= 180
  let warning = state.warning && warningStillActive(state.warning) ? state.warning : null
  if (!warning) {
    if (unsafeDays >= 360) warning = { kind: 'misalignment', startedDay: interim.day, countdownDays: 30, recoveryPolicies: ['safety-first', 'governance-first', 'cooperate'] }
    else if (incidentDebt >= 70) warning = { kind: 'industrial-cascade', startedDay: interim.day, countdownDays: 30, recoveryPolicies: ['safety-first', 'resource-recovery', 'industrialize'] }
    else if (rivalDominanceDays >= 240) warning = { kind: 'rival-capture', startedDay: interim.day, countdownDays: 90, recoveryPolicies: ['cooperate', 'balanced', 'governance-first'] }
    else if (resourceCrisisDays >= 180) warning = { kind: 'resource-lock', startedDay: interim.day, countdownDays: 180, recoveryPolicies: ['resource-recovery', 'cooperate', 'expand-orbit'] }
  }
  const warningExpired = (kind: AgiPillWarning['kind']) => warning?.kind === kind && interim.day - warning.startedDay >= warning.countdownDays

  let outcome: AgiPillState['outcome'] = 'active'
  let terminal = false
  if (warningExpired('industrial-cascade')) {
    outcome = 'industrial-accident'
    terminal = true
  } else if (warningExpired('misalignment')) {
    outcome = 'misalignment'
    terminal = true
  } else if (warningExpired('rival-capture')) {
    outcome = 'rival-takeover'
    terminal = true
  } else if (warningExpired('resource-lock')) {
    outcome = 'stagnation'
    terminal = true
  } else if (stagnationDays >= 720 || (interim.day >= 12 * 365 && !dysonBuilt && orbitalIndustry < 1)) {
    outcome = 'stagnation'
  } else if (dysonBuilt && postDysonExpansion >= AGI_PILL_PHYSICAL_CAPS.postDysonExpansion && interim.governance >= 55 && interim.safety >= 60) {
    outcome = 'pluralistic-expansion'
  }

  return addMilestones(enforceAgiPillInvariants({
    ...interim,
    risk,
    incidentDebt,
    unsafeDays,
    resourceCrisisDays,
    rivalDominanceDays,
    stagnationDays,
    lastCauses: growthCauses(interim, metrics, incident || incidentDebt >= 70),
    warning,
    outcome,
    terminal,
  }))
}

export const runAgiPillTicks = (input: AgiPillState, count: number, policy?: AgiPillPolicy): AgiPillState => {
  let state = policy ? setAgiPillPolicy(input, policy) : input
  const ticks = Math.max(0, Math.floor(finite(count)))
  for (let index = 0; index < ticks && !state.terminal; index += 1) state = tickAgiPill(state)
  return state
}

const effectValue = (current: number, effect: AgiPillEffect) => effect.operation === 'add'
  ? current + effect.value
  : effect.operation === 'multiply'
    ? current * effect.value
    : effect.value

export const applyAgiPillEffects = (input: AgiPillState, effects: readonly AgiPillEffect[], sourceId?: string): AgiPillState => {
  let state = { ...input, expansion: { ...input.expansion }, rivalCivilizations: input.rivalCivilizations.map((rival) => ({ ...rival })) }
  for (const effect of effects) {
    if (!Number.isFinite(effect.value)) continue
    if (effect.metric === 'orbitalIndustry' || effect.metric === 'dysonProgress' || effect.metric === 'postDysonExpansion') {
      state.expansion[effect.metric] = effectValue(state.expansion[effect.metric], effect)
    } else if (effect.metric === 'rivalPressure') {
      const currentPressure = rivalPressure(state)
      const targetPressure = effect.operation === 'multiply'
        ? currentPressure * clamp(effect.value, .25, 4)
        : effect.operation === 'add'
          ? currentPressure + effect.value * .05
          : effect.value * .05
      const boundedTarget = clamp(targetPressure, .05, 8)
      const multiplier = clamp(boundedTarget / Math.max(.05, currentPressure), .25, 4)
      state.rivalCivilizations = state.rivalCivilizations.map((rival) => ({
        ...rival,
        capability: rival.capability * multiplier,
      }))
    } else {
      const key = effect.metric as Exclude<AgiPillMetricKey, 'rivalPressure' | 'orbitalIndustry' | 'dysonProgress' | 'postDysonExpansion'>
      state = { ...state, [key]: effectValue(state[key], effect) }
    }
  }
  if (sourceId) state.flags = unique([...state.flags, `effect:${sourceId}`])
  return enforceAgiPillInvariants(state)
}

export const transitionAgiPill = (state: AgiPillState, action: AgiPillAction): AgiPillState => {
  if (action.type === 'set-policy') return setAgiPillPolicy(state, action.policy)
  if (action.type === 'apply-effects') return applyAgiPillEffects(state, action.effects, action.sourceId)
  return runAgiPillTicks(state, action.days ?? 1)
}
