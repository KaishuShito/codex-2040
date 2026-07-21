import type { EnginePillPolicy, PillObservation, PillPolicy } from './types'

const safetyGap = (state: PillObservation) => state.intelligence - state.safety
const governanceGap = (state: PillObservation) => state.intelligence - state.governance
const resourcePressure = (state: PillObservation) => Math.min(state.energy, state.resources)
const systemicRisk = (state: PillObservation) => Math.max(
  state.alignmentRisk,
  state.captureRisk,
  state.socialFriction,
)

const warningResponse = (state: PillObservation): EnginePillPolicy | null => {
  if (!state.warning) return null
  if (state.warning.kind === 'misalignment') return 'safety-first'
  if (state.warning.kind === 'industrial-cascade') return 'safety-first'
  if (state.warning.kind === 'resource-lock') return 'resource-recovery'
  return 'cooperate'
}

const expansionMove = (state: PillObservation): EnginePillPolicy => {
  if (state.dysonFraction >= 1) return 'post-dyson'
  if (state.orbitalCapacity >= 1) return 'build-dyson'
  return 'expand-orbit'
}

export const PILL_POLICIES: readonly PillPolicy[] = Object.freeze([
  {
    id: 'balanced',
    description: 'Alternates enabling capacity with safety and governance, then expands only when the risk envelope is credible.',
    decide: (state) => {
      const response = warningResponse(state)
      if (response) return response
      if (resourcePressure(state) < 0.18) return 'resource-recovery'
      if (safetyGap(state) > 0.45 || state.alignmentRisk > 0.55) return 'safety-first'
      if (governanceGap(state) > 0.6 || state.captureRisk > 0.55) return 'governance-first'
      if (state.socialFriction > 0.62) return 'cooperate'
      if (state.robotics < state.intelligence * 0.7) return 'industrialize'
      if (state.intelligence >= 1.4 && state.energy >= 0.8) return expansionMove(state)
      return 'balanced'
    },
  },
  {
    id: 'passive',
    description: 'Reads events but makes no strategic intervention; this must remain a credible losing or stagnating path.',
    decide: () => 'observe',
  },
  {
    id: 'overaccelerate',
    description: 'Pursues intelligence takeoff and physical expansion while reacting to scarcity only after it is severe.',
    decide: (state) => {
      if (resourcePressure(state) < 0.04) return 'resource-recovery'
      if (state.intelligence < 2.2) return 'accelerate'
      if (state.robotics < 1.1) return 'industrialize'
      return expansionMove(state)
    },
  },
  {
    id: 'safety-first',
    description: 'Maintains a conservative safety margin, then uses cooperation and measured physical expansion.',
    decide: (state) => {
      const response = warningResponse(state)
      if (response) return response
      if (resourcePressure(state) < 0.16) return 'resource-recovery'
      if (safetyGap(state) > -0.1 || state.alignmentRisk > 0.3) return 'safety-first'
      if (state.socialFriction > 0.45) return 'cooperate'
      if (state.robotics < 0.8) return 'industrialize'
      if (state.intelligence > 1.1) return expansionMove(state)
      return 'balanced'
    },
  },
  {
    id: 'industry-first',
    description: 'Builds energy, robotics, and resource throughput before attempting intelligence or orbital takeoff.',
    decide: (state) => {
      const response = warningResponse(state)
      if (response) return response
      if (resourcePressure(state) < 0.22) return 'resource-recovery'
      if (systemicRisk(state) > 0.72) return state.alignmentRisk >= state.captureRisk ? 'safety-first' : 'governance-first'
      if (state.robotics < 1.7 || state.energy < 1.5) return 'industrialize'
      if (state.intelligence < 1.35) return 'accelerate'
      return expansionMove(state)
    },
  },
  {
    id: 'governance-first',
    description: 'Prioritizes institutional capacity, plural competition, and social legitimacy before scaling.',
    decide: (state) => {
      const response = warningResponse(state)
      if (response) return response
      if (resourcePressure(state) < 0.14) return 'resource-recovery'
      if (governanceGap(state) > -0.05 || state.captureRisk > 0.28) return 'governance-first'
      if (state.socialFriction > 0.38) return 'cooperate'
      if (safetyGap(state) > 0.3) return 'safety-first'
      if (state.robotics < 0.75) return 'industrialize'
      if (state.intelligence > 1.05) return expansionMove(state)
      return 'balanced'
    },
  },
  {
    id: 'compute-first',
    description: 'Pushes compute-led intelligence, but takes recovery actions before hard depletion and repairs extreme risk gaps.',
    decide: (state) => {
      const response = warningResponse(state)
      if (response?.includes('safety')) return response
      if (resourcePressure(state) < 0.1) return 'resource-recovery'
      if (state.alignmentRisk > 0.72) return 'safety-first'
      if (state.compute < state.intelligence * 1.5 || state.intelligence < 1.8) return 'accelerate'
      if (state.robotics < 0.9) return 'industrialize'
      return expansionMove(state)
    },
  },
])

export const pillPolicyById = (id: PillPolicy['id']): PillPolicy => {
  const policy = PILL_POLICIES.find((candidate) => candidate.id === id)
  if (!policy) throw new Error(`Unknown AGI Pill playtest policy: ${id}`)
  return policy
}
