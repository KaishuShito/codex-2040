import {
  computeEconomy,
  getStrategyNodeAvailability,
  metrics,
  type GameAction,
  type GameState,
  type RegionId,
} from '../../src/engine'
import type { PlayPolicy } from '../harness'

const availability = (state: Readonly<GameState>, nodeId: string) =>
  getStrategyNodeAvailability(state as GameState, nodeId)

/**
 * A purchase is "frugal" only when the production economy can still absorb a
 * long dry spell afterwards. The reserve is intentionally larger while net PF
 * is negative, and falls only after the player has built a self-funding base.
 */
const reserveFor = (state: Readonly<GameState>) => {
  const economy = computeEconomy(state as GameState)
  return Math.max(280, 320 + Math.max(0, -economy.net) * 120)
}

const buyAboveReserve = (
  state: Readonly<GameState>,
  nodeId: string,
  reserve = reserveFor(state),
): GameAction | null => {
  const node = availability(state, nodeId)
  return node?.status === 'ready' && state.compute - node.cost >= reserve
    ? { type: 'strategy-node', nodeId }
    : null
}

const regionAboveReserve = (
  state: Readonly<GameState>,
  id: RegionId,
  reserve = reserveFor(state),
): GameAction | null => {
  const region = state.regions.find((candidate) => candidate.id === id)
  return region && !region.introduced && state.compute - 45 >= reserve
    ? { type: 'introduce', region: id }
    : null
}

/**
 * Compute-first survivor: keep a large PF runway, use free token resets and
 * their collectible PF immediately, buy inexpensive distribution/efficiency,
 * and never let capability get ahead of safety or governance. It deliberately
 * chooses the 2029 slowdown and holds the line in 2035.
 */
const policy: PlayPolicy = {
  id: 'agent-07-frugal-compute-survivor',
  description: '計算予算を厚く維持する倹約型。無料resetとPFバブル、費用対効果の高い地域・効率化を優先し、K/S/G均衡を守る。2029年は一時減速、2035年は一線を守る。',
  choice2029: 'slowdown',
  choice2035: 'hold-the-line',
  decide: (state, context) => {
    // Collect before spending: bubbles are real-time collectibles and expire.
    const bubble = state.rewardBubbles.find((candidate) => candidate.remainingSeconds > 0)
    if (bubble) return { type: 'collect-bubble', bubbleId: bubble.id }

    // Use the one-time emergency agreement before a zero-PF day. It is a last
    // resort because its trust/share price conflicts with this policy's goals.
    if (state.compute < 45 && !state.flags.includes('lifeline:used')) {
      return { type: 'compute-lifeline' }
    }

    const economy = computeEconomy(state as GameState)
    const currentMetrics = metrics(state as GameState)

    // Free momentum is always preferable to spending PF. During a loss-making
    // phase reset as soon as it is ready; otherwise wait until momentum is low.
    if (state.resetCooldownSeconds <= 0 && (economy.net <= 0 || state.momentumDays <= 30)) {
      return { type: 'reset' }
    }

    const reserve = reserveFor(state)

    // Close any control gap before considering another capability purchase.
    if (state.safety < state.capability) {
      const safety = buyAboveReserve(state, 'company-safety', reserve)
      if (safety) return safety
    }
    if (state.governance < state.capability) {
      const governance = buyAboveReserve(state, 'company-policy', reserve)
      if (governance) return governance
    }

    // Cheap, durable PF economics before expansion: enterprise revenue,
    // mobile reach, governance unlock, then one efficient data-center step.
    for (const nodeId of ['product-sso', 'product-mobile']) {
      const action = buyAboveReserve(state, nodeId, reserve)
      if (action) return action
    }
    if (state.governance < 3) {
      const policyTeam = buyAboveReserve(state, 'company-policy', reserve)
      if (policyTeam) return policyTeam
    }
    if (state.efficiency < 1.25) {
      const datacenter = buyAboveReserve(state, 'company-datacenter', reserve)
      if (datacenter) return datacenter
    }

    // Africa has the largest unserved population per 45 PF, followed by MENA.
    // Oceania is still opened eventually for coverage, but only with runway.
    for (const regionId of ['africa', 'mena', 'oceania'] as const) {
      const action = regionAboveReserve(state, regionId, reserve)
      if (action) return action
    }

    // Build a conservative K3 platform only after the initial economy is
    // established. K3 remains within one point of both control axes.
    if (context.simulatedYear >= 2028 && state.capability < 3
      && state.safety >= state.capability && state.governance >= state.capability) {
      const foundation = buyAboveReserve(state, 'model-foundation', reserve)
      if (foundation) return foundation
    }

    // Restore exact parity after K3, then favor one-off efficiency and access
    // purchases whose benefits persist without a capability burden.
    if (state.safety < state.capability) {
      const safety = buyAboveReserve(state, 'company-safety', reserve)
      if (safety) return safety
    }
    if (state.governance < state.capability) {
      const governance = buyAboveReserve(state, 'company-policy', reserve)
      if (governance) return governance
    }
    for (const nodeId of [
      'model-distillation',
      'product-education',
      'company-transparency',
      'company-grid-partnership',
      'model-efficient-inference',
      'product-offline-lite',
    ]) {
      const action = buyAboveReserve(state, nodeId, reserve)
      if (action) return action
    }

    // A second data-center purchase is permitted only after the economy is
    // profitable and a two-year runway remains after payment.
    if (economy.net > 0 && state.compute >= reserve + 500 && state.efficiency < 1.5) {
      const datacenter = buyAboveReserve(state, 'company-datacenter', reserve + 180)
      if (datacenter) return datacenter
    }

    // If a later shock makes the budget structurally negative, a ready reset
    // is the only discretionary action; otherwise patiently accrue PF.
    if (economy.net < -1 && state.resetCooldownSeconds <= 0) return { type: 'reset' }
    if (currentMetrics.safetyGap > 0 || currentMetrics.governanceGap > 0) return null
    return null
  },
}

export default policy
