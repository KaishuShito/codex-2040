import {
  computeEconomy,
  humanExtinctionRisk,
  metrics,
  upgradeCost,
  type GameAction,
  type GameState,
  type RegionId,
} from '../../src/engine'
import { getStrategyNodeAvailability } from '../../src/engine'
import type { PlayPolicy } from '../harness'

const availability = (state: Readonly<GameState>, nodeId: string) =>
  getStrategyNodeAvailability(state as GameState, nodeId)

const buyIfReady = (state: Readonly<GameState>, nodeId: string, reserve = 0): GameAction | null => {
  const status = availability(state, nodeId)
  return status?.status === 'ready' && state.compute >= status.cost + reserve
    ? { type: 'strategy-node', nodeId }
    : null
}

const regionPriority: readonly RegionId[] = ['africa', 'mena', 'oceania']

/**
 * A cautious but active operator. Every branch reads production telemetry:
 * control gaps and extinction risk gate capability, while adoption, market
 * share, PF cash flow, and momentum determine distribution investments.
 */
const policy: PlayPolicy = {
  id: 'agent-03-adaptive-balanced',
  description: 'Adaptive balanced operator: protects trust/control first, restores stalled access, and scales models only behind safety and governance.',
  choice2029: 'verified-slowdown',
  choice2035: 'hold-the-line',
  decide: (state, context) => {
    const current = metrics(state as GameState)
    const extinctionRisk = humanExtinctionRisk(state as GameState)
    const economy = computeEconomy(state as GameState)
    const strongestRivalShare = Math.max(...state.rivalShares)
    const behindMarketLeader = current.codexShare + 0.025 < strongestRivalShare
    const accessStalled = current.worldAdoption < 0.08 || state.momentumDays < 30
    const hasUsedLifeline = state.flags.includes('lifeline:used')

    // Visible PF bubbles are a short-lived, zero-trade-off recovery verb. An
    // attentive player collects one per simulated decision step.
    const rewardBubble = state.rewardBubbles[0]
    if (rewardBubble) return { type: 'collect-bubble', bubbleId: rewardBubble.id }

    // A one-time recovery is preferable to an inert multi-year brownout.
    if (state.compute < 45 && !hasUsedLifeline) return { type: 'compute-lifeline' }

    // Never let capability compound a material control gap. Risk is a second,
    // independent signal because it retains the history of unsafe exposure.
    const danger = extinctionRisk >= 0.15
      || current.safetyGap >= 1.25
      || current.governanceGap >= 1.25
      || state.trust < 45
    if (danger) {
      const safetyPriority = extinctionRisk >= 0.15
        || current.safetyGap > current.governanceGap + 0.2
        || state.safety <= state.governance
      const first = safetyPriority ? 'company-safety' : 'company-policy'
      const second = safetyPriority ? 'company-policy' : 'company-safety'
      const emergency = extinctionRisk >= 0.15
        || current.safetyGap >= 2.5
        || current.governanceGap >= 2.5
      const reserve = emergency ? 0 : 75
      const defensiveAction = buyIfReady(state, first, reserve) ?? buyIfReady(state, second, reserve)
      if (defensiveAction) return defensiveAction
    }

    // Establish real local presences while access is still low. The reserve
    // avoids spending the final PF on a rollout that cannot be supported.
    if (current.worldAdoption < 0.08 && state.momentumDays < 30 && state.compute >= 95) {
      const region = regionPriority.find((id) => !state.regions.find((item) => item.id === id)?.introduced)
      if (region) return { type: 'introduce', region }
    }

    // Distribution is the response to low access or a rival lead. These are
    // deliberately ordered from broad reach to durable institutional demand.
    if ((accessStalled || behindMarketLeader) && state.momentumDays < 30) {
      for (const nodeId of ['product-mobile', 'product-sso', 'product-education', 'product-offline-lite', 'product-public-services']) {
        const productAction = buyIfReady(state, nodeId, 100)
        if (productAction) return productAction
      }
      if (state.resetCooldownSeconds <= 0) return { type: 'reset' }
    }

    // Capability moves only when both control axes are already at parity and
    // PF can absorb the authored node cost. Stop at K8 under the safe branches.
    if (state.capability < 8
      && state.safety >= state.capability
      && state.governance >= state.capability
      && extinctionRisk < 0.1
      && state.trust >= 60
      && state.momentumDays < 15) {
      for (const nodeId of ['model-foundation', 'model-reasoning', 'model-agents', 'model-frontier']) {
        const node = availability(state, nodeId)
        if (node?.status !== 'ready') continue
        const nextCapability = Math.min(10, state.capability + 1)
        const safetyCatchup = state.safety < nextCapability ? upgradeCost(state as GameState, 'safety') : 0
        const governanceCatchup = state.governance < nextCapability ? upgradeCost(state as GameState, 'governance') : 0
        const modelAction = state.compute >= node.cost + safetyCatchup + governanceCatchup + 180
          ? { type: 'strategy-node' as const, nodeId }
          : null
        if (modelAction) return modelAction
      }
    }

    // When the model advanced by one step, restore parity before considering
    // another capability purchase even if the extinction meter is still zero.
    if (state.safety < state.capability) {
      const safetyAction = buyIfReady(state, 'company-safety', 75)
      if (safetyAction) return safetyAction
    }
    if (state.governance < state.capability) {
      const governanceAction = buyIfReady(state, 'company-policy', 75)
      if (governanceAction) return governanceAction
    }

    // Low or negative cash flow justifies a bounded efficiency investment,
    // but never at the cost of another self-created PF drought.
    if (economy.net < -0.2 && state.efficiency < 2 && state.momentumDays < 30) {
      const efficiencyAction = buyIfReady(state, 'company-datacenter', 200)
      if (efficiencyAction) return efficiencyAction
    }

    // Build inspectable institutions when trust is merely soft, rather than
    // waiting for a full emergency.
    if (state.trust < 68 && state.momentumDays < 30) {
      for (const nodeId of ['company-transparency', 'company-incident-drills', 'company-policy-lab']) {
        const trustAction = buyIfReady(state, nodeId, 100)
        if (trustAction) return trustAction
      }
    }

    // Refresh momentum when nothing higher-value is affordable. The day guard
    // prevents an immediate reset from masking the opening decisions.
    if (context.simulatedYear >= 2027
      && state.momentumDays < 20
      && state.resetCooldownSeconds <= 0) return { type: 'reset' }

    return null
  },
}

export default policy
