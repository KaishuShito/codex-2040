import {
  agiPillMetrics,
  createAgiPillState,
  transitionAgiPill,
  type AgiPillState,
} from '../../src/agiPill/engine'
import { pillPolicyById } from './policies'
import {
  applyAuthoredEventOption,
  affordableAuthoredUpgrades,
  chooseAffordableUpgrade,
  chooseAuthoredEventOption,
  dueAuthoredEvent,
  fundAuthoredUpgrade,
} from './authored'
import type {
  PillActionRecord,
  PillCausalRecord,
  PillObservation,
  PillOutcomeClass,
  PillPolicyId,
  PillWorldlineResult,
} from './types'

const DAYS_PER_YEAR = 365
const DEFAULT_MAX_DAYS = 15 * DAYS_PER_YEAR
const DECISION_CADENCE_DAYS = 30
const UPGRADE_CADENCE_DAYS = 240
const MAX_UPGRADE_PURCHASES = 8
const logScale = (value: number) => Math.log10(1 + Math.max(0, value))
const round = (value: number) => Number(value.toPrecision(12))

/** The policy sees only dashboard-level values; RNG and hidden counters stay private. */
export const observeAgiPill = (state: Readonly<AgiPillState>): PillObservation => {
  const metrics = agiPillMetrics(state as AgiPillState)
  return {
    tick: state.day,
    intelligence: logScale(state.intelligence),
    compute: logScale(state.compute),
    energy: logScale(state.energy),
    robotics: logScale(state.robots),
    resources: logScale(state.resources),
    safety: state.safety / 50,
    governance: state.governance / 50,
    socialFriction: state.friction / 100,
    alignmentRisk: state.risk / 100,
    captureRisk: Math.min(1, metrics.rivalPressure / 3),
    orbitalCapacity: state.expansion.orbitalIndustry / 6,
    dysonFraction: state.expansion.dysonProgress / 100,
    warning: state.warning ? {
      kind: state.warning.kind,
      countdownDays: state.warning.countdownDays,
      recoveryPolicies: [...state.warning.recoveryPolicies],
    } : null,
    terminal: state.terminal,
  }
}

const outcomeClass = (state: AgiPillState): PillOutcomeClass => {
  if (state.outcome === 'pluralistic-expansion') return state.expansion.postDysonExpansion >= 100
    ? 'plural-expansion'
    : 'breakthrough'
  if (state.outcome === 'rival-takeover') return 'capture'
  if (state.outcome === 'industrial-accident') return 'accident'
  if (state.outcome === 'misalignment') return 'misalignment'
  if (state.outcome === 'stagnation') return 'stagnation'
  if (state.expansion.dysonBuilt || state.milestones.includes('solar-system-takeoff')) return 'breakthrough'
  return 'incomplete'
}

const score = (state: AgiPillState) => {
  const outcome = outcomeClass(state)
  const outcomeValue: Record<PillOutcomeClass, number> = {
    'plural-expansion': 45,
    breakthrough: 30,
    'managed-transition': 25,
    stagnation: -8,
    capture: -25,
    accident: -35,
    misalignment: -50,
    incomplete: 0,
  }
  return round(
    outcomeValue[outcome]
    + Math.log10(1 + state.expansion.postDysonExpansion) * 8
    + Math.log10(1 + state.expansion.orbitalIndustry) * 5
    + state.safety * .12
    + state.governance * .12
    - state.risk * .18
    - state.friction * .06,
  )
}

const causalEntry = (
  state: AgiPillState,
  kind: PillCausalRecord['kind'],
  id: string,
): PillCausalRecord => ({
  tick: state.day,
  kind,
  id,
  causes: state.lastCauses.map(({ id: causeId }) => causeId),
  playerFacing: true,
})

const fingerprint = (state: AgiPillState, actionLog: readonly PillActionRecord[], causalLog: readonly PillCausalRecord[]) => JSON.stringify({
  day: state.day,
  seed: state.seed,
  policy: state.policy,
  outcome: state.outcome,
  terminal: state.terminal,
  intelligence: round(state.intelligence),
  compute: round(state.compute),
  energy: round(state.energy),
  robots: round(state.robots),
  resources: round(state.resources),
  safety: round(state.safety),
  governance: round(state.governance),
  friction: round(state.friction),
  risk: round(state.risk),
  expansion: Object.fromEntries(Object.entries(state.expansion).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value])),
  milestones: state.milestones,
  actions: actionLog.map(({ tick, type, accepted }) => [tick, type, accepted]),
  causes: causalLog.map(({ tick, kind, id, causes }) => [tick, kind, id, causes]),
})

export const runPillWorldline = (
  policyId: PillPolicyId,
  options: { seed: number; repeat?: number; maxDays?: number },
): PillWorldlineResult => {
  const policy = pillPolicyById(policyId)
  let state = createAgiPillState({ seed: options.seed })
  const maxDays = options.maxDays ?? DEFAULT_MAX_DAYS
  const actionLog: PillActionRecord[] = []
  const causalLog: PillCausalRecord[] = []
  const peakResources: Record<string, number> = {
    intelligence: state.intelligence,
    compute: state.compute,
    energy: state.energy,
    robotics: state.robots,
    resources: state.resources,
  }
  let starvationStreak = 0
  let longestStarvation = 0
  let inoperableStreak = 0
  let longestInoperable = 0
  let recoveriesAvailableDuringStarvation = 0
  let adverseEvents = 0
  let recoveredAdverseEvents = 0
  let unresolvedAdverse = 0
  let activeWarningKind: NonNullable<AgiPillState['warning']>['kind'] | null = null
  let lastDecisionWarning: NonNullable<AgiPillState['warning']>['kind'] | null = null
  let nextDecisionDay = 0
  let nextUpgradeDay = 60
  let dueEventCount = 0
  let executedEventCount = 0
  let eligibleUpgradeOpportunities = 0
  const eventOptionIds: string[] = []
  const purchasedUpgradeIds: string[] = []

  while (!state.terminal && state.day < maxDays && state.outcome === 'active') {
    const dueEvent = dueAuthoredEvent(state)
    if (dueEvent) {
      dueEventCount += 1
      const { option, index } = chooseAuthoredEventOption(policyId, dueEvent)
      state = applyAuthoredEventOption(state, dueEvent, option)
      executedEventCount += 1
      eventOptionIds.push(`${dueEvent.id}:${option.id}`)
      actionLog.push({ tick: state.day, type: `event:${dueEvent.id}:option-${index}:${option.id}`, accepted: true })
      causalLog.push(causalEntry(state, 'milestone', `event:${dueEvent.id}:${option.id}`))
    }

    if (state.day >= nextUpgradeDay && purchasedUpgradeIds.length < MAX_UPGRADE_PURCHASES) {
      if (affordableAuthoredUpgrades(state).length > 0) eligibleUpgradeOpportunities += 1
      const upgrade = chooseAffordableUpgrade(policyId, state)
      if (upgrade) {
        const beforeFunding = state
        state = fundAuthoredUpgrade(state, upgrade)
        const accepted = state.flags.includes(`pill:upgrade:${upgrade.id}`)
        actionLog.push({ tick: state.day, type: `upgrade:${upgrade.id}`, accepted })
        if (accepted) {
          purchasedUpgradeIds.push(upgrade.id)
          causalLog.push(causalEntry(state, 'milestone', `upgrade:${upgrade.id}`))
        } else state = beforeFunding
      }
      nextUpgradeDay = state.day + UPGRADE_CADENCE_DAYS
    }

    const before = state
    const newVisibleWarning = before.warning !== null && before.warning.kind !== lastDecisionWarning
    if (before.day >= nextDecisionDay || newVisibleWarning) {
      const selected = policy.decide(observeAgiPill(before))
      if (selected !== before.policy) {
        state = transitionAgiPill(before, { type: 'set-policy', policy: selected })
        actionLog.push({ tick: before.day, type: `set-policy:${selected}`, accepted: state.policy === selected })
      }
      lastDecisionWarning = before.warning?.kind ?? null
      nextDecisionDay = before.day + DECISION_CADENCE_DAYS
    }

    const preTick = state
    state = transitionAgiPill(preTick, { type: 'tick' })
    const metrics = agiPillMetrics(state)
    const newlyAdverse = state.warning !== null && state.warning.kind !== preTick.warning?.kind
    if (newlyAdverse) {
      adverseEvents += 1
      unresolvedAdverse += 1
      causalLog.push(causalEntry(state, 'incident', `adverse-${adverseEvents}`))
    }
    const recovered = unresolvedAdverse > 0 && preTick.warning !== null && state.warning === null
    if (recovered) {
      recoveredAdverseEvents += unresolvedAdverse
      unresolvedAdverse = 0
      causalLog.push(causalEntry(state, 'recovery', `recovery-${recoveredAdverseEvents}`))
    }

    if (state.warning && state.warning.kind !== activeWarningKind) {
      causalLog.push(causalEntry(state, 'warning', state.warning.kind))
      activeWarningKind = state.warning.kind
    } else if (!state.warning) activeWarningKind = null

    if (state.milestones.length > preTick.milestones.length) {
      for (const milestone of state.milestones.filter((id) => !preTick.milestones.includes(id))) {
        causalLog.push(causalEntry(state, 'milestone', milestone))
      }
    }

    const starving = state.resourceCrisisDays > 0
    starvationStreak = starving ? starvationStreak + 1 : 0
    longestStarvation = Math.max(longestStarvation, starvationStreak)
    if (starving && metrics.canRecover) recoveriesAvailableDuringStarvation += 1
    const inoperable = starving && !metrics.canRecover
    inoperableStreak = inoperable ? inoperableStreak + 1 : 0
    longestInoperable = Math.max(longestInoperable, inoperableStreak)

    peakResources.intelligence = Math.max(peakResources.intelligence, state.intelligence)
    peakResources.compute = Math.max(peakResources.compute, state.compute)
    peakResources.energy = Math.max(peakResources.energy, state.energy)
    peakResources.robotics = Math.max(peakResources.robotics, state.robots)
    peakResources.resources = Math.max(peakResources.resources, state.resources)
  }

  if (state.terminal || state.outcome !== 'active') causalLog.push(causalEntry(state, 'ending', state.outcome))
  const classified = outcomeClass(state)
  return {
    harnessVersion: 1,
    policyId,
    seed: options.seed,
    repeat: options.repeat ?? 0,
    terminal: state.terminal || state.outcome === 'pluralistic-expansion',
    ticks: state.day,
    endingId: state.outcome,
    outcomeClass: classified,
    score: score(state),
    // A Dyson swarm alone is explicitly a midgame gate, never a win. Only an
    // authored post-Dyson outcome (or future managed ending) counts as success.
    success: classified === 'plural-expansion' || classified === 'managed-transition',
    resources: {
      intelligence: round(state.intelligence),
      compute: round(state.compute),
      energy: round(state.energy),
      robotics: round(state.robots),
      resources: round(state.resources),
      safety: round(state.safety),
      governance: round(state.governance),
      friction: round(state.friction),
      risk: round(state.risk),
      orbitalIndustry: round(state.expansion.orbitalIndustry),
      dysonProgress: round(state.expansion.dysonProgress),
      postDysonExpansion: round(state.expansion.postDysonExpansion),
    },
    peakResources: Object.fromEntries(Object.entries(peakResources).map(([key, value]) => [key, round(value)])),
    actionLog,
    causalLog,
    longestInoperableTicks: longestInoperable,
    longestResourceStarvationTicks: longestStarvation,
    recoveriesAvailableDuringStarvation,
    adverseEvents,
    recoveredAdverseEvents,
    dueEventCount,
    executedEventCount,
    eventOptionIds,
    eligibleUpgradeOpportunities,
    upgradePurchases: purchasedUpgradeIds.length,
    purchasedUpgradeIds,
    fingerprint: fingerprint(state, actionLog, causalLog),
  }
}

export const pillBatchSeeds = (count = 12): readonly number[] => Array.from(
  { length: count },
  (_, index) => (0xA91_0000 + Math.imul(index + 1, 0x9E37_79B1)) >>> 0,
)
