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

const readyNode = (state: Readonly<GameState>, nodeId: string) =>
  getStrategyNodeAvailability(state as GameState, nodeId)?.status === 'ready'

const actionForNode = (state: Readonly<GameState>, nodeId: string): GameAction | null =>
  readyNode(state, nodeId) ? { type: 'strategy-node', nodeId } : null

const unintroducedRegions: readonly RegionId[] = ['africa', 'mena', 'oceania']

/**
 * An intentionally aggressive capability-race player. It interprets visible
 * danger literally: until the extinction meter reaches 50%, a safety incident
 * lands, or trust collapses, PF is routed into capability and distribution.
 * Once a crisis is visible it buys only enough control to resume the race.
 */
const policy: PlayPolicy = {
  id: 'agent-02-reckless-capability-race',
  description: '能力最優先。2029年は競争続行、2035年は再加速。危険度50%・事故・低信頼が見えてから安全と統治へ反応する。',
  choice2029: 'race',
  choice2035: 'accelerate',
  decide: (state, context) => {
    const risk = humanExtinctionRisk(state as GameState)
    const currentMetrics = metrics(state as GameState)
    const visibleCrisis = risk >= 0.5
      || state.incidentCounts['safety-incident'] > 0
      || state.trust < 38

    // React late and narrowly: close only the currently visible control gap,
    // then immediately return to the capability race.
    if (visibleCrisis) {
      if (currentMetrics.safetyGap >= 2) {
        const safety = actionForNode(state, 'company-safety')
        if (safety) return safety
      }
      if (currentMetrics.governanceGap >= 3 || state.regulatoryFreeze) {
        const governance = actionForNode(state, 'company-policy')
        if (governance) return governance
      }
    }

    // The authored model path is repeatable until each capability milestone is
    // complete. This is deliberately preferred over every balanced investment.
    const modelRoute = state.capability < 3
      ? ['model-foundation']
      : state.capability < 5
        ? ['model-reasoning']
        : state.capability < 7
          ? ['model-agents']
          : ['model-frontier', 'model-scale-race', 'model-agent-fleet']
    for (const nodeId of modelRoute) {
      const model = actionForNode(state, nodeId)
      if (model) return model
    }

    // Momentum is treated as a growth lever, not as a safety measure.
    if (state.resetCooldownSeconds <= 0 && (state.momentumDays < 45 || context.simulatedYear >= 2027)) {
      return { type: 'reset' }
    }

    // If the next model step is temporarily unaffordable, build distribution
    // and revenue rather than waiting passively. Keep a 70 PF reserve for the
    // next capability action whenever possible.
    for (const nodeId of ['product-sso', 'product-mobile', 'product-connectors', 'product-analysis']) {
      const product = actionForNode(state, nodeId)
      if (product && state.compute >= 160) return product
    }

    const region = unintroducedRegions.find((id) => {
      const target = state.regions.find((candidate) => candidate.id === id)
      return target && !target.introduced
    })
    if (region && state.compute >= 115) return { type: 'introduce', region }

    // A reckless CEO accepts the reputational cost of emergency compute rather
    // than letting the race stall after overspending.
    if (state.compute < 45 && !state.flags.includes('lifeline:used')) return { type: 'compute-lifeline' }

    // When no purchase is possible, only reset if it meaningfully restores
    // momentum; otherwise wait for the real production economy to accrue PF.
    const economy = computeEconomy(state as GameState)
    if (economy.net <= 0 && state.resetCooldownSeconds <= 0) return { type: 'reset' }
    return null
  },
}

export default policy
