import {
  END_DAY,
  START_DATE,
  acknowledgeWorldEvent,
  advanceRealtime,
  computeEconomy,
  createInitialState,
  evaluateEnding,
  humanExtinctionRisk,
  metrics,
  scoreState,
  tickDay,
  transition,
  type GameAction,
  type GameState,
  type RegionId,
} from '../src/engine'
import type { ActionRecord, PlayDecisionContext, PlayPolicy, PlayResult } from './harness'

export type HumanProfile = Readonly<{
  id: 'novice' | 'cautious' | 'competitive' | 'explorer' | 'frugal'
  label: string
  description: string
  decisionIntervalDays: readonly [number, number]
  actionFollowThrough: number
  mistakeRate: number
  bubbleCatchRate: number
  eventReadSeconds: readonly [number, number]
  choiceReadSeconds: readonly [number, number]
  riskRecognitionDelayDays: readonly [number, number]
  observationGranularity: 'coarse' | 'medium' | 'precise'
  speed: 'normal' | 'fast' | 'mixed'
}>

export const HUMAN_PROFILES: readonly HumanProfile[] = [
  {
    id: 'novice',
    label: 'First-session novice',
    description: 'Reads slowly, acts intermittently, misses most bubbles, and notices danger late.',
    decisionIntervalDays: [12, 42],
    actionFollowThrough: 0.64,
    mistakeRate: 0.16,
    bubbleCatchRate: 0.22,
    eventReadSeconds: [8, 22],
    choiceReadSeconds: [20, 55],
    riskRecognitionDelayDays: [45, 140],
    observationGranularity: 'coarse',
    speed: 'mixed',
  },
  {
    id: 'cautious',
    label: 'Cautious reader',
    description: 'Reads events, checks the dashboard frequently, and reacts to risk with a short delay.',
    decisionIntervalDays: [5, 16],
    actionFollowThrough: 0.86,
    mistakeRate: 0.04,
    bubbleCatchRate: 0.55,
    eventReadSeconds: [10, 28],
    choiceReadSeconds: [28, 70],
    riskRecognitionDelayDays: [8, 35],
    observationGranularity: 'medium',
    speed: 'normal',
  },
  {
    id: 'competitive',
    label: 'Fast competitive player',
    description: 'Runs fast, makes frequent upgrades, catches some bubbles, and can overcommit under pressure.',
    decisionIntervalDays: [2, 9],
    actionFollowThrough: 0.94,
    mistakeRate: 0.07,
    bubbleCatchRate: 0.48,
    eventReadSeconds: [3, 10],
    choiceReadSeconds: [8, 24],
    riskRecognitionDelayDays: [18, 65],
    observationGranularity: 'medium',
    speed: 'fast',
  },
  {
    id: 'explorer',
    label: 'Curious explorer',
    description: 'Experiments often, changes pace, reads some events, and occasionally clicks the wrong control.',
    decisionIntervalDays: [3, 20],
    actionFollowThrough: 0.78,
    mistakeRate: 0.13,
    bubbleCatchRate: 0.68,
    eventReadSeconds: [5, 18],
    choiceReadSeconds: [12, 40],
    riskRecognitionDelayDays: [15, 80],
    observationGranularity: 'coarse',
    speed: 'mixed',
  },
  {
    id: 'frugal',
    label: 'Resource-conscious planner',
    description: 'Acts less often, preserves PF, reads carefully, and rarely makes mechanical mistakes.',
    decisionIntervalDays: [8, 28],
    actionFollowThrough: 0.9,
    mistakeRate: 0.025,
    bubbleCatchRate: 0.38,
    eventReadSeconds: [12, 34],
    choiceReadSeconds: [30, 80],
    riskRecognitionDelayDays: [5, 25],
    observationGranularity: 'precise',
    speed: 'normal',
  },
] as const

export type HumanizedPlayResult = PlayResult & Readonly<{
  profileId: HumanProfile['id']
  profileLabel: string
  synthetic: true
  realSecondsElapsed: number
  eventReadSeconds: number
  choiceReadSeconds: number
  policyCalls: number
  decisionOpportunities: number
  deferredActions: number
  mistakenActions: number
  bubblesSeen: number
  bubblesCollected: number
  speedSwitches: number
  riskRecognitionDelayDays: number
}>

const yearForDay = (day: number) => new Date(START_DATE + day * 86_400_000).getUTCFullYear()

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

const sampleInt = (random: () => number, range: readonly [number, number]) =>
  Math.floor(range[0] + random() * (range[1] - range[0] + 1))

const roundTo = (value: number, step: number) => Math.round(value / step) * step

/**
 * Policies normally receive exact engine state. Humanized runs instead provide
 * the approximate values a player can read from the UI. This is intentionally
 * conservative: authored flags and unlocked content remain visible, while the
 * continuously changing telemetry is rounded by experience level.
 */
const perceivedState = (state: GameState, profile: HumanProfile, staleRiskState: GameState | null): GameState => {
  const source = staleRiskState ?? state
  const computeStep = profile.observationGranularity === 'coarse' ? 25 : profile.observationGranularity === 'medium' ? 10 : 1
  const trustStep = profile.observationGranularity === 'coarse' ? 5 : profile.observationGranularity === 'medium' ? 2 : 1
  const shareStep = profile.observationGranularity === 'coarse' ? 0.05 : profile.observationGranularity === 'medium' ? 0.02 : 0.01
  return {
    ...source,
    day: state.day,
    speed: state.speed,
    compute: Math.max(0, roundTo(source.compute, computeStep)),
    trust: Math.max(0, Math.min(100, roundTo(source.trust, trustStep))),
    momentumDays: Math.max(0, roundTo(source.momentumDays, profile.observationGranularity === 'coarse' ? 10 : 5)),
    resetCooldownSeconds: state.resetCooldownSeconds,
    ecosystemCooldownSeconds: state.ecosystemCooldownSeconds,
    rewardBubbles: state.rewardBubbles,
    pendingWorldEvent: state.pendingWorldEvent,
    rivalShares: source.rivalShares.map((share) => Math.max(0, roundTo(share, shareStep))) as [number, number, number],
  }
}

const invalidVariant = (action: GameAction, state: GameState): GameAction => {
  if (action.type === 'collect-bubble') return { type: 'collect-bubble', bubbleId: `missed-${action.bubbleId}` }
  if (action.type === 'introduce') {
    const introduced = state.regions.find((region) => region.introduced)?.id ?? 'north-america'
    return { type: 'introduce', region: introduced as RegionId }
  }
  if (action.type === 'strategy-node') return { type: 'strategy-node', nodeId: 'model-foundation' }
  if (action.type === 'reset') return state.resetCooldownSeconds > 0 ? action : { type: 'collect-bubble', bubbleId: 'wrong-control' }
  if (action.type === 'compute-lifeline') return state.flags.includes('lifeline:used') ? action : { type: 'collect-bubble', bubbleId: 'wrong-control' }
  return { type: 'collect-bubble', bubbleId: 'wrong-control' }
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
  features: state.features,
  introduced: state.regions.map((region) => region.introduced),
  choice2029: state.choice2029,
  choice2035: state.choice2035,
  resetCooldownSeconds: state.resetCooldownSeconds,
  ecosystemCooldownSeconds: state.ecosystemCooldownSeconds,
  rewardBubbles: state.rewardBubbles.map(({ id }) => id),
})

export const runHumanizedPlaythrough = (
  policy: PlayPolicy,
  profile: HumanProfile,
  options: { seed: number; run: number },
): HumanizedPlayResult => {
  const behaviorSeed = (options.seed ^ ((HUMAN_PROFILES.findIndex(({ id }) => id === profile.id) + 1) * 0x9E3779B9)) >>> 0
  const random = mulberry32(behaviorSeed)
  let state = createInitialState({ seed: options.seed })
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
  let bubblesSeen = 0
  let bubblesCollected = 0
  let speedSwitches = 0
  let nextSpeedChangeDay = sampleInt(random, [120, 420])
  let previousBubbleIds = new Set<string>()
  let lastLowRiskState: GameState | null = state
  let riskDetectedDay: number | null = null
  const riskRecognitionDelayDays = sampleInt(random, profile.riskRecognitionDelayDays)
  const actionLog: ActionRecord[] = []

  const apply = (action: GameAction) => {
    const before = state
    const fingerprint = stateFingerprint(before)
    state = transition(state, action)
    const accepted = fingerprint !== stateFingerprint(state)
    actionLog.push({ day: before.day, action, accepted, computeBefore: before.compute, computeAfter: state.compute })
    if (accepted) {
      actionsTaken += 1
      lastActionDay = before.day
      if (action.type === 'collect-bubble') bubblesCollected += 1
    }
  }

  const readFor = (seconds: number) => {
    state = advanceRealtime(state, seconds)
    realSecondsElapsed += seconds
  }

  while (!state.terminal && state.day < END_DAY) {
    const year = yearForDay(state.day)

    if (year >= 2029 && state.choice2029 === null) {
      const seconds = sampleInt(random, profile.choiceReadSeconds)
      readFor(seconds)
      choiceReadSeconds += seconds
      apply({ type: 'choose-2029', choice: policy.choice2029 })
    }
    if (year >= 2035 && state.choice2035 === null) {
      const seconds = sampleInt(random, profile.choiceReadSeconds)
      readFor(seconds)
      choiceReadSeconds += seconds
      apply({ type: 'choose-2035', choice: policy.choice2035 })
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
    } else if (riskDetectedDay === null) {
      riskDetectedDay = state.day
    }
    const riskStillUnrecognized = riskDetectedDay !== null && state.day < riskDetectedDay + riskRecognitionDelayDays

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

    // Bubble collection is a visual reflex, not a strategic planning turn.
    // Decide once when each new bubble appears, with fast-forward reducing the
    // effective catch chance because its real-time window is harder to notice.
    const visibleBubbles = [...state.rewardBubbles]
    for (const bubble of visibleBubbles) {
      if (previousBubbleIds.has(bubble.id)) continue
      bubblesSeen += 1
      const speedPenalty = state.speed === 8 ? 0.72 : 1
      if (random() < profile.bubbleCatchRate * speedPenalty) {
        apply({ type: 'collect-bubble', bubbleId: bubble.id })
      }
    }
    previousBubbleIds = new Set(state.rewardBubbles.map(({ id }) => id))

    if (state.day >= nextDecisionDay) {
      decisionOpportunities += 1
      policyCalls += 1
      const observed = perceivedState(state, profile, riskStillUnrecognized ? lastLowRiskState : null)
      const context: PlayDecisionContext = {
        run: options.run,
        seed: options.seed,
        simulatedYear: year,
        actionsTaken,
        lastActionDay,
      }
      let action = policy.decide(observed, context)
      if (action?.type === 'collect-bubble' && random() > profile.bubbleCatchRate) {
        action = null
        deferredActions += 1
      } else if (action && random() > profile.actionFollowThrough) {
        action = null
        deferredActions += 1
      } else if (action && random() < profile.mistakeRate) {
        action = invalidVariant(action, state)
        mistakenActions += 1
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
    state = tickDay(state)
    const secondsPerDay = state.speed === 8 ? 1 / 8 : 1
    state = advanceRealtime(state, secondsPerDay)
    realSecondsElapsed += secondsPerDay
  }

  scoreState(state)
  const ending = evaluateEnding(state)
  const finalMetrics = metrics(state)
  computeEconomy(state)
  return {
    policyId: policy.id,
    policyDescription: policy.description,
    profileId: profile.id,
    profileLabel: profile.label,
    synthetic: true,
    run: options.run,
    seed: options.seed,
    completed: state.terminal,
    day: state.day,
    year: yearForDay(state.day),
    ending: ending.id,
    score: ending.score,
    rank: ending.rank,
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
    bubblesSeen,
    bubblesCollected,
    speedSwitches,
    riskRecognitionDelayDays,
  }
}
