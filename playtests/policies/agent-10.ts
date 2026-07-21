import {
  computeEconomy,
  getStrategyNodeAvailability,
  humanExtinctionRisk,
  metrics,
  type GameAction,
  type GameState,
  type RegionId,
} from '../../src/engine'
import type { PlayPolicy } from '../harness'

const readyNode = (
  state: Readonly<GameState>,
  nodeId: string,
  reserve = 0,
): GameAction | null => {
  const availability = getStrategyNodeAvailability(state as GameState, nodeId)
  return availability?.status === 'ready' && state.compute >= availability.cost + reserve
    ? { type: 'strategy-node', nodeId }
    : null
}

const firstReady = (
  state: Readonly<GameState>,
  nodeIds: readonly string[],
  reserve = 0,
): GameAction | null => {
  for (const nodeId of nodeIds) {
    const action = readyNode(state, nodeId, reserve)
    if (action) return action
  }
  return null
}

const regionsByGrowthPotential: readonly RegionId[] = ['africa', 'mena', 'oceania']

const launchProducts = [
  'product-mobile',
  'product-sso',
  'product-education',
  'product-connectors',
] as const

const growthProducts = [
  'product-crisis-response',
  'product-public-services',
  'product-offline-lite',
  'product-research',
  'product-analysis',
  'product-watermark',
  'product-voice-companion',
  'product-agent-workspace',
  'product-interop-first',
  'product-classroom-suite',
  'product-universal-access',
] as const

const enablingModels = [
  'model-foundation',
  'model-reasoning',
  'model-agents',
  'model-distillation',
  'model-multilingual',
  'model-efficient-inference',
] as const

/**
 * Product-led growth operator. Products must earn distribution rather than a
 * frontier-model race doing so by itself. It opens underserved regions,
 * collects every short-lived PF bubble, finances recurring product launches
 * with efficient data centers, and buys only the model capability required by
 * an authored product prerequisite. Safety and governance pre-empt growth well
 * before either control gap can reach three points.
 */
const policy: PlayPolicy = {
  id: 'agent-10-product-growth-hacker',
  description: 'Product-led growth hacker: ship access features, open underserved regions, improve data-center economics, and use Token Reset while keeping both control gaps below three.',
  choice2029: 'verified-slowdown',
  choice2035: 'hold-the-line',
  decide: (state, context) => {
    const current = metrics(state as GameState)
    const economy = computeEconomy(state as GameState)
    const risk = humanExtinctionRisk(state as GameState)

    // Bubbles expire in wall-clock time, so collecting them is always the
    // highest-priority tactical interaction after a launch or community event.
    const bubble = state.rewardBubbles[0]
    if (bubble) return { type: 'collect-bubble', bubbleId: bubble.id }

    // Use the explicitly authored one-time recovery instead of becoming an
    // inert player after an over-ambitious product launch.
    if (state.compute < 45 && !state.flags.includes('lifeline:used')) {
      return { type: 'compute-lifeline' }
    }

    // Growth never borrows more than two control levels from the future. The
    // tighter 1.5-point trigger leaves margin for product governance loads.
    const safetyGap = state.capability - state.safety
    const governanceGap = state.capability - state.governance
    if (risk >= 0.08 || safetyGap >= 1.5) {
      const safety = readyNode(state, 'company-safety', 45)
      if (safety) return safety
    }
    if (governanceGap >= 1.5) {
      const governance = readyNode(state, 'company-policy', 45)
      if (governance) return governance
    }

    // Start with a visible growth beat and exercise the complete production
    // TOKEN RESET -> three collectible PF bubbles interaction.
    if (context.actionsTaken === 0 && state.resetCooldownSeconds <= 0) {
      return { type: 'reset' }
    }

    // Establish local Codex presences before global product effects compound.
    // Africa is first because its population and mobile affinity make Mobile
    // SDK and Education Mode investments immediately legible.
    if (state.compute >= 120) {
      const region = regionsByGrowthPotential.find((id) =>
        !state.regions.find((candidate) => candidate.id === id)?.introduced)
      if (region) return { type: 'introduce', region }
    }

    // The two launch products produce both consumer reach and institutional
    // revenue; Education and Connectors then deepen those channels.
    const launch = firstReady(state, launchProducts, 100)
    if (launch) return launch

    // One control level unlocks data centers and accountable public products.
    if (state.safety < 3) {
      const safety = readyNode(state, 'company-safety', 100)
      if (safety) return safety
    }
    if (state.governance < 3) {
      const governance = readyNode(state, 'company-policy', 100)
      if (governance) return governance
    }

    // Improve unit economics early and again whenever PF cash flow is weak.
    // Efficiency is capped by production at 3, so this cannot loop forever.
    if (state.efficiency < 1.75 || (economy.net < 0.25 && state.efficiency < 3)) {
      const datacenter = readyNode(state, 'company-datacenter', 130)
      if (datacenter) return datacenter
    }

    // Buy only the model nodes that unlock products. Control parity is restored
    // before every additional capability point.
    if (state.safety < state.capability) {
      const safety = readyNode(state, 'company-safety', 75)
      if (safety) return safety
    }
    if (state.governance < state.capability) {
      const governance = readyNode(state, 'company-policy', 75)
      if (governance) return governance
    }
    if (state.capability < 4 && risk < 0.05) {
      const model = firstReady(state, enablingModels.slice(0, 3), 160)
      if (model) return model
    }

    // Accountability is a product enabler, not a separate end in itself.
    const productGovernance = firstReady(state, [
      'company-transparency',
      'company-incident-drills',
      'company-policy-lab',
      'company-red-team',
    ], 110)
    if (productGovernance) return productGovernance

    // Distillation and multilingual inference unlock the low-cost and
    // classroom branches after core product-market fit is established.
    const enablingModel = firstReady(state, enablingModels.slice(3), 170)
    if (enablingModel && state.safety >= state.capability && state.governance >= state.capability) {
      return enablingModel
    }

    const product = firstReady(state, growthProducts, 120)
    if (product) return product

    // Grid capacity protects the PF engine supporting the expanded portfolio.
    const grid = readyNode(state, 'company-grid-partnership', 160)
    if (grid) return grid

    // Refresh growth only when momentum is almost gone. Collecting its three
    // bubbles on the following days makes the small PF reward player-visible.
    if (state.momentumDays <= 18 && state.resetCooldownSeconds <= 0) {
      return { type: 'reset' }
    }

    // A rival lead calls for another product pulse, not unsafe capability.
    const leadingRival = Math.max(...state.rivalShares)
    if (leadingRival > current.codexShare + 0.03
      && state.momentumDays <= 35
      && state.resetCooldownSeconds <= 0) {
      return { type: 'reset' }
    }

    return null
  },
}

export default policy
