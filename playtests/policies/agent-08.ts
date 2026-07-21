import {
  humanExtinctionRisk,
  upgradeCost,
  type GameAction,
  type GameState,
  type RegionId,
  type Upgrade,
} from '../../src/engine'
import type { PlayDecisionContext, PlayPolicy } from '../harness'

const REGIONS: readonly RegionId[] = ['na', 'latam', 'eu', 'africa', 'mena', 'india', 'eastAsia', 'oceania']
const FEATURES = [
  'Mobile crisis coordination for local communities',
  'Multilingual education access for rural schools',
  'Enterprise SSO for public-interest institutions',
  'Community translation tools for neighborhood groups',
] as const
/** A stable uint32 mixer. The policy has no hidden mutable random state. */
const mix = (value: number) => {
  let mixed = value >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b)
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b)
  return (mixed ^ (mixed >>> 16)) >>> 0
}

const rollFor = (state: Readonly<GameState>, context: PlayDecisionContext, salt = 0) =>
  mix(context.seed ^ Math.imul(state.day + 1, 0x9e3779b1) ^ Math.imul(context.run + salt, 0x85ebca6b))

const defensiveAction = (state: Readonly<GameState>): GameAction => {
  const preferred: Upgrade = state.safety <= state.governance ? 'safety' : 'governance'
  const fallback: Upgrade = preferred === 'safety' ? 'governance' : 'safety'
  const upgrade = state[preferred] < 10 ? preferred : fallback

  // During an existential emergency this player takes the one-shot financing
  // deal only when it is actually available, rather than wasting the day on an
  // unaffordable control purchase.
  if (state.compute < upgradeCost(state as GameState, upgrade)
    && state.compute < 45
    && !state.flags.includes('lifeline:used')) {
    return { type: 'compute-lifeline' }
  }
  return { type: 'upgrade', upgrade }
}

const exploratoryAction = (
  state: Readonly<GameState>,
  context: PlayDecisionContext,
  roll: number,
): GameAction => {
  switch (roll % 10) {
    case 0:
    case 1:
      return { type: 'upgrade', upgrade: 'model' }
    case 2: {
      const unopened = REGIONS.filter((id) => !state.regions.find((region) => region.id === id)?.introduced)
      // The shipped UI removes the action once every region is open. Mirror
      // that affordance instead of exploiting the engine's internal command.
      if (unopened.length === 0) return { type: 'reset' }
      return { type: 'introduce', region: unopened[(roll >>> 10) % unopened.length] }
    }
    case 3:
      return { type: 'reset' }
    case 4:
      return { type: 'open-ecosystem' }
    case 5:
    case 6: {
      const feature = FEATURES[(roll >>> 12) % FEATURES.length]
      return { type: 'feature', text: `${feature} // ${context.simulatedYear}-${context.run}-${state.day}` }
    }
    case 7:
      return { type: 'compute-lifeline' }
    case 8:
      return { type: 'upgrade', upgrade: (roll >>> 8) % 2 === 0 ? 'safety' : 'governance' }
    default:
      return { type: 'upgrade', upgrade: 'datacenter' }
  }
}

const policy: PlayPolicy = {
  id: 'agent-08-chaotic-reactive-explorer',
  description: 'Seed/day-derived chaotic explorer: samples upgrades, regions, resets, ecosystem opening, features, and the emergency lifeline; above 70% extinction risk it abandons exploration for Safety/Governance. Chooses race in 2029 and hold-the-line in 2035.',
  choice2029: 'race',
  choice2035: 'hold-the-line',
  decide: (state, context) => {
    const roll = rollFor(state, context)

    // Collect most visible PF bubbles, but occasionally miss one to model a
    // reactive human player rather than a perfect automation loop.
    if (state.rewardBubbles.length > 0 && roll % 4 !== 0) {
      const bubble = state.rewardBubbles[(roll >>> 6) % state.rewardBubbles.length]
      return { type: 'collect-bubble', bubbleId: bubble.id }
    }

    if (humanExtinctionRisk(state as GameState) > 0.70) return defensiveAction(state)

    // One discretionary experiment roughly every 23 simulated days. The
    // offset and action are fully reproducible from the public run seed/day.
    const offset = rollFor(state, context, 17) % 23
    if (state.day % 23 !== offset) return null
    return exploratoryAction(state, context, roll)
  },
}

export default policy
