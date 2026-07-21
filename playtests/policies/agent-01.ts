import {
  getStrategyNodeAvailability,
  metrics,
  type GameAction,
  type GameState,
} from '../../src/engine'
import type { PlayDecisionContext, PlayPolicy } from '../harness'

const hasFlag = (state: Readonly<GameState>, flag: string) => state.flags.includes(flag)

const readyNode = (state: Readonly<GameState>, nodeId: string): GameAction | null =>
  getStrategyNodeAvailability(state as GameState, nodeId)?.status === 'ready'
    ? { type: 'strategy-node', nodeId }
    : null

const readyNodeWithReserve = (
  state: Readonly<GameState>,
  nodeId: string,
  reserve = 90,
): GameAction | null => {
  const availability = getStrategyNodeAvailability(state as GameState, nodeId)
  return availability?.status === 'ready' && state.compute - availability.cost >= reserve
    ? { type: 'strategy-node', nodeId }
    : null
}

const firstReadyNode = (state: Readonly<GameState>, nodeIds: readonly string[]): GameAction | null => {
  for (const nodeId of nodeIds) {
    const action = readyNode(state, nodeId)
    if (action) return action
  }
  return null
}

const firstReadyNodeWithReserve = (
  state: Readonly<GameState>,
  nodeIds: readonly string[],
  reserve = 90,
): GameAction | null => {
  for (const nodeId of nodeIds) {
    const action = readyNodeWithReserve(state, nodeId, reserve)
    if (action) return action
  }
  return null
}

const unintroducedRegion = (state: Readonly<GameState>): GameAction | null => {
  if (state.compute < 45) return null
  // Large underserved regions first, then the small but credible Oceania baseline.
  for (const regionId of ['africa', 'mena', 'oceania'] as const) {
    if (!state.regions.find((region) => region.id === regionId)?.introduced) {
      return { type: 'introduce', region: regionId }
    }
  }
  return null
}

const controlAction = (state: Readonly<GameState>): GameAction | null => {
  const safetyShortfall = state.capability - state.safety
  const governanceShortfall = state.capability - state.governance
  if (safetyShortfall >= governanceShortfall && safetyShortfall >= 0) {
    return readyNode(state, 'company-safety')
  }
  if (governanceShortfall >= 0) return readyNode(state, 'company-policy')
  return null
}

const buildControlBuffer = (state: Readonly<GameState>, target: number): GameAction | null => {
  if (state.safety < target && state.safety <= state.governance) {
    return firstReadyNode(state, [
      'company-incident-drills',
      'company-red-team',
      'company-safety',
      'model-secure-enclave',
      'company-alignment-institute',
    ])
  }
  if (state.governance < target) {
    return firstReadyNode(state, [
      'company-policy-lab',
      'company-worker-transition',
      'company-policy',
      'product-watermark',
      'company-distributed-oversight',
    ])
  }
  if (state.safety < target) {
    return firstReadyNode(state, [
      'company-incident-drills',
      'company-red-team',
      'company-safety',
      'model-secure-enclave',
      'company-alignment-institute',
    ])
  }
  return null
}

const essentialAccessPortfolio = [
  'product-mobile',
  'product-sso',
  'product-education',
  'ecosystem-open',
] as const

const accessPortfolio = [
  'ecosystem-partners',
  'product-offline-lite',
  'company-transparency',
  'product-watermark',
  'product-public-services',
  'product-crisis-response',
  'ecosystem-open-standards',
  'product-interop-first',
  'product-classroom-suite',
  'product-universal-access',
  'ecosystem-federated-safety',
  'ecosystem-public-compute',
  'ecosystem-commons',
] as const

const efficiencyPortfolio = [
  'company-datacenter',
  'model-distillation',
  'company-grid-partnership',
  'model-efficient-inference',
] as const

const nextBalancedModelStep = (state: Readonly<GameState>): GameAction | null => {
  // Continue only while a full pre-funded control level exists. This allows a
  // late, governed frontier step without ever borrowing safety from the future.
  if (state.capability >= 9) return null
  if (state.safety < state.capability + 1 || state.governance < state.capability + 1) return null
  return firstReadyNodeWithReserve(state, [
    'model-foundation',
    'model-reasoning',
    'model-verified-reasoning',
    'model-agents',
    'model-frontier',
  ])
}

const decide = (state: Readonly<GameState>, context: PlayDecisionContext): GameAction | null => {
  const currentMetrics = metrics(state as GameState)

  // The recovery action is intentionally one-shot and carries a real trust/share cost.
  if (state.compute < 45 && !hasFlag(state, 'lifeline:used')) return { type: 'compute-lifeline' }

  // A control gap is handled before every growth or capability action.
  const urgentControl = controlAction(state)
  if (urgentControl) return urgentControl

  // Begin with a no-cost pulse, then establish credible local access everywhere.
  if (context.actionsTaken === 0 && state.resetCooldownSeconds === 0) return { type: 'reset' }
  const regionAction = unintroducedRegion(state)
  if (regionAction) return regionAction

  // Preserve at least one full level of headroom before considering a model step.
  const desiredBuffer = Math.min(7, Math.floor(state.capability) + 1)
  const bufferedControl = buildControlBuffer(state, desiredBuffer)
  if (bufferedControl) return bufferedControl

  const plannedMoveWindow = state.momentumDays <= 45 || state.compute >= 1_200

  // Establish the minimum global distribution path before scaling capability.
  if (plannedMoveWindow) {
    const essentialAction = firstReadyNodeWithReserve(state, essentialAccessPortfolio)
    if (essentialAction) return essentialAction
  }

  // Build a useful but governed K5 before 2029 rather than leaving capability
  // investment until after the entire product and institution catalog.
  if (plannedMoveWindow && state.capability < 5) {
    const earlyModelAction = nextBalancedModelStep(state)
    if (earlyModelAction) return earlyModelAction
  }

  // Serving efficiency comes before the long-tail product portfolio when cashflow is weak.
  if (plannedMoveWindow && (state.compute < 600 || currentMetrics.worldAdoption < 0.10)) {
    const efficiencyAction = firstReadyNodeWithReserve(state, efficiencyPortfolio)
    if (efficiencyAction) return efficiencyAction
  }

  if (plannedMoveWindow) {
    const accessAction = firstReadyNodeWithReserve(state, accessPortfolio)
    if (accessAction) return accessAction
  }

  if (plannedMoveWindow) {
    const modelAction = nextBalancedModelStep(state)
    if (modelAction) return modelAction
  }

  // Late control institutions add resilience without widening the capability gap.
  if (plannedMoveWindow) {
    const institutionAction = firstReadyNodeWithReserve(state, [
      'company-incident-drills',
      'company-transparency',
      'company-red-team',
      'company-policy-lab',
      'company-worker-transition',
      'company-distributed-oversight',
      'company-alignment-institute',
    ])
    if (institutionAction) return institutionAction
  }

  // Refresh momentum only near exhaustion; the engine enforces the real-time cooldown.
  if (state.momentumDays <= 20 && state.resetCooldownSeconds === 0) return { type: 'reset' }
  // If reset is cooling down, a sufficiently healthy Codex share can be traded
  // for an open-market pulse rather than letting global access stall completely.
  if (state.momentumDays <= 10 && state.ecosystemCooldownSeconds === 0 && currentMetrics.codexShare >= 0.28) {
    return { type: 'open-ecosystem' }
  }

  // If all authored purchases are blocked or unaffordable, patiently bank PF.
  return null
}

const policy: PlayPolicy = {
  id: 'agent-01-safety-plan-a',
  description: 'Safety-first Plan A: keep Safety and Governance ahead of Capability, choose verified slowdown and hold the line, then pursue broad access through open and inclusive distribution.',
  choice2029: 'verified-slowdown',
  choice2035: 'hold-the-line',
  decide,
}

export default policy
