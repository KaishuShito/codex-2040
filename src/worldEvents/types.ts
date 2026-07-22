import type { RegionId, ScenarioSource } from '../engine'

export const WORLD_EVENT_CATEGORIES = [
  'disaster',
  'culture',
  'policy',
  'competition',
  'technology',
] as const

export type WorldEventCategory = (typeof WORLD_EVENT_CATEGORIES)[number]

export const WORLD_EVENT_PRESENTATIONS = ['ticker', 'popup'] as const
export type WorldEventPresentation = (typeof WORLD_EVENT_PRESENTATIONS)[number]

export const WORLD_EVENT_TARGETS = ['codex', 'rivalAnthro', 'rivalGoo', 'rivalQi'] as const
export type WorldEventTarget = (typeof WORLD_EVENT_TARGETS)[number]

export const WORLD_EVENT_REGION_IDS = [
  'na',
  'latam',
  'eu',
  'africa',
  'mena',
  'india',
  'eastAsia',
  'oceania',
] as const satisfies readonly RegionId[]

export const WORLD_EVENT_SOURCES = ['AI 2027', 'AI 2040', 'Your Timeline', 'Live GM'] as const satisfies readonly ScenarioSource[]

export const WORLD_EVENT_BOUNDS = Object.freeze({
  usersDeltaPct: Object.freeze({ min: -30, max: 60 }),
  shareDelta: Object.freeze({ min: -0.15, max: 0.20 }),
  growthRateDelta: Object.freeze({ min: -0.2, max: 0.4 }),
  trustDelta: Object.freeze({ min: -8, max: 8 }),
  ttlDays: Object.freeze({ min: 1, max: 30 }),
  comboMomentumDays: Object.freeze({ min: 1, max: 30 }),
})

export type WorldEventEffect = {
  usersDeltaPct: number
  shareDelta: number
  growthRateDelta: number
  trustDelta: number
  target?: WorldEventTarget
}

export type WorldEventRequirements = {
  flagsAny?: readonly string[]
  flagsAll?: readonly string[]
  featureTermsAny?: readonly string[]
  minTrust?: number
  maxTrust?: number
  minCapability?: number
  maxCapability?: number
  minWorldAdoption?: number
  maxWorldAdoption?: number
  minCodexShare?: number
  maxCodexShare?: number
}

export type WorldEventCombo = {
  id: string
  label: string
  labelEn: string
  requires: WorldEventRequirements
  effect: WorldEventEffect
  ttlDays?: number
  momentumDays?: number
  headline?: string
  headlineEn?: string
}

export type WorldEventDefinition = {
  id: string
  category: WorldEventCategory
  startYear: number
  endYear: number
  regions: readonly RegionId[] | 'global'
  weight: number
  presentation: WorldEventPresentation
  source: ScenarioSource
  headline: string
  headlineEn: string
  cause: string
  causeEn: string
  flavor: string
  flavorEn: string
  effect: WorldEventEffect
  ttlDays: number
  requires?: WorldEventRequirements
  combos?: readonly WorldEventCombo[]
}

export type WorldEventValidationIssue = {
  path: string
  message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && values.includes(value as T)

const validateBoundedNumber = (
  value: unknown,
  path: string,
  bounds: Readonly<{ min: number; max: number }>,
  issues: WorldEventValidationIssue[],
  integer = false,
) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push({ path, message: 'must be a finite number' })
    return
  }
  if (integer && !Number.isInteger(value)) issues.push({ path, message: 'must be an integer' })
  if (value < bounds.min || value > bounds.max) {
    issues.push({ path, message: `must be between ${bounds.min} and ${bounds.max}` })
  }
}

const validateStringList = (
  value: unknown,
  path: string,
  issues: WorldEventValidationIssue[],
) => {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isNonEmptyString(item))) {
    issues.push({ path, message: 'must be a non-empty array of non-empty strings' })
  }
}

const validateRequirements = (
  value: unknown,
  path: string,
  issues: WorldEventValidationIssue[],
) => {
  if (!isRecord(value)) {
    issues.push({ path, message: 'must be an object' })
    return
  }

  for (const key of ['flagsAny', 'flagsAll', 'featureTermsAny'] as const) {
    if (value[key] !== undefined) validateStringList(value[key], `${path}.${key}`, issues)
  }

  const numericKeys = [
    'minTrust',
    'maxTrust',
    'minCapability',
    'maxCapability',
    'minWorldAdoption',
    'maxWorldAdoption',
    'minCodexShare',
    'maxCodexShare',
  ] as const
  for (const key of numericKeys) {
    if (value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
      issues.push({ path: `${path}.${key}`, message: 'must be a finite number' })
    }
  }

  for (const [minimum, maximum] of [
    ['minTrust', 'maxTrust'],
    ['minCapability', 'maxCapability'],
    ['minWorldAdoption', 'maxWorldAdoption'],
    ['minCodexShare', 'maxCodexShare'],
  ] as const) {
    if (typeof value[minimum] === 'number'
      && typeof value[maximum] === 'number'
      && value[minimum] > value[maximum]) {
      issues.push({ path, message: `${minimum} must not exceed ${maximum}` })
    }
  }

  for (const key of ['minTrust', 'maxTrust'] as const) {
    if (typeof value[key] === 'number' && (value[key] < 0 || value[key] > 100)) {
      issues.push({ path: `${path}.${key}`, message: 'must be between 0 and 100' })
    }
  }
  for (const key of ['minWorldAdoption', 'maxWorldAdoption', 'minCodexShare', 'maxCodexShare'] as const) {
    if (typeof value[key] === 'number' && (value[key] < 0 || value[key] > 1)) {
      issues.push({ path: `${path}.${key}`, message: 'must be between 0 and 1' })
    }
  }
}

const validateEffect = (
  value: unknown,
  path: string,
  issues: WorldEventValidationIssue[],
) => {
  if (!isRecord(value)) {
    issues.push({ path, message: 'must be an object' })
    return
  }
  validateBoundedNumber(value.usersDeltaPct, `${path}.usersDeltaPct`, WORLD_EVENT_BOUNDS.usersDeltaPct, issues)
  validateBoundedNumber(value.shareDelta, `${path}.shareDelta`, WORLD_EVENT_BOUNDS.shareDelta, issues)
  validateBoundedNumber(value.growthRateDelta, `${path}.growthRateDelta`, WORLD_EVENT_BOUNDS.growthRateDelta, issues)
  validateBoundedNumber(value.trustDelta, `${path}.trustDelta`, WORLD_EVENT_BOUNDS.trustDelta, issues)
  if (value.target !== undefined && !isOneOf(value.target, WORLD_EVENT_TARGETS)) {
    issues.push({ path: `${path}.target`, message: 'must be a known target' })
  }
}

export const validateWorldEventDefinition = (value: unknown): WorldEventValidationIssue[] => {
  const issues: WorldEventValidationIssue[] = []
  if (!isRecord(value)) return [{ path: '$', message: 'must be an object' }]

  if (!isNonEmptyString(value.id)) issues.push({ path: 'id', message: 'must be a non-empty string' })
  if (!isOneOf(value.category, WORLD_EVENT_CATEGORIES)) issues.push({ path: 'category', message: 'must be a known category' })
  if (!Number.isInteger(value.startYear)) issues.push({ path: 'startYear', message: 'must be an integer' })
  if (!Number.isInteger(value.endYear)) issues.push({ path: 'endYear', message: 'must be an integer' })
  if (typeof value.startYear === 'number'
    && typeof value.endYear === 'number'
    && value.startYear > value.endYear) {
    issues.push({ path: 'startYear', message: 'must not exceed endYear' })
  }

  if (value.regions !== 'global') {
    if (!Array.isArray(value.regions) || value.regions.length === 0) {
      issues.push({ path: 'regions', message: "must be 'global' or a non-empty region array" })
    } else {
      value.regions.forEach((region, index) => {
        if (!isOneOf(region, WORLD_EVENT_REGION_IDS)) {
          issues.push({ path: `regions[${index}]`, message: 'must be a known region' })
        }
      })
      if (new Set(value.regions).size !== value.regions.length) {
        issues.push({ path: 'regions', message: 'must not contain duplicate regions' })
      }
    }
  }

  if (typeof value.weight !== 'number' || !Number.isFinite(value.weight) || value.weight <= 0) {
    issues.push({ path: 'weight', message: 'must be a finite number greater than zero' })
  }
  if (!isOneOf(value.presentation, WORLD_EVENT_PRESENTATIONS)) {
    issues.push({ path: 'presentation', message: 'must be ticker or popup' })
  }
  if (!isOneOf(value.source, WORLD_EVENT_SOURCES)) issues.push({ path: 'source', message: 'must be a canonical source' })
  for (const key of ['headline', 'headlineEn', 'cause', 'causeEn', 'flavor', 'flavorEn'] as const) {
    if (!isNonEmptyString(value[key])) issues.push({ path: key, message: 'must be a non-empty string' })
  }

  validateEffect(value.effect, 'effect', issues)
  validateBoundedNumber(value.ttlDays, 'ttlDays', WORLD_EVENT_BOUNDS.ttlDays, issues, true)
  if (value.requires !== undefined) validateRequirements(value.requires, 'requires', issues)

  if (value.combos !== undefined) {
    if (!Array.isArray(value.combos)) {
      issues.push({ path: 'combos', message: 'must be an array' })
    } else {
      const comboIds = new Set<string>()
      value.combos.forEach((combo, index) => {
        const path = `combos[${index}]`
        if (!isRecord(combo)) {
          issues.push({ path, message: 'must be an object' })
          return
        }
        if (!isNonEmptyString(combo.id)) issues.push({ path: `${path}.id`, message: 'must be a non-empty string' })
        else if (comboIds.has(combo.id)) issues.push({ path: `${path}.id`, message: 'must be unique within the event' })
        else comboIds.add(combo.id)
        if (!isNonEmptyString(combo.label)) issues.push({ path: `${path}.label`, message: 'must be a non-empty string' })
        if (!isNonEmptyString(combo.labelEn)) issues.push({ path: `${path}.labelEn`, message: 'must be a non-empty string' })
        validateRequirements(combo.requires, `${path}.requires`, issues)
        validateEffect(combo.effect, `${path}.effect`, issues)
        if (combo.ttlDays !== undefined) {
          validateBoundedNumber(combo.ttlDays, `${path}.ttlDays`, WORLD_EVENT_BOUNDS.ttlDays, issues, true)
        }
        if (combo.momentumDays !== undefined) {
          validateBoundedNumber(
            combo.momentumDays,
            `${path}.momentumDays`,
            WORLD_EVENT_BOUNDS.comboMomentumDays,
            issues,
            true,
          )
        }
        if (combo.headline !== undefined && !isNonEmptyString(combo.headline)) {
          issues.push({ path: `${path}.headline`, message: 'must be a non-empty string' })
        }
        if (combo.headline !== undefined && !isNonEmptyString(combo.headlineEn)) {
          issues.push({ path: `${path}.headlineEn`, message: 'must accompany headline as a non-empty string' })
        }
      })
    }
  }

  return issues
}

export const isWorldEventDefinition = (value: unknown): value is WorldEventDefinition =>
  validateWorldEventDefinition(value).length === 0

export const validateWorldEventDefinitions = (values: readonly unknown[]): WorldEventValidationIssue[] => {
  const issues = values.flatMap((value, index) =>
    validateWorldEventDefinition(value).map((issue) => ({
      ...issue,
      path: `[${index}].${issue.path}`,
    })))
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (!isRecord(value) || !isNonEmptyString(value.id)) return
    if (seen.has(value.id)) issues.push({ path: `[${index}].id`, message: 'must be globally unique' })
    seen.add(value.id)
  })
  return issues
}
