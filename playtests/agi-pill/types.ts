export type PillPolicyId =
  | 'balanced'
  | 'passive'
  | 'overaccelerate'
  | 'safety-first'
  | 'industry-first'
  | 'governance-first'
  | 'compute-first'

export type EnginePillPolicy =
  | 'observe'
  | 'balanced'
  | 'accelerate'
  | 'safety-first'
  | 'governance-first'
  | 'industrialize'
  | 'resource-recovery'
  | 'cooperate'
  | 'expand-orbit'
  | 'build-dyson'
  | 'post-dyson'

export type PillObservation = Readonly<{
  tick: number
  intelligence: number
  compute: number
  energy: number
  robotics: number
  resources: number
  safety: number
  governance: number
  socialFriction: number
  alignmentRisk: number
  captureRisk: number
  orbitalCapacity: number
  dysonFraction: number
  warning: null | Readonly<{
    kind: 'misalignment' | 'industrial-cascade' | 'rival-capture' | 'resource-lock'
    countdownDays: number
    recoveryPolicies: readonly EnginePillPolicy[]
  }>
  terminal: boolean
}>

export type PillPolicy = Readonly<{
  id: PillPolicyId
  description: string
  decide: (observation: PillObservation) => EnginePillPolicy
}>

export type PillOutcomeClass =
  | 'breakthrough'
  | 'plural-expansion'
  | 'managed-transition'
  | 'stagnation'
  | 'capture'
  | 'accident'
  | 'misalignment'
  | 'incomplete'

export type PillActionRecord = Readonly<{
  tick: number
  type: string
  accepted: boolean
  reason?: string
}>

export type PillCausalRecord = Readonly<{
  tick: number
  kind: 'warning' | 'incident' | 'recovery' | 'milestone' | 'ending'
  id: string
  causes: readonly string[]
  playerFacing: boolean
}>

/**
 * Stable output contract for batch analysis. The engine-specific adapter owns
 * the translation from production state to this intentionally small schema.
 */
export type PillWorldlineResult = Readonly<{
  harnessVersion: 1
  policyId: PillPolicyId
  seed: number
  repeat: number
  terminal: boolean
  ticks: number
  endingId: string
  outcomeClass: PillOutcomeClass
  score: number
  success: boolean
  resources: Readonly<Record<string, number>>
  peakResources: Readonly<Record<string, number>>
  actionLog: readonly PillActionRecord[]
  causalLog: readonly PillCausalRecord[]
  longestInoperableTicks: number
  longestResourceStarvationTicks: number
  recoveriesAvailableDuringStarvation: number
  adverseEvents: number
  recoveredAdverseEvents: number
  dueEventCount: number
  executedEventCount: number
  eventOptionIds: readonly string[]
  eligibleUpgradeOpportunities: number
  upgradePurchases: number
  purchasedUpgradeIds: readonly string[]
  fingerprint: string
}>

export type PillPolicySummary = Readonly<{
  policyId: PillPolicyId
  runs: number
  successes: number
  successRate: number
  meanScore: number
  endings: Readonly<Record<string, number>>
  outcomes: Readonly<Record<string, number>>
  meanAcceptedActions: number
  recoveryRate: number
  meanEventsExecuted: number
  meanUpgradePurchases: number
}>

export type PillInvariantFinding = Readonly<{
  id:
    | 'determinism'
    | 'policy-diversity'
    | 'viable-strategies'
    | 'single-optimum'
    | 'automatic-passive-win'
    | 'resource-deadlock'
    | 'opaque-instant-death'
    | 'recovery-legibility'
    | 'authored-systems-exercised'
  severity: 'pass' | 'warn' | 'fail'
  detail: string
  runKeys: readonly string[]
}>

export type PillBatchReport = Readonly<{
  schemaVersion: 1
  generatedAt: string
  synthetic: true
  runCount: number
  uniqueWorldlines: number
  policyCount: number
  seedCount: number
  outcomeDistribution: Readonly<Record<string, number>>
  endingDistribution: Readonly<Record<string, number>>
  byPolicy: Readonly<Record<string, PillPolicySummary>>
  findings: readonly PillInvariantFinding[]
  pass: boolean
  limitations: readonly string[]
}>
