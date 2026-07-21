import {
  END_DAY,
  START_DATE,
  acknowledgeWorldEvent,
  advanceRealtime,
  computeEconomy,
  createInitialState,
  evaluateEnding,
  getStrategyNodeAvailability,
  humanExtinctionRisk,
  metrics,
  scoreState,
  tickDay,
  transition,
  type Choice2029,
  type Choice2035,
  type GameAction,
  type GameState,
  type Region,
  type Speed,
} from '../src/engine'
import { STRATEGY_CATALOG, type StrategyNodeId } from '../src/strategyNodes'
import type { ActionRecord, PlayDecisionContext, PlayPolicy, PlayResult } from './harness'
import { HUMAN_PROFILES, type HumanProfile } from './humanized'

export type HumanizedSplit = 'tuning' | 'holdout'

export type VisibleStrategyNode = Readonly<{
  id: StrategyNodeId
  cost: number
  status: 'ready' | 'acquired' | 'locked' | 'excluded' | 'disabled' | 'capped' | 'cooldown' | 'insufficient-compute'
}>

/**
 * The information a player can inspect in the production UI. Random streams,
 * scheduler history, hidden gap timers and engine refractory counters are
 * deliberately absent. Policies in V2 can never receive the production state.
 */
export type PlayerObservation = Readonly<{
  day: number
  year: number
  date: string
  compute: number
  capability: number
  safety: number
  governance: number
  efficiency: number
  trust: number
  speed: Speed
  momentumDays: number
  resetCooldownSeconds: number
  ecosystemCooldownSeconds: number
  regions: readonly Readonly<Region>[]
  rivalShares: readonly [number, number, number]
  rivalCapability: readonly [number, number, number]
  rivalProduct: readonly [number, number, number]
  rivalCompany: readonly [number, number, number]
  acquiredStrategyNodes: readonly StrategyNodeId[]
  visibleFlags: readonly string[]
  features: readonly string[]
  incidentCounts: Readonly<GameState['incidentCounts']>
  regulatoryFreeze: boolean
  brownout: boolean
  choice2029: Choice2029 | null
  choice2035: Choice2035 | null
  rewardBubbles: ReadonlyArray<Readonly<{ id: string; region: Region['id']; reward: number }>>
  pendingWorldEvent: null | Readonly<{ category: string; source: string; headline: string; region: Region['id'] | 'global' }>
  worldAdoption: number
  codexShare: number
  hhi: number
  extinctionRisk: number
  strategyNodes: readonly VisibleStrategyNode[]
}>

export type ObservationPolicy = Readonly<{
  id: string
  description: string
  choice2029: Choice2029
  choice2035: Choice2035
  decideObservation: (observation: PlayerObservation, context: PlayDecisionContext) => GameAction | null
}>

export type HumanizedV2Result = PlayResult & Readonly<{
  profileId: HumanProfile['id']
  profileLabel: string
  synthetic: true
  harnessVersion: 2
  split: HumanizedSplit
  scenarioSeed: number
  behaviorSeed: number
  realSecondsElapsed: number
  eventReadSeconds: number
  choiceReadSeconds: number
  policyCalls: number
  decisionOpportunities: number
  deferredActions: number
  mistakenActions: number
  mistakenInvestmentActions: number
  mistakenSpeedActions: number
  bubblesSeen: number
  bubblesCollected: number
  speedSwitches: number
  riskRecognitionDelayDays: number
  completionReason: 'ending' | 'timeout' | 'dropout' | 'day-limit'
  droppedOut: boolean
  timedOut: boolean
  timeToFirstActionSeconds: number | null
  inoperableSeconds: number
  inoperableDays: number
}>

const yearForDay = (day: number) => new Date(START_DATE + day * 86_400_000).getUTCFullYear()
const dateForDay = (day: number) => new Date(START_DATE + day * 86_400_000).toISOString().slice(0, 10)

const mulberry32 = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6D2B79F5) >>> 0
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

const hash32 = (...values: number[]) => {
  let result = 0x811C9DC5
  for (const value of values) {
    result ^= value >>> 0
    result = Math.imul(result, 0x01000193) >>> 0
  }
  return result >>> 0
}

const sampleInt = (random: () => number, range: readonly [number, number]) =>
  Math.floor(range[0] + random() * (range[1] - range[0] + 1))

const roundTo = (value: number, step: number) => Math.round(value / step) * step
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const visibleFlags = (state: GameState) => state.flags.filter((flag) =>
  flag === 'lifeline:used' || flag.startsWith('feature:') || flag === 'open-ecosystem' || flag === 'ecosystem:open')

export const observePlayerState = (
  state: GameState,
  profile: HumanProfile,
  staleRiskState: GameState | null = null,
): PlayerObservation => {
  const source = staleRiskState ?? state
  const computeStep = profile.observationGranularity === 'coarse' ? 25 : profile.observationGranularity === 'medium' ? 10 : 1
  const trustStep = profile.observationGranularity === 'coarse' ? 5 : profile.observationGranularity === 'medium' ? 2 : 1
  const shareStep = profile.observationGranularity === 'coarse' ? 0.05 : profile.observationGranularity === 'medium' ? 0.02 : 0.01
  const observedState: GameState = {
    ...source,
    compute: Math.max(0, roundTo(source.compute, computeStep)),
    trust: clamp(roundTo(source.trust, trustStep), 0, 100),
    rivalShares: source.rivalShares.map((share) => clamp(roundTo(share, shareStep), 0, 1)) as [number, number, number],
    momentumDays: Math.max(0, roundTo(source.momentumDays, profile.observationGranularity === 'coarse' ? 10 : 5)),
  }
  const visibleMetrics = metrics(observedState)
  return Object.freeze({
    day: state.day,
    year: yearForDay(state.day),
    date: dateForDay(state.day),
    compute: observedState.compute,
    capability: observedState.capability,
    safety: observedState.safety,
    governance: observedState.governance,
    efficiency: observedState.efficiency,
    trust: observedState.trust,
    speed: state.speed,
    momentumDays: observedState.momentumDays,
    resetCooldownSeconds: state.resetCooldownSeconds,
    ecosystemCooldownSeconds: state.ecosystemCooldownSeconds,
    regions: observedState.regions.map((region) => Object.freeze({ ...region })),
    rivalShares: [...observedState.rivalShares] as [number, number, number],
    rivalCapability: [...observedState.rivalCapability] as [number, number, number],
    rivalProduct: [...observedState.rivalProduct] as [number, number, number],
    rivalCompany: [...observedState.rivalCompany] as [number, number, number],
    acquiredStrategyNodes: [...(observedState.acquiredStrategyNodes ?? [])],
    visibleFlags: visibleFlags(observedState),
    features: [...observedState.features],
    incidentCounts: { ...observedState.incidentCounts },
    regulatoryFreeze: observedState.regulatoryFreeze,
    brownout: observedState.brownout,
    choice2029: observedState.choice2029,
    choice2035: observedState.choice2035,
    rewardBubbles: state.rewardBubbles.map(({ id, region, reward }) => ({ id, region, reward })),
    pendingWorldEvent: state.pendingWorldEvent ? {
      category: state.pendingWorldEvent.category,
      source: state.pendingWorldEvent.source,
      headline: state.pendingWorldEvent.headline,
      region: state.pendingWorldEvent.region,
    } : null,
    worldAdoption: visibleMetrics.worldAdoption,
    codexShare: visibleMetrics.codexShare,
    hhi: visibleMetrics.hhi,
    extinctionRisk: humanExtinctionRisk(observedState),
    strategyNodes: STRATEGY_CATALOG.map(({ id }) => {
      const availability = getStrategyNodeAvailability(observedState, id)!
      return { id, cost: availability.cost, status: availability.status }
    }),
  })
}

/**
 * Compatibility is deliberately lossy: old policies receive a synthetic state
 * rebuilt only from PlayerObservation. Hidden production seeds/timers/history
 * are fixed blank defaults and can no longer leak into decisions.
 */
export const adaptLegacyPolicy = (legacy: PlayPolicy): ObservationPolicy => ({
  id: legacy.id,
  description: legacy.description,
  choice2029: legacy.choice2029,
  choice2035: legacy.choice2035,
  decideObservation: (observation, context) => {
    const shell = createInitialState({ seed: 0 })
    const compatibilityState: GameState = {
      ...shell,
      day: observation.day,
      compute: observation.compute,
      capability: observation.capability,
      safety: observation.safety,
      governance: observation.governance,
      efficiency: observation.efficiency,
      trust: observation.trust,
      speed: observation.speed,
      momentumDays: observation.momentumDays,
      resetCooldownSeconds: observation.resetCooldownSeconds,
      ecosystemCooldownSeconds: observation.ecosystemCooldownSeconds,
      resetDays: observation.resetCooldownSeconds,
      resetCooldownDays: observation.resetCooldownSeconds,
      ecosystemCooldownDays: observation.ecosystemCooldownSeconds,
      regions: observation.regions.map((region) => ({ ...region })),
      rivalShares: [...observation.rivalShares],
      rivalCapability: [...observation.rivalCapability],
      rivalProduct: [...observation.rivalProduct],
      rivalCompany: [...observation.rivalCompany],
      acquiredStrategyNodes: [...observation.acquiredStrategyNodes],
      flags: [...observation.visibleFlags],
      features: [...observation.features],
      incidentCounts: { ...observation.incidentCounts },
      regulatoryFreeze: observation.regulatoryFreeze,
      brownout: observation.brownout,
      choice2029: observation.choice2029,
      choice2035: observation.choice2035,
      rewardBubbles: observation.rewardBubbles.map((bubble) => ({
        ...bubble,
        placement: 0.5,
        remainingSeconds: 3,
        source: 'community' as const,
      })),
      pendingWorldEvent: null,
      seed: 0,
      bubbleSeed: 0,
      worldEventSeed: 0,
      firedWorldEventIds: [],
      lastWorldEventDay: null,
      lastWorldEventCategoryDay: {},
      lastWorldPopupDay: null,
      activeEffects: [],
      safetyGapDays: 0,
      safeRecoveryDays: 0,
      safetyIncidentCooldownDays: 0,
      regulatoryIncidentCooldownDays: 0,
    }
    return legacy.decide(compatibilityState, context)
  },
})

export const HUMANIZED_V2_SEED_BASES = Object.freeze({
  tuningScenario: 0x2A00_0001,
  tuningBehavior: 0x2B00_0001,
  holdoutScenario: 0x7A00_0001,
  holdoutBehavior: 0x7B00_0001,
})

export const humanizedV2Seeds = (
  split: HumanizedSplit,
  runIndex: number,
  policyIndex: number,
  profileIndex: number,
) => {
  const scenarioBase = split === 'tuning' ? HUMANIZED_V2_SEED_BASES.tuningScenario : HUMANIZED_V2_SEED_BASES.holdoutScenario
  const behaviorBase = split === 'tuning' ? HUMANIZED_V2_SEED_BASES.tuningBehavior : HUMANIZED_V2_SEED_BASES.holdoutBehavior
  return {
    // No policy/profile term: every policy sees the same authored worldline for a run index.
    scenarioSeed: hash32(scenarioBase, runIndex),
    behaviorSeed: hash32(behaviorBase, runIndex, policyIndex, profileIndex),
  }
}

const profileSessionBudget = (profile: HumanProfile): readonly [number, number] => {
  if (profile.id === 'competitive') return [15 * 60, 40 * 60]
  if (profile.id === 'novice') return [25 * 60, 60 * 60]
  if (profile.id === 'explorer') return [25 * 60, 70 * 60]
  return [50 * 60, 110 * 60]
}

const dropoutHazard = (profile: HumanProfile) => {
  if (profile.id === 'novice') return 0.032
  if (profile.id === 'explorer') return 0.018
  if (profile.id === 'competitive') return 0.012
  if (profile.id === 'cautious') return 0.006
  return 0.004
}

const isOperationallyInoperable = (state: GameState) => {
  if (state.rewardBubbles.length > 0 || state.resetCooldownSeconds === 0) return false
  if (!state.flags.includes('lifeline:used') && state.compute < 45) return false
  if (state.regions.some(({ introduced }) => !introduced) && state.compute >= 45) return false
  if (STRATEGY_CATALOG.some(({ id }) => getStrategyNodeAvailability(state, id)?.status === 'ready')) return false
  if (state.ecosystemCooldownSeconds === 0 && metrics(state).codexShare >= 0.28) return false
  return true
}

const stateFingerprint = (state: GameState) => JSON.stringify({
  day: state.day,
  compute: state.compute,
  capability: state.capability,
  safety: state.safety,
  governance: state.governance,
  efficiency: state.efficiency,
  trust: state.trust,
  flags: state.flags,
  acquiredStrategyNodes: state.acquiredStrategyNodes,
  introduced: state.regions.map((region) => region.introduced),
  choice2029: state.choice2029,
  choice2035: state.choice2035,
  speed: state.speed,
  rewardBubbles: state.rewardBubbles.map(({ id }) => id),
})

const executableMistake = (state: GameState, intended: GameAction, random: () => number): GameAction => {
  const readyNodes = STRATEGY_CATALOG
    .map(({ id }) => getStrategyNodeAvailability(state, id))
    .filter((entry): entry is NonNullable<typeof entry> => entry?.status === 'ready')
    .sort((a, b) => b.cost - a.cost)
  // Most mistakes are plausible over-investments: an available but expensive
  // node outside the intended action. The transition will accept it.
  const alternative = readyNodes.find(({ id }) => intended.type !== 'strategy-node' || id !== intended.nodeId)
  if (alternative && random() < 0.72) return { type: 'strategy-node', nodeId: alternative.id }
  // The remaining mistakes are unnecessary pace changes, also valid UI actions.
  return { type: 'set-speed', speed: state.speed === 8 ? 1 : 8 }
}

export const runHumanizedPlaythroughV2 = (
  policy: ObservationPolicy,
  profile: HumanProfile,
  options: {
    split: HumanizedSplit
    scenarioSeed: number
    behaviorSeed: number
    run: number
    sessionBudgetSeconds?: number
    disableDropout?: boolean
  },
): HumanizedV2Result => {
  const random = mulberry32(options.behaviorSeed)
  let state = createInitialState({ seed: options.scenarioSeed })
  let actionsTaken = 0
  let lastActionDay = -1
  let nextDecisionDay = sampleInt(random, profile.decisionIntervalDays)
  let brownoutDays = 0
  let brownoutStreak = 0
  let maxBrownoutStreak = 0
  let zeroComputeDays = 0
  let realSecondsElapsed = 0
  let eventReadSeconds = 0
  let choiceReadSeconds = 0
  let policyCalls = 0
  let decisionOpportunities = 0
  let deferredActions = 0
  let mistakenActions = 0
  let mistakenInvestmentActions = 0
  let mistakenSpeedActions = 0
  let bubblesSeen = 0
  let bubblesCollected = 0
  let speedSwitches = 0
  let nextSpeedChangeDay = sampleInt(random, [120, 420])
  let previousBubbleIds = new Set<string>()
  let lastLowRiskState: GameState | null = state
  let riskDetectedDay: number | null = null
  const riskRecognitionDelayDays = sampleInt(random, profile.riskRecognitionDelayDays)
  const sessionBudgetSeconds = options.sessionBudgetSeconds ?? sampleInt(random, profileSessionBudget(profile))
  let completionReason: HumanizedV2Result['completionReason'] = 'day-limit'
  let timeToFirstActionSeconds: number | null = null
  let inoperableSeconds = 0
  let inoperableDays = 0
  let consecutiveIdleSeconds = 0
  let nextDropoutCheckSeconds = 120
  const actionLog: ActionRecord[] = []

  const apply = (action: GameAction, discretionary = true) => {
    const before = state
    const fingerprint = stateFingerprint(before)
    state = transition(state, action)
    const accepted = fingerprint !== stateFingerprint(state)
    actionLog.push({ day: before.day, action, accepted, computeBefore: before.compute, computeAfter: state.compute })
    if (accepted) {
      actionsTaken += 1
      lastActionDay = before.day
      if (discretionary && timeToFirstActionSeconds === null) timeToFirstActionSeconds = realSecondsElapsed
      if (action.type === 'collect-bubble') bubblesCollected += 1
      consecutiveIdleSeconds = 0
    }
  }

  const readFor = (seconds: number) => {
    state = advanceRealtime(state, seconds)
    realSecondsElapsed += seconds
  }

  while (!state.terminal && state.day < END_DAY) {
    if (realSecondsElapsed >= sessionBudgetSeconds) {
      completionReason = 'timeout'
      break
    }
    if (realSecondsElapsed >= nextDropoutCheckSeconds) {
      // Abandonment is a wall-clock hazard, sampled at most once per minute.
      // Sampling per simulated day would make fast-forward players leave eight
      // times more often despite spending less real time in the game.
      nextDropoutCheckSeconds += 60
      if (!options.disableDropout && consecutiveIdleSeconds >= 120 && random() < dropoutHazard(profile)) {
        completionReason = 'dropout'
        break
      }
    }

    const year = yearForDay(state.day)
    if (year >= 2029 && state.choice2029 === null) {
      const seconds = sampleInt(random, profile.choiceReadSeconds)
      readFor(seconds)
      choiceReadSeconds += seconds
      apply({ type: 'choose-2029', choice: policy.choice2029 }, false)
    }
    if (year >= 2035 && state.choice2035 === null) {
      const seconds = sampleInt(random, profile.choiceReadSeconds)
      readFor(seconds)
      choiceReadSeconds += seconds
      apply({ type: 'choose-2035', choice: policy.choice2035 }, false)
    }
    if (state.pendingWorldEvent) {
      const seconds = sampleInt(random, profile.eventReadSeconds)
      readFor(seconds)
      eventReadSeconds += seconds
      state = acknowledgeWorldEvent(state)
      nextDecisionDay = Math.min(nextDecisionDay, state.day + sampleInt(random, [0, 3]))
    }

    const currentRisk = humanExtinctionRisk(state)
    if (currentRisk < 0.15) {
      lastLowRiskState = state
      riskDetectedDay = null
    } else if (riskDetectedDay === null) riskDetectedDay = state.day
    const staleRisk = riskDetectedDay !== null && state.day < riskDetectedDay + riskRecognitionDelayDays

    if (profile.speed === 'fast' || (profile.speed === 'mixed' && state.day >= nextSpeedChangeDay)) {
      const desired = profile.speed === 'fast' ? 8 : state.speed === 8 ? 1 : 8
      if (state.speed !== desired) {
        state = transition(state, { type: 'set-speed', speed: desired })
        speedSwitches += 1
      }
      if (profile.speed === 'mixed') nextSpeedChangeDay = state.day + sampleInt(random, [120, 420])
    } else if (profile.speed === 'normal' && state.speed !== 1) {
      state = transition(state, { type: 'set-speed', speed: 1 })
      speedSwitches += 1
    }

    for (const bubble of [...state.rewardBubbles]) {
      if (previousBubbleIds.has(bubble.id)) continue
      bubblesSeen += 1
      if (random() < profile.bubbleCatchRate * (state.speed === 8 ? 0.72 : 1)) {
        apply({ type: 'collect-bubble', bubbleId: bubble.id })
      }
    }
    previousBubbleIds = new Set(state.rewardBubbles.map(({ id }) => id))

    if (state.day >= nextDecisionDay) {
      decisionOpportunities += 1
      policyCalls += 1
      const observation = observePlayerState(state, profile, staleRisk ? lastLowRiskState : null)
      const context: PlayDecisionContext = {
        run: options.run,
        seed: options.scenarioSeed,
        simulatedYear: year,
        actionsTaken,
        lastActionDay,
      }
      let action = policy.decideObservation(observation, context)
      if (action && random() > profile.actionFollowThrough) {
        action = null
        deferredActions += 1
      } else if (action && random() < profile.mistakeRate) {
        action = executableMistake(state, action, random)
        mistakenActions += 1
        if (action.type === 'strategy-node') mistakenInvestmentActions += 1
        if (action.type === 'set-speed') mistakenSpeedActions += 1
      }
      if (action) apply(action)
      nextDecisionDay = state.day + sampleInt(random, profile.decisionIntervalDays)
    }

    if (state.brownout) {
      brownoutDays += 1
      brownoutStreak += 1
      maxBrownoutStreak = Math.max(maxBrownoutStreak, brownoutStreak)
    } else brownoutStreak = 0
    if (state.compute < 1) zeroComputeDays += 1
    const inoperable = isOperationallyInoperable(state)
    if (inoperable) inoperableDays += 1
    state = tickDay(state)
    const secondsPerDay = state.speed === 8 ? 1 / 8 : 1
    state = advanceRealtime(state, secondsPerDay)
    realSecondsElapsed += secondsPerDay
    consecutiveIdleSeconds += secondsPerDay
    if (inoperable) inoperableSeconds += secondsPerDay
  }

  if (state.terminal) completionReason = 'ending'
  else if (state.day >= END_DAY && completionReason === 'day-limit') completionReason = 'day-limit'
  const scored = scoreState(state)
  const ending = evaluateEnding(state)
  const finalMetrics = metrics(state)
  computeEconomy(state)
  return {
    policyId: policy.id,
    policyDescription: policy.description,
    profileId: profile.id,
    profileLabel: profile.label,
    synthetic: true,
    harnessVersion: 2,
    split: options.split,
    run: options.run,
    seed: options.scenarioSeed,
    scenarioSeed: options.scenarioSeed,
    behaviorSeed: options.behaviorSeed,
    completed: state.terminal,
    day: state.day,
    year: yearForDay(state.day),
    ending: ending.id,
    score: scored.score,
    rank: scored.rank,
    worldAdoption: finalMetrics.worldAdoption,
    codexShare: finalMetrics.codexShare,
    hhi: finalMetrics.hhi,
    trust: state.trust,
    compute: state.compute,
    capability: state.capability,
    safety: state.safety,
    governance: state.governance,
    extinctionRisk: humanExtinctionRisk(state),
    interventions: state.interventions,
    brownoutDays,
    maxBrownoutStreak,
    zeroComputeDays,
    actionCount: actionLog.length,
    acceptedActionCount: actionLog.filter(({ accepted }) => accepted).length,
    rejectedActionCount: actionLog.filter(({ accepted }) => !accepted).length,
    choice2029: state.choice2029,
    choice2035: state.choice2035,
    incidentCounts: { ...state.incidentCounts },
    rivalShares: [...state.rivalShares] as [number, number, number],
    actionLog,
    realSecondsElapsed,
    eventReadSeconds,
    choiceReadSeconds,
    policyCalls,
    decisionOpportunities,
    deferredActions,
    mistakenActions,
    mistakenInvestmentActions,
    mistakenSpeedActions,
    bubblesSeen,
    bubblesCollected,
    speedSwitches,
    riskRecognitionDelayDays,
    completionReason,
    droppedOut: completionReason === 'dropout',
    timedOut: completionReason === 'timeout',
    timeToFirstActionSeconds,
    inoperableSeconds,
    inoperableDays,
  }
}

export { HUMAN_PROFILES }
