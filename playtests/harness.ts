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
  type Choice2029,
  type Choice2035,
  type GameAction,
  type GameState,
} from '../src/engine'

export type PlayDecisionContext = Readonly<{
  run: number
  seed: number
  simulatedYear: number
  actionsTaken: number
  lastActionDay: number
}>

export type PlayPolicy = Readonly<{
  id: string
  description: string
  choice2029: Choice2029
  choice2035: Choice2035
  decide: (state: Readonly<GameState>, context: PlayDecisionContext) => GameAction | null
}>

export type ActionRecord = Readonly<{
  day: number
  action: GameAction
  accepted: boolean
  computeBefore: number
  computeAfter: number
}>

export type PlayResult = Readonly<{
  policyId: string
  policyDescription: string
  run: number
  seed: number
  completed: boolean
  day: number
  year: number
  ending: string
  score: number
  rank: string
  worldAdoption: number
  codexShare: number
  hhi: number
  trust: number
  compute: number
  capability: number
  safety: number
  governance: number
  extinctionRisk: number
  interventions: number
  brownoutDays: number
  maxBrownoutStreak: number
  zeroComputeDays: number
  actionCount: number
  acceptedActionCount: number
  rejectedActionCount: number
  choice2029: Choice2029 | null
  choice2035: Choice2035 | null
  incidentCounts: GameState['incidentCounts']
  rivalShares: [number, number, number]
  actionLog: ActionRecord[]
}>

const yearForDay = (day: number) => new Date(START_DATE + day * 86_400_000).getUTCFullYear()

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
})

/**
 * Runs the production deterministic engine from 2026 until a terminal ending.
 * Policies see only the current public GameState and may attempt at most one
 * discretionary action per simulated day. World-event acknowledgement and the
 * two mandatory scenario decisions are recorded but not delegated to chance.
 */
export const runPlaythrough = (
  policy: PlayPolicy,
  options: { seed: number; run: number; realtimeSecondsPerDay?: number },
): PlayResult => {
  let state = createInitialState({ seed: options.seed })
  let actionsTaken = 0
  let lastActionDay = -1
  let brownoutDays = 0
  let brownoutStreak = 0
  let maxBrownoutStreak = 0
  let zeroComputeDays = 0
  const actionLog: ActionRecord[] = []
  const realtimeSecondsPerDay = options.realtimeSecondsPerDay ?? 1 / 8

  const apply = (action: GameAction) => {
    const before = state
    const fingerprint = stateFingerprint(before)
    state = transition(state, action)
    const accepted = fingerprint !== stateFingerprint(state)
    actionLog.push({
      day: before.day,
      action,
      accepted,
      computeBefore: before.compute,
      computeAfter: state.compute,
    })
    if (accepted) {
      actionsTaken += 1
      lastActionDay = before.day
    }
  }

  while (!state.terminal && state.day < END_DAY) {
    const year = yearForDay(state.day)
    if (year >= 2029 && state.choice2029 === null) apply({ type: 'choose-2029', choice: policy.choice2029 })
    if (year >= 2035 && state.choice2035 === null) apply({ type: 'choose-2035', choice: policy.choice2035 })

    if (state.pendingWorldEvent) state = acknowledgeWorldEvent(state)

    const action = policy.decide(state, {
      run: options.run,
      seed: options.seed,
      simulatedYear: year,
      actionsTaken,
      lastActionDay,
    })
    if (action) apply(action)

    if (state.brownout) {
      brownoutDays += 1
      brownoutStreak += 1
      maxBrownoutStreak = Math.max(maxBrownoutStreak, brownoutStreak)
    } else brownoutStreak = 0
    if (state.compute < 1) zeroComputeDays += 1
    state = tickDay(state)
    state = advanceRealtime(state, realtimeSecondsPerDay)
  }

  const scored = scoreState(state)
  const ending = evaluateEnding(state)
  const finalMetrics = metrics(state)
  // Exercise the same explanatory economy calculation as the production UI.
  computeEconomy(state)
  return {
    policyId: policy.id,
    policyDescription: policy.description,
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
    acceptedActionCount: actionLog.filter((entry) => entry.accepted).length,
    rejectedActionCount: actionLog.filter((entry) => !entry.accepted).length,
    choice2029: state.choice2029,
    choice2035: state.choice2035,
    incidentCounts: { ...state.incidentCounts },
    rivalShares: [...state.rivalShares] as [number, number, number],
    actionLog,
  }
}
