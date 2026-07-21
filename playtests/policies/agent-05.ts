import {
  acquiredStrategyNodeIds,
  getStrategyNodeAvailability,
  metrics,
  type GameAction,
  type GameState,
  type RegionId,
} from '../../src/engine'
import type { PlayDecisionContext, PlayPolicy } from '../harness'

const unintroducedRegionOrder: readonly RegionId[] = ['africa', 'mena', 'oceania']

const oneTimeInstitutionalPath = [
  'ecosystem-open',
  'company-policy',
  'company-safety',
  'product-mobile',
  'product-sso',
  'company-transparency',
  'company-incident-drills',
  'ecosystem-partners',
  'product-education',
  'ecosystem-open-standards',
  'company-policy-lab',
  'product-watermark',
  'company-worker-transition',
  'company-red-team',
  'product-public-services',
  'company-distributed-oversight',
  'ecosystem-developer-grants',
  'ecosystem-crisis-mesh',
  'ecosystem-compute-fund',
  'ecosystem-federated-safety',
  'company-alignment-institute',
  'ecosystem-charter',
  'ecosystem-commons',
] as const

const readyNode = (state: Readonly<GameState>, nodeId: string): GameAction | null => {
  const availability = getStrategyNodeAvailability(state, nodeId)
  if (availability?.status !== 'ready') return null
  // After the one emergency compact, preserve enough liquidity for operations
  // instead of repeatedly buying an institution at the exact affordability edge.
  const operatingReserve = state.flags.includes('lifeline:used') && availability.cost > 0 ? 50 : 0
  return state.compute >= availability.cost + operatingReserve
    ? { type: 'strategy-node', nodeId }
    : null
}

const policy: PlayPolicy = {
  id: 'agent-05-governance-institution-builder',
  description: 'Trust/governance institution builder: safety and public accountability first, plural open ecosystem, restrained model scaling, verified slowdown in 2029 and hold-the-line in 2035.',
  choice2029: 'verified-slowdown',
  choice2035: 'hold-the-line',
  decide: (state: Readonly<GameState>, context: PlayDecisionContext): GameAction | null => {
    const acquired = new Set(acquiredStrategyNodeIds(state))

    // Establish the constitutional layer before pursuing distribution or scale.
    for (const nodeId of ['ecosystem-open', 'company-policy', 'company-safety'] as const) {
      if (!acquired.has(nodeId)) {
        const action = readyNode(state, nodeId)
        if (action) return action
      }
    }

    // Do not leave any region outside the institutional deployment model.
    // Keep a modest reserve so an unlucky event cannot immediately brown out.
    const missingRegion = unintroducedRegionOrder.find((id) => !state.regions.find((region) => region.id === id)?.introduced)
    if (missingRegion && state.compute >= 95) return { type: 'introduce', region: missingRegion }

    // Purchase each authored institution once; repeatable base nodes are handled
    // separately by the parity guard below rather than farmed blindly.
    for (const nodeId of oneTimeInstitutionalPath) {
      if (acquired.has(nodeId)) continue
      const action = readyNode(state, nodeId)
      if (action) return action
    }

    // Capability must never outrun either control axis. Maintain a full-point
    // buffer, preferring the weaker institution when both need investment.
    const safetyTarget = state.capability + 1
    const governanceTarget = state.capability + 1
    if (state.safety < safetyTarget || state.governance < governanceTarget) {
      const weakerNode = state.safety <= state.governance ? 'company-safety' : 'company-policy'
      const action = readyNode(state, weakerNode)
      if (action) return action
      const fallback = readyNode(state, weakerNode === 'company-safety' ? 'company-policy' : 'company-safety')
      if (fallback) return fallback
    }

    // One conservative capability step is allowed only after the institutional
    // path is mature and the budget/control buffers are visibly ample.
    if (
      context.simulatedYear >= 2032
      && state.capability < 3
      && state.safety >= 5
      && state.governance >= 5
      && state.compute >= 500
    ) {
      const action = readyNode(state, 'model-foundation')
      if (action) return action
    }

    // Preserve provider plurality if Codex begins to dominate despite the open
    // path. This is a deliberate share-for-trust trade rather than a growth hack.
    if (metrics(state).codexShare > 0.52 && state.ecosystemCooldownSeconds === 0) {
      return { type: 'open-ecosystem' }
    }

    // The one-shot lifeline is acceptable only as an emergency public compact.
    if (state.compute < 35 && !state.flags.includes('lifeline:used')) return { type: 'compute-lifeline' }

    // Periodic reset represents bounded public capacity releases and keeps the
    // simulation active without spending PF or centralising market share.
    if (state.resetCooldownSeconds === 0) return { type: 'reset' }

    return null
  },
}

export default policy
