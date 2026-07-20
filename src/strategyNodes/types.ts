import type { RegionId } from '../engine'

export const STRATEGY_CATEGORIES = ['model', 'product', 'company', 'ecosystem'] as const
export type StrategyCategory = (typeof STRATEGY_CATEGORIES)[number]
export type StrategyNodeId = `${StrategyCategory}-${string}`

export const STRATEGY_TIERS = [1, 2, 3, 4] as const
export type StrategyTier = (typeof STRATEGY_TIERS)[number]

export const STRATEGY_EFFECT_METRICS = [
  'capability',
  'safety',
  'governance',
  'efficiency',
  'trust',
  'brand',
  'momentum',
  'incomeMultiplier',
  'opexMultiplier',
  'controlRelief',
  'idleFloor',
  'regionFit',
  'usersPopulationShare',
  'codexShare',
  'rivalShare',
] as const
export type StrategyEffectMetric = (typeof STRATEGY_EFFECT_METRICS)[number]

export const STRATEGY_EFFECT_BOUNDS = Object.freeze({
  capability: Object.freeze({ min: -2, max: 2 }),
  safety: Object.freeze({ min: -2, max: 2 }),
  governance: Object.freeze({ min: -2, max: 2 }),
  efficiency: Object.freeze({ min: -0.5, max: 0.5 }),
  trust: Object.freeze({ min: -6, max: 6 }),
  brand: Object.freeze({ min: -6, max: 6 }),
  momentum: Object.freeze({ min: 0, max: 90 }),
  incomeMultiplier: Object.freeze({ min: 0.85, max: 1.10 }),
  opexMultiplier: Object.freeze({ min: 0.85, max: 1.10 }),
  controlRelief: Object.freeze({ min: -0.5, max: 0.5 }),
  idleFloor: Object.freeze({ min: 0, max: 0.001 }),
  regionFit: Object.freeze({ min: 0.92, max: 1.08 }),
  usersPopulationShare: Object.freeze({ min: -0.001, max: 0.001 }),
  codexShare: Object.freeze({ min: -0.03, max: 0.03 }),
  rivalShare: Object.freeze({ min: -0.03, max: 0.03 }),
}) satisfies Readonly<Record<StrategyEffectMetric, Readonly<{ min: number; max: number }>>>

export type Locale = 'en' | 'ja'
export type LocalizedText = Readonly<Record<Locale, string>>

export const LEGACY_STRATEGY_ACTIONS = [
  'model',
  'feature-mobile',
  'feature-enterprise',
  'feature-education',
  'feature-research',
  'feature-connectors',
  'feature-analysis',
  'safety',
  'governance',
  'datacenter',
  'ecosystem',
] as const
export type LegacyStrategyAction = (typeof LEGACY_STRATEGY_ACTIONS)[number]

export type StrategyPrerequisite =
  | Readonly<{ kind: 'always' }>
  | Readonly<{ kind: 'node'; id: StrategyNodeId }>
  | Readonly<{ kind: 'all' | 'any'; terms: readonly StrategyPrerequisite[] }>

export type StrategyEffectScope = RegionId | 'global' | 'strongest-rival' | 'all-rivals'

type StrategyEffectBase = Readonly<{
  text: LocalizedText
  value: number
  scope?: StrategyEffectScope
}>

export type StrategyEffectDescriptor =
  | (StrategyEffectBase & Readonly<{
    metric: Exclude<StrategyEffectMetric, 'incomeMultiplier' | 'opexMultiplier' | 'regionFit' | 'idleFloor'>
    operation: 'add'
  }>)
  | (StrategyEffectBase & Readonly<{
    metric: 'incomeMultiplier' | 'opexMultiplier' | 'regionFit'
    operation: 'multiply'
  }>)
  | (StrategyEffectBase & Readonly<{
    metric: 'idleFloor'
    operation: 'max'
  }>)

type StrategyNodeCore = Readonly<{
  id: StrategyNodeId
  category: StrategyCategory
  tier: StrategyTier
  x: number
  y: number
  iconKey: string
  title: LocalizedText
  summary: LocalizedText
  action: LocalizedText
  prerequisite: StrategyPrerequisite
  exclusions: readonly StrategyNodeId[]
  effects: readonly StrategyEffectDescriptor[]
  comboEventIds: readonly string[]
  enabled: boolean
}>

export type StrategyNode = StrategyNodeCore & (
  | Readonly<{
    baseCost: number
    legacyAction?: never
  }>
  | Readonly<{
    baseCost?: never
    legacyAction: Readonly<{
      id: LegacyStrategyAction
      repeatable: boolean
    }>
  }>
)

export type StrategyCatalogValidationIssue = Readonly<{
  path: string
  message: string
}>
