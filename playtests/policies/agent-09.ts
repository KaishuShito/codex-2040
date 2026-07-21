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

const readyNode = (state: Readonly<GameState>, nodeId: string, reserve = 0): GameAction | null => {
  const availability = getStrategyNodeAvailability(state as GameState, nodeId)
  return availability?.status === 'ready' && state.compute - availability.cost >= reserve
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

const regionPriority: readonly RegionId[] = ['africa', 'mena', 'oceania']

const openPortfolio = [
  'ecosystem-open',
  'ecosystem-partners',
  'ecosystem-developer-grants',
  'ecosystem-open-standards',
  'ecosystem-crisis-mesh',
  'ecosystem-compute-fund',
  'ecosystem-federated-safety',
  'ecosystem-charter',
  'ecosystem-commons',
] as const

const accessPortfolio = [
  'product-mobile',
  'product-sso',
  'product-education',
  'product-offline-lite',
  'product-public-services',
  'product-crisis-response',
  'product-interop-first',
  'product-universal-access',
] as const

const controlPortfolio = [
  'company-incident-drills',
  'company-transparency',
  'company-red-team',
  'company-policy-lab',
  'company-worker-transition',
  'company-distributed-oversight',
  'company-alignment-institute',
] as const

const efficiencyPortfolio = [
  'company-datacenter',
  'company-grid-partnership',
  'model-distillation',
  'model-efficient-inference',
] as const

/**
 * A pluralist Open Ecosystem operator. It treats viable rivals as shared
 * infrastructure, opens access in underserved regions, and keeps Safety and
 * Governance at least level with Capability. Open Ecosystem is used only when
 * concentration is visibly rising, so plurality does not erase Codex itself.
 */
const policy: PlayPolicy = {
  id: 'agent-09-open-ecosystem-pluralist',
  description: 'Open-ecosystem pluralist: share power when concentration rises, invest in regional access and federated safeguards, and preserve a healthy multi-provider market.',
  choice2029: 'verified-slowdown',
  choice2035: 'hold-the-line',
  decide: (state, context) => {
    const current = metrics(state as GameState)
    const risk = humanExtinctionRisk(state as GameState)
    const economy = computeEconomy(state as GameState)

    // Collectible PF is a short-lived, explicit player interaction. Taking it
    // first avoids conflating a missed VFX reward with a bad economy policy.
    const bubble = state.rewardBubbles[0]
    if (bubble) return { type: 'collect-bubble', bubbleId: bubble.id }

    if (state.compute < 45 && !state.flags.includes('lifeline:used')) {
      return { type: 'compute-lifeline' }
    }

    // A visible control shortfall pre-empts every access or market action.
    if (risk >= 0.08 || current.safetyGap >= 0.75 || state.safety < state.capability) {
      const safety = readyNode(state, 'company-safety', 45)
      if (safety) return safety
    }
    if (current.governanceGap >= 0.75 || state.governance < state.capability) {
      const governance = readyNode(state, 'company-policy', 45)
      if (governance) return governance
    }

    // Open with one reset so this lane exercises the production reward-bubble
    // loop and starts access momentum without spending PF.
    if (context.actionsTaken === 0 && state.resetCooldownSeconds <= 0) return { type: 'reset' }

    // Establish a real Codex presence in the three initially unintroduced
    // regions before global product effects are applied to them.
    if (state.compute >= 120) {
      const region = regionPriority.find((id) => !state.regions.find((item) => item.id === id)?.introduced)
      if (region) return { type: 'introduce', region }
    }

    // Open Pledge is free and establishes the authored pluralist tree. The
    // remaining early open nodes create market diversity and regional fit.
    const openFoundation = firstReady(state, openPortfolio.slice(0, 4), 100)
    if (openFoundation) return openFoundation

    // Safety institutions unlock federated safety while keeping the verified
    // slowdown credible. Transparency also turns plurality into public trust.
    if (state.safety < state.capability + 1) {
      const safety = readyNode(state, 'company-safety', 90)
      if (safety) return safety
    }
    if (state.governance < state.capability + 1) {
      const governance = readyNode(state, 'company-policy', 90)
      if (governance) return governance
    }
    const control = firstReady(state, controlPortfolio, 110)
    if (control) return control

    // A small, efficient K3 model is sufficient for broad access; this policy
    // does not join the frontier race merely to inflate capability.
    if (state.capability < 3 && state.safety >= 3 && state.governance >= 3) {
      const foundation = readyNode(state, 'model-foundation', 150)
      if (foundation) return foundation
    }

    if (economy.net <= 0 || state.efficiency < 1.75) {
      const efficiency = firstReady(state, efficiencyPortfolio, 120)
      if (efficiency) return efficiency
    }

    // Prefer authored access releases, then finish the full open ecosystem.
    if (current.worldAdoption < 0.20 || state.momentumDays < 45) {
      const access = firstReady(state, accessPortfolio, 120)
      if (access) return access
    }
    const matureOpen = firstReady(state, openPortfolio.slice(4), 100)
    if (matureOpen) return matureOpen

    // Use the repeatable declaration only to correct concentration. Requiring
    // both a Codex lead and HHI pressure prevents performative self-erasure.
    if (state.ecosystemCooldownSeconds <= 0
      && current.codexShare > 0.43
      && current.hhi > 0.34) {
      return { type: 'open-ecosystem' }
    }

    // Token Reset restores total-market momentum. The subsequent bubbles are
    // collected on following days by the first branch above.
    if (state.momentumDays < 20 && state.resetCooldownSeconds <= 0) return { type: 'reset' }

    return null
  },
}

export default policy
