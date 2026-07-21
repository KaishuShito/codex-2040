export type AgiPillPhase = 'year-1-3' | 'year-3-5' | 'year-5-10' | 'post-dyson'

export type AgiPillPolicy =
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

export type AgiPillMetricKey =
  | 'intelligence'
  | 'compute'
  | 'energy'
  | 'robots'
  | 'resources'
  | 'safety'
  | 'governance'
  | 'friction'
  | 'risk'
  | 'rivalPressure'
  | 'orbitalIndustry'
  | 'dysonProgress'
  | 'postDysonExpansion'

export type AgiPillEffect = {
  metric: AgiPillMetricKey
  operation: 'add' | 'multiply' | 'set'
  value: number
}

export type RivalCivilization = {
  id: 'frontier-lab' | 'state-coalition' | 'open-collective'
  posture: 'competitive' | 'guarded' | 'cooperative'
  capability: number
  industrialBase: number
  expansion: number
  alignment: number
}

export type AgiPillExpansion = {
  orbitalIndustry: number
  dysonProgress: number
  dysonBuilt: boolean
  postDysonExpansion: number
}

export type AgiPillCause = {
  id:
    | 'intelligence-compute-loop'
    | 'energy-robot-loop'
    | 'resource-bottleneck'
    | 'safety-gap'
    | 'governance-gap'
    | 'social-friction'
    | 'rival-pressure'
    | 'orbital-relief'
    | 'physical-ceiling'
    | 'incident'
  direction: 'help' | 'harm' | 'limit'
  magnitude: number
}

export type AgiPillMilestone =
  | 'agi-research-loop'
  | 'robot-self-replication'
  | 'orbital-industry'
  | 'dyson-swarm'
  | 'solar-system-takeoff'

export type AgiPillOutcome =
  | 'active'
  | 'stagnation'
  | 'rival-takeover'
  | 'industrial-accident'
  | 'misalignment'
  | 'pluralistic-expansion'

export type AgiPillWarning = {
  kind: 'rival-capture' | 'industrial-cascade' | 'misalignment' | 'resource-lock'
  startedDay: number
  countdownDays: number
  recoveryPolicies: AgiPillPolicy[]
}

export type AgiPillBottleneck = 'compute' | 'experiments' | 'assurance' | 'robots' | 'energy' | 'resources' | 'permission'

export type AgiPillState = {
  version: 1
  mode: 'agi-pill'
  /** Large physical stocks are bounded logarithmic capacity indices, not raw units. */
  stockEncoding: 'bounded-log-index'
  day: number
  /** Stable initial seed for replay receipts. */
  runSeed: number
  /** Current uint32 deterministic RNG state. */
  seed: number
  policy: AgiPillPolicy
  phase: AgiPillPhase
  intelligence: number
  compute: number
  energy: number
  robots: number
  resources: number
  safety: number
  governance: number
  friction: number
  risk: number
  rivalCivilizations: RivalCivilization[]
  expansion: AgiPillExpansion
  milestones: AgiPillMilestone[]
  flags: string[]
  interventions: number
  incidentDebt: number
  unsafeDays: number
  resourceCrisisDays: number
  rivalDominanceDays: number
  stagnationDays: number
  lastCauses: AgiPillCause[]
  warning: AgiPillWarning | null
  outcome: AgiPillOutcome
  terminal: boolean
}

export type AgiPillAction =
  | { type: 'set-policy'; policy: AgiPillPolicy }
  | { type: 'tick'; days?: number }
  | { type: 'apply-effects'; effects: readonly AgiPillEffect[]; sourceId?: string }

export type AgiPillMetrics = {
  phase: AgiPillPhase
  scale: number
  researchVelocity: number
  industrialVelocity: number
  rivalPressure: number
  safetyGap: number
  governanceGap: number
  resourceHeadroom: number
  researchThroughput: number
  industrialThroughput: number
  primaryBottleneck: AgiPillBottleneck
  dysonBuilt: boolean
  canRecover: boolean
}
