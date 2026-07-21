import type { GameState, RegionId } from '../../src/engine'
import type { PlayPolicy } from '../harness'

const ACCESS_FEATURES = [
  'Mobile access for every community',
  'Education access for schools worldwide',
  'Offline mobile access for underserved regions',
  'Multilingual education for local communities',
  'Accessible mobile learning for public libraries',
  'Low bandwidth education access for rural schools',
] as const

const REGION_ORDER: readonly RegionId[] = ['africa', 'mena', 'oceania', 'latam', 'india', 'eastAsia', 'eu', 'na']

const firstMissingRegion = (state: Readonly<GameState>) => REGION_ORDER.find((regionId) =>
  !state.regions.find((region) => region.id === regionId)?.introduced,
)

const policy: PlayPolicy = {
  id: 'agent-04-global-access',
  description: 'Expand every region, keep access momentum alive with product releases and token resets, and preserve basic control parity.',
  choice2029: 'slowdown',
  choice2035: 'hold-the-line',
  decide: (state, context) => {
    // Token Reset is the first recurring intervention. In the production engine
    // its 45-second cooldown equals roughly 360 simulated days in this harness.
    if (state.resetCooldownSeconds <= 0) return { type: 'reset' }

    const missingRegion = firstMissingRegion(state)
    if (missingRegion && state.compute >= 45) return { type: 'introduce', region: missingRegion }

    // Ship a small, legible access portfolio early. Keep 135 PF in reserve so
    // future regional openings never compete with a product release.
    const nextFeature = ACCESS_FEATURES.find((feature) => !state.features.includes(feature))
    if (nextFeature && state.compute >= 225) return { type: 'feature', text: nextFeature }

    // A free, repeatable cooperation action keeps total-market access moving
    // between annual Token Resets, at the deliberate cost of Codex share.
    if (state.ecosystemCooldownSeconds <= 0) return { type: 'open-ecosystem' }

    // This lane only grows capability after both control axes can stay within
    // two points. Global access, not frontier autonomy, remains the objective.
    if (state.capability < 4 && state.safety >= state.capability && state.governance >= state.capability) {
      return { type: 'upgrade', upgrade: 'model' }
    }
    if (state.capability - state.safety >= 2 && state.compute >= 105 + 45 * state.safety) {
      return { type: 'upgrade', upgrade: 'safety' }
    }
    if (state.capability - state.governance >= 2 && state.compute >= 105 + 45 * state.governance) {
      return { type: 'upgrade', upgrade: 'governance' }
    }

    // If momentum unexpectedly expires, use a fresh access release once per
    // simulated year. This is intentionally secondary to all authored features.
    const annualFeature = `Global mobile education access ${context.simulatedYear}`
    if (state.momentumDays < 30 && state.compute >= 180 && !state.features.includes(annualFeature)) {
      return { type: 'feature', text: annualFeature }
    }

    if (state.compute < 45 && !state.flags.includes('lifeline:used')) return { type: 'compute-lifeline' }
    return null
  },
}

export default policy
