import type {
  PillBatchReport,
  PillInvariantFinding,
  PillPolicyId,
  PillPolicySummary,
  PillWorldlineResult,
} from './types'

const mean = (values: readonly number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0

const counts = (values: readonly string[]): Readonly<Record<string, number>> =>
  Object.fromEntries([...new Set(values)].sort().map((value) => [
    value,
    values.filter((candidate) => candidate === value).length,
  ]))

const keyOf = ({ policyId, seed, repeat }: PillWorldlineResult) => `${policyId}:${seed}:r${repeat}`
const scenarioKeyOf = ({ policyId, seed }: PillWorldlineResult) => `${policyId}:${seed}`

const summarizePolicy = (policyId: PillPolicyId, runs: readonly PillWorldlineResult[]): PillPolicySummary => {
  const selected = runs.filter((run) => run.policyId === policyId)
  const adverse = selected.reduce((sum, run) => sum + run.adverseEvents, 0)
  return {
    policyId,
    runs: selected.length,
    successes: selected.filter((run) => run.success).length,
    successRate: selected.length ? selected.filter((run) => run.success).length / selected.length : 0,
    meanScore: mean(selected.map((run) => run.score)),
    endings: counts(selected.map((run) => run.endingId)),
    outcomes: counts(selected.map((run) => run.outcomeClass)),
    meanAcceptedActions: mean(selected.map((run) => run.actionLog.filter(({ accepted }) => accepted).length)),
    recoveryRate: adverse
      ? selected.reduce((sum, run) => sum + run.recoveredAdverseEvents, 0) / adverse
      : 1,
    meanEventsExecuted: mean(selected.map((run) => run.executedEventCount)),
    meanUpgradePurchases: mean(selected.map((run) => run.upgradePurchases)),
  }
}

const finding = (
  id: PillInvariantFinding['id'],
  severity: PillInvariantFinding['severity'],
  detail: string,
  runs: readonly PillWorldlineResult[] = [],
): PillInvariantFinding => ({ id, severity, detail, runKeys: runs.map(keyOf) })

export const analyzePillWorldlines = (
  runs: readonly PillWorldlineResult[],
  options: {
    generatedAt?: string
    maxStarvationTicks?: number
    maxInoperableTicks?: number
    dominantWinnerShare?: number
  } = {},
): PillBatchReport => {
  const policyIds = [...new Set(runs.map(({ policyId }) => policyId))].sort()
  const seedCount = new Set(runs.map(({ seed }) => seed)).size
  const byPolicy = Object.fromEntries(policyIds.map((id) => [id, summarizePolicy(id, runs)]))
  const findings: PillInvariantFinding[] = []

  const nondeterministic = [...new Set(runs.map(scenarioKeyOf))].flatMap((scenarioKey) => {
    const repeated = runs.filter((run) => scenarioKeyOf(run) === scenarioKey)
    return new Set(repeated.map(({ fingerprint }) => fingerprint)).size > 1 ? repeated : []
  })
  findings.push(finding(
    'determinism',
    nondeterministic.length ? 'fail' : 'pass',
    nondeterministic.length
      ? `${new Set(nondeterministic.map(scenarioKeyOf)).size} policy/seed pairs changed across exact repeats.`
      : 'Every exact policy/seed repeat produced the same normalized fingerprint.',
    nondeterministic,
  ))

  const activePolicies = policyIds.filter((id) => byPolicy[id].meanAcceptedActions > 0)
  const distinctOutcomeSignatures = new Set(policyIds.map((id) => JSON.stringify(byPolicy[id].outcomes))).size
  const diversityPass = policyIds.length >= 6 && activePolicies.length >= 5 && distinctOutcomeSignatures >= 3
  findings.push(finding(
    'policy-diversity',
    diversityPass ? 'pass' : 'fail',
    `${policyIds.length} policies, ${activePolicies.length} active policies, ${distinctOutcomeSignatures} distinct outcome signatures.`,
  ))

  const viablePolicies = policyIds.filter((id) => byPolicy[id].successes > 0)
  findings.push(finding(
    'viable-strategies',
    viablePolicies.length >= 2 ? 'pass' : 'fail',
    viablePolicies.length
      ? `${viablePolicies.length} policies reached at least one successful trajectory: ${viablePolicies.join(', ')}.`
      : 'No policy reached a successful trajectory; the batch exposes no playable win path.',
  ))

  const comparable = runs.filter(({ repeat }) => repeat === 0)
  const winsByPolicy = Object.fromEntries(policyIds.map((id) => [id, 0])) as Record<string, number>
  const uniqueSeeds = [...new Set(comparable.map(({ seed }) => seed))]
  for (const seed of uniqueSeeds) {
    const candidates = comparable.filter((run) => run.seed === seed)
    const successful = candidates.filter(({ success }) => success)
    const objectiveCandidates = successful.length ? successful : candidates
    const bestQuality = Math.max(...objectiveCandidates.map(({ score }) => score))
    for (const candidate of objectiveCandidates.filter(({ score }) => score === bestQuality)) winsByPolicy[candidate.policyId] += 1
    if (successful.length) {
      const fastest = Math.min(...successful.map(({ ticks }) => ticks))
      for (const candidate of successful.filter(({ ticks }) => ticks === fastest)) winsByPolicy[candidate.policyId] += 1
    }
  }
  const totalWins = Object.values(winsByPolicy).reduce((sum, value) => sum + value, 0)
  const dominantWins = Math.max(0, ...Object.values(winsByPolicy))
  const dominantShare = totalWins ? dominantWins / totalWins : 1
  const dominantThreshold = options.dominantWinnerShare ?? 0.6
  findings.push(finding(
    'single-optimum',
    dominantShare >= dominantThreshold ? 'fail' : 'pass',
    `Quality-or-speed objective share for the most dominant policy was ${(dominantShare * 100).toFixed(1)}% (${JSON.stringify(winsByPolicy)}).`,
  ))

  const passiveWins = runs.filter(({ policyId, success }) => policyId === 'passive' && success)
  findings.push(finding(
    'automatic-passive-win',
    passiveWins.length ? 'fail' : 'pass',
    passiveWins.length ? `${passiveWins.length} passive runs reached a successful outcome.` : 'Passive play never won automatically.',
    passiveWins,
  ))

  const maxStarvationTicks = options.maxStarvationTicks ?? 48
  const maxInoperableTicks = options.maxInoperableTicks ?? 24
  const deadlocks = runs.filter((run) =>
    run.longestResourceStarvationTicks > maxStarvationTicks
    && run.longestInoperableTicks > maxInoperableTicks
    && run.recoveriesAvailableDuringStarvation === 0)
  findings.push(finding(
    'resource-deadlock',
    deadlocks.length ? 'fail' : 'pass',
    deadlocks.length
      ? `${deadlocks.length} runs exceeded both starvation and inoperability bounds without an available recovery action.`
      : 'No prolonged resource starvation became an actionless deadlock.',
    deadlocks,
  ))

  const opaqueDeaths = runs.filter((run) => {
    // Stagnation is a recoverable nonterminal trajectory, not an "instant
    // death". This invariant applies only to actual catastrophic terminals.
    if (!run.terminal || !['accident', 'misalignment', 'capture'].includes(run.outcomeClass)) return false
    const ending = run.causalLog.findLast(({ kind }) => kind === 'ending')
    const priorWarnings = run.causalLog.filter(({ kind, tick, playerFacing }) =>
      kind === 'warning' && playerFacing && (!ending || tick < ending.tick))
    return !ending?.playerFacing || ending.causes.length === 0 || priorWarnings.length === 0
  })
  findings.push(finding(
    'opaque-instant-death',
    opaqueDeaths.length ? 'fail' : 'pass',
    opaqueDeaths.length
      ? `${opaqueDeaths.length} catastrophic endings lacked a visible warning, player-facing ending, or explicit cause chain.`
      : 'Every catastrophic ending had a player-visible warning and explicit ending causes.',
    opaqueDeaths,
  ))

  const adverse = runs.reduce((sum, run) => sum + run.adverseEvents, 0)
  const recovered = runs.reduce((sum, run) => sum + run.recoveredAdverseEvents, 0)
  const recoveryRate = adverse ? recovered / adverse : 1
  findings.push(finding(
    'recovery-legibility',
    recoveryRate < 0.2 ? 'fail' : 'pass',
    `${recovered}/${adverse} adverse events were followed by a recorded recovery (${(recoveryRate * 100).toFixed(1)}%).`,
  ))

  const missedEvents = runs.filter((run) => run.executedEventCount !== run.dueEventCount)
  const eligibleActiveRuns = runs.filter((run) => run.policyId !== 'passive' && run.eligibleUpgradeOpportunities > 0)
  const unfundedActiveRuns = eligibleActiveRuns.filter((run) => run.upgradePurchases === 0)
  const uniqueEventOptions = new Set(runs.flatMap((run) => run.eventOptionIds))
  const uniqueEvents = new Set([...uniqueEventOptions].map((id) => id.slice(0, id.lastIndexOf(':'))))
  const uniqueUpgrades = new Set(runs.flatMap((run) => run.purchasedUpgradeIds))
  const authoredPass = missedEvents.length === 0
    && runs.some((run) => run.executedEventCount > 0)
    && eligibleActiveRuns.length > 0
    && unfundedActiveRuns.length === 0
    && uniqueEvents.size >= 5
    && uniqueEventOptions.size >= 8
    && uniqueUpgrades.size >= 10
  findings.push(finding(
    'authored-systems-exercised',
    authoredPass ? 'pass' : 'fail',
    `${runs.reduce((sum, run) => sum + run.executedEventCount, 0)} due event choices executed across ${uniqueEvents.size} events/${uniqueEventOptions.size} options; ${runs.reduce((sum, run) => sum + run.upgradePurchases, 0)} affordable upgrades funded across ${uniqueUpgrades.size} programs; missed events=${missedEvents.length}; unfunded active runs=${unfundedActiveRuns.length}.`,
    [...missedEvents, ...unfundedActiveRuns],
  ))

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    synthetic: true,
    runCount: runs.length,
    uniqueWorldlines: new Set(runs.map(scenarioKeyOf)).size,
    policyCount: policyIds.length,
    seedCount,
    outcomeDistribution: counts(runs.map(({ outcomeClass }) => outcomeClass)),
    endingDistribution: counts(runs.map(({ endingId }) => endingId)),
    byPolicy,
    findings,
    pass: findings.every(({ severity }) => severity !== 'fail'),
    limitations: [
      'These are deterministic synthetic policies, not observations of real players.',
      'The harness can test engine causality and option availability, but not whether the browser UI communicates them clearly.',
      'Balance thresholds are diagnostic guardrails; product tuning must not be changed merely to make this report green.',
    ],
  }
}
