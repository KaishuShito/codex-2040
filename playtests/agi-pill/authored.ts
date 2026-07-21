import {
  agiPillMetrics,
  applyAgiPillEffects,
  enforceAgiPillInvariants,
  type AgiPillEffect,
  type AgiPillState,
} from '../../src/agiPill/engine'
import {
  AGI_PILL_EVENT_EARLIEST_DAYS,
  AGI_PILL_EVENTS,
  isAgiPillEventEligible,
  toAgiPillEffectDescriptors,
  type AgiPillEventDefinition,
  type AgiPillEventOption,
  type AgiPillMetric,
} from '../../src/agiPill/events'
import {
  AGI_PILL_UPGRADES,
  isAgiPillPrerequisiteSatisfied,
  type AgiPillAxis,
  type AgiPillResource,
  type AgiPillUpgrade,
  type AgiPillUpgradeId,
} from '../../src/agiPill/upgrades'
import type { PillPolicyId } from './types'

const modeEventFlag = (id: string) => `pill:event:${id}`
const upgradeFlag = (id: string) => `pill:upgrade:${id}`
const scaledCost = (value: number) => value * .02

const phaseTier = (state: AgiPillState) => state.expansion.dysonBuilt
  ? 6
  : state.phase === 'year-5-10' ? 4 : state.phase === 'year-3-5' ? 3 : 2

const canAfford = (state: AgiPillState, upgrade: AgiPillUpgrade) => Object.entries(upgrade.cost).every(([resource, amount]) => {
  const cost = scaledCost(amount ?? 0)
  if (resource === 'materials') return state.resources >= cost
  if (resource === 'legitimacy') return state.governance >= cost
  return state[resource as 'compute' | 'energy'] >= cost
})

const costEffects = (cost: Readonly<Partial<Record<AgiPillResource, number>>>): AgiPillEffect[] => Object.entries(cost).map(([resource, amount]) => ({
  metric: resource === 'materials' ? 'resources' : resource === 'legitimacy' ? 'governance' : resource as 'compute' | 'energy',
  operation: 'add',
  value: -scaledCost(amount ?? 0),
}))

export const dueAuthoredEvent = (state: AgiPillState): AgiPillEventDefinition | null => {
  if (state.phase === 'post-dyson') return null
  const metrics = agiPillMetrics(state)
  const eligibility = {
    day: state.day,
    phase: state.phase,
    flags: state.flags,
    intelligence: state.intelligence,
    compute: state.compute,
    energy: state.energy,
    robots: state.robots,
    resources: state.resources,
    safety: state.safety,
    governance: state.governance,
    friction: state.friction,
    risk: state.risk,
    rivalPressure: metrics.rivalPressure,
    orbitalIndustry: state.expansion.orbitalIndustry,
    dysonProgress: state.expansion.dysonProgress,
    postDysonExpansion: state.expansion.postDysonExpansion,
  }
  return AGI_PILL_EVENTS.find((event, index) =>
    !state.flags.includes(modeEventFlag(event.id))
    && isAgiPillEventEligible(event, eligibility, { earliestDay: AGI_PILL_EVENT_EARLIEST_DAYS[index] ?? Number.POSITIVE_INFINITY })) ?? null
}

type Weights = Partial<Record<AgiPillMetric, number>>

const EFFECT_WEIGHTS: Readonly<Record<PillPolicyId, Weights>> = Object.freeze({
  balanced: { intelligence: 1, compute: .8, energy: .8, robots: .8, resources: .8, safety: 1.4, governance: 1.3, risk: -1.6, friction: -1.1, rivalPressure: -.7, orbitalIndustry: 1, dysonProgress: 1, postDysonExpansion: 1 },
  passive: { safety: 1, governance: 1, risk: -1.2, friction: -.8, rivalPressure: -.5 },
  overaccelerate: { intelligence: 2.2, compute: 1.7, energy: 1.1, robots: 1.2, resources: .7, safety: -.3, governance: -.3, risk: .35, friction: .15, rivalPressure: .2, orbitalIndustry: 1.4, dysonProgress: 1.8, postDysonExpansion: 2 },
  'safety-first': { intelligence: .4, compute: .3, energy: .4, robots: .3, resources: .7, safety: 2.4, governance: 1.1, risk: -2.7, friction: -1.2, rivalPressure: -.7, orbitalIndustry: .5, dysonProgress: .5, postDysonExpansion: .6 },
  'industry-first': { intelligence: .5, compute: 1, energy: 2, robots: 2.2, resources: 1.8, safety: .45, governance: .25, risk: -.45, friction: -.35, rivalPressure: -.1, orbitalIndustry: 1.8, dysonProgress: 1.5, postDysonExpansion: 1.5 },
  'governance-first': { intelligence: .35, compute: .3, energy: .35, robots: .25, resources: .6, safety: 1.2, governance: 2.5, risk: -1.8, friction: -1.8, rivalPressure: -1.5, orbitalIndustry: .5, dysonProgress: .45, postDysonExpansion: .7 },
  'compute-first': { intelligence: 1.5, compute: 2.3, energy: 1.2, robots: .7, resources: .6, safety: .35, governance: .2, risk: -.35, friction: -.25, rivalPressure: -.1, orbitalIndustry: 1, dysonProgress: 1, postDysonExpansion: 1.2 },
})

const scoreEffects = (effects: Readonly<Partial<Record<AgiPillMetric, number>>>, weights: Weights) =>
  Object.entries(effects).reduce((score, [metric, value]) => score + (value ?? 0) * (weights[metric as AgiPillMetric] ?? 0), 0)

export const chooseAuthoredEventOption = (
  policyId: PillPolicyId,
  event: AgiPillEventDefinition,
): { option: AgiPillEventOption; index: number } => {
  // Passive players must still dismiss the blocking modal. Option zero is the
  // authored bounded/default route rather than an invented automatic choice.
  if (policyId === 'passive') return { option: event.options[0]!, index: 0 }
  const weights = EFFECT_WEIGHTS[policyId]
  const best = event.options.reduce((current, option, index) => {
    const optionScore = scoreEffects(option.effects, weights)
    return optionScore > current.score ? { option, index, score: optionScore } : current
  }, { option: event.options[0]!, index: 0, score: scoreEffects(event.options[0]!.effects, weights) })
  return { option: best.option, index: best.index }
}

export const applyAuthoredEventOption = (
  state: AgiPillState,
  event: AgiPillEventDefinition,
  option: AgiPillEventOption,
): AgiPillState => {
  const effected = applyAgiPillEffects(state, toAgiPillEffectDescriptors(option.effects), event.id)
  return enforceAgiPillInvariants({
    ...effected,
    flags: [...effected.flags.filter((flag) => !(option.clearsFlags ?? []).includes(flag)), ...option.setsFlags, modeEventFlag(event.id)],
  })
}

const AXIS_WEIGHTS: Readonly<Record<PillPolicyId, Partial<Record<AgiPillAxis, number>>>> = Object.freeze({
  balanced: { intelligence: 1, compute: 1, energy: 1, robotics: 1, resources: 1, safety: 1.2, governance: 1.1, social: 1, civilization: 1 },
  passive: {},
  overaccelerate: { intelligence: 2.2, compute: 2, energy: 1.2, robotics: 1.3, resources: .8, safety: .1, governance: .1, social: .1, civilization: 1.4 },
  'safety-first': { intelligence: .4, compute: .5, energy: .5, robotics: .4, resources: .7, safety: 2.5, governance: 1.2, social: 1, civilization: .8 },
  'industry-first': { intelligence: .6, compute: 1.2, energy: 2.2, robotics: 2.4, resources: 2, safety: .5, governance: .4, social: .5, civilization: 1.2 },
  'governance-first': { intelligence: .4, compute: .4, energy: .5, robotics: .4, resources: .6, safety: 1.2, governance: 2.5, social: 2, civilization: 1.4 },
  'compute-first': { intelligence: 1.5, compute: 2.6, energy: 1.3, robotics: .8, resources: .7, safety: .5, governance: .3, social: .3, civilization: 1 },
})

export const availableAuthoredUpgrades = (state: AgiPillState): readonly AgiPillUpgrade[] => {
  const acquired = new Set(state.flags.filter((flag) => flag.startsWith('pill:upgrade:')).map((flag) => flag.slice('pill:upgrade:'.length) as AgiPillUpgradeId))
  return AGI_PILL_UPGRADES.filter((upgrade) =>
    upgrade.tier <= phaseTier(state)
    && !acquired.has(upgrade.id)
    && isAgiPillPrerequisiteSatisfied(upgrade.prerequisite, acquired)).slice(0, 12)
}

export const affordableAuthoredUpgrades = (state: AgiPillState): readonly AgiPillUpgrade[] =>
  availableAuthoredUpgrades(state).filter((upgrade) => canAfford(state, upgrade))

export const chooseAffordableUpgrade = (policyId: PillPolicyId, state: AgiPillState): AgiPillUpgrade | null => {
  if (policyId === 'passive') return null
  const candidates = affordableAuthoredUpgrades(state)
  const axisWeights = AXIS_WEIGHTS[policyId]
  const effectWeights = EFFECT_WEIGHTS[policyId]
  return candidates.reduce<{ upgrade: AgiPillUpgrade; score: number } | null>((best, upgrade) => {
    const normalizedEffects = Object.fromEntries(upgrade.effects.map((effect) => [effect.metric, effect.operation === 'multiply' ? (effect.value - 1) * 10 : effect.value]))
    const score = (axisWeights[upgrade.axis] ?? 0) * 4 + scoreEffects(normalizedEffects, effectWeights) + upgrade.tier * .15
    return !best || score > best.score ? { upgrade, score } : best
  }, null)?.upgrade ?? null
}

export const fundAuthoredUpgrade = (state: AgiPillState, upgrade: AgiPillUpgrade): AgiPillState => {
  if (!canAfford(state, upgrade)) return state
  const effects: AgiPillEffect[] = [
    ...costEffects(upgrade.cost),
    ...upgrade.effects.map((effect) => ({ metric: effect.metric, operation: effect.operation, value: effect.value })),
  ]
  const next = applyAgiPillEffects(state, effects, `upgrade:${upgrade.id}`)
  return enforceAgiPillInvariants({ ...next, flags: [...next.flags, upgradeFlag(upgrade.id)] })
}
