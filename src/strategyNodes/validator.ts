import { WORLD_EVENTS } from '../worldEvents/catalog'
import { WORLD_EVENT_REGION_IDS } from '../worldEvents/types'
import {
  LEGACY_STRATEGY_ACTIONS,
  STRATEGY_CATEGORIES,
  STRATEGY_EFFECT_BOUNDS,
  STRATEGY_EFFECT_METRICS,
  STRATEGY_TIERS,
  type StrategyCatalogValidationIssue,
  type StrategyEffectMetric,
  type StrategyNode,
  type StrategyNodeId,
  type StrategyPrerequisite,
} from './types'

export const EXPECTED_STRATEGY_NODE_COUNTS = Object.freeze({
  model: 12,
  product: 16,
  company: 12,
  ecosystem: 10,
})

const ID_PATTERN = /^(model|product|company|ecosystem)-[a-z0-9]+(?:-[a-z0-9]+)*$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const collectPrerequisiteIds = (expression: StrategyPrerequisite): readonly StrategyNodeId[] => {
  if (expression.kind === 'always') return []
  if (expression.kind === 'node') return [expression.id]
  return expression.terms.flatMap((term) => collectPrerequisiteIds(term))
}

const validateLocalizedText = (
  value: unknown,
  path: string,
  issues: StrategyCatalogValidationIssue[],
) => {
  if (!isRecord(value)) {
    issues.push({ path, message: 'must contain en and ja text' })
    return
  }
  if (!isNonEmptyString(value.en)) issues.push({ path: `${path}.en`, message: 'must be non-empty' })
  if (!isNonEmptyString(value.ja)) issues.push({ path: `${path}.ja`, message: 'must be non-empty' })
}

const validatePrerequisite = (
  value: unknown,
  path: string,
  issues: StrategyCatalogValidationIssue[],
): value is StrategyPrerequisite => {
  if (!isRecord(value)) {
    issues.push({ path, message: 'must be a prerequisite expression' })
    return false
  }
  if (value.kind === 'always') return true
  if (value.kind === 'node') {
    if (!isNonEmptyString(value.id)) issues.push({ path: `${path}.id`, message: 'must be a non-empty node id' })
    return isNonEmptyString(value.id)
  }
  if (value.kind === 'all' || value.kind === 'any') {
    if (!Array.isArray(value.terms) || value.terms.length === 0) {
      issues.push({ path: `${path}.terms`, message: 'must be a non-empty array' })
      return false
    }
    return value.terms.map((term, index) => validatePrerequisite(term, `${path}.terms[${index}]`, issues)).every(Boolean)
  }
  issues.push({ path: `${path}.kind`, message: 'must be always, node, all, or any' })
  return false
}

const validateNodeShape = (
  value: unknown,
  index: number,
  issues: StrategyCatalogValidationIssue[],
): value is StrategyNode => {
  const path = `[${index}]`
  if (!isRecord(value)) {
    issues.push({ path, message: 'must be an object' })
    return false
  }

  if (!isNonEmptyString(value.id) || !ID_PATTERN.test(value.id)) {
    issues.push({ path: `${path}.id`, message: 'must be a category-prefixed kebab-case id' })
  }
  if (!STRATEGY_CATEGORIES.includes(value.category as never)) {
    issues.push({ path: `${path}.category`, message: 'must be a known category' })
  } else if (typeof value.id === 'string' && !value.id.startsWith(`${value.category}-`)) {
    issues.push({ path: `${path}.id`, message: 'prefix must match category' })
  }
  if (!STRATEGY_TIERS.includes(value.tier as never)) issues.push({ path: `${path}.tier`, message: 'must be tier 1 through 4' })
  for (const coordinate of ['x', 'y'] as const) {
    if (typeof value[coordinate] !== 'number' || !Number.isFinite(value[coordinate]) || value[coordinate] < 0 || value[coordinate] > 100) {
      issues.push({ path: `${path}.${coordinate}`, message: 'must be a finite number from 0 to 100' })
    }
  }
  if (!isNonEmptyString(value.iconKey)) issues.push({ path: `${path}.iconKey`, message: 'must be non-empty' })
  validateLocalizedText(value.title, `${path}.title`, issues)
  validateLocalizedText(value.summary, `${path}.summary`, issues)
  validateLocalizedText(value.action, `${path}.action`, issues)
  if (typeof value.enabled !== 'boolean') issues.push({ path: `${path}.enabled`, message: 'must be boolean' })

  const hasBaseCost = value.baseCost !== undefined
  const hasLegacyAction = value.legacyAction !== undefined
  if (hasBaseCost === hasLegacyAction) {
    issues.push({ path, message: 'must define exactly one of baseCost or legacyAction' })
  } else if (hasBaseCost && (typeof value.baseCost !== 'number' || !Number.isFinite(value.baseCost) || value.baseCost <= 0)) {
    issues.push({ path: `${path}.baseCost`, message: 'must be a positive finite number' })
  } else if (hasLegacyAction) {
    if (!isRecord(value.legacyAction)) {
      issues.push({ path: `${path}.legacyAction`, message: 'must be an object' })
    } else {
      if (!LEGACY_STRATEGY_ACTIONS.includes(value.legacyAction.id as never)) {
        issues.push({ path: `${path}.legacyAction.id`, message: 'must be a known legacy action' })
      }
      if (typeof value.legacyAction.repeatable !== 'boolean') {
        issues.push({ path: `${path}.legacyAction.repeatable`, message: 'must be boolean' })
      }
    }
  }

  validatePrerequisite(value.prerequisite, `${path}.prerequisite`, issues)
  for (const field of ['exclusions', 'comboEventIds'] as const) {
    if (!Array.isArray(value[field]) || value[field].some((item) => !isNonEmptyString(item))) {
      issues.push({ path: `${path}.${field}`, message: 'must be an array of non-empty ids' })
    } else if (new Set(value[field]).size !== value[field].length) {
      issues.push({ path: `${path}.${field}`, message: 'must not contain duplicates' })
    }
  }

  if (!Array.isArray(value.effects) || value.effects.length === 0) {
    issues.push({ path: `${path}.effects`, message: 'must be a non-empty array' })
  } else {
    value.effects.forEach((effect, effectIndex) => {
      const effectPath = `${path}.effects[${effectIndex}]`
      if (!isRecord(effect)) {
        issues.push({ path: effectPath, message: 'must be an effect descriptor' })
        return
      }
      validateLocalizedText(effect.text, `${effectPath}.text`, issues)
      if (!STRATEGY_EFFECT_METRICS.includes(effect.metric as never)) {
        issues.push({ path: `${effectPath}.metric`, message: 'must be a supported metric' })
        return
      }
      const metric = effect.metric as StrategyEffectMetric
      const multiplier = metric === 'incomeMultiplier' || metric === 'opexMultiplier' || metric === 'regionFit'
      const expectedOperation = multiplier ? 'multiply' : metric === 'idleFloor' ? 'max' : 'add'
      if (effect.operation !== expectedOperation) {
        issues.push({ path: `${effectPath}.operation`, message: `must be ${expectedOperation} for ${metric}` })
      }
      if (typeof effect.value !== 'number' || !Number.isFinite(effect.value)) {
        issues.push({ path: `${effectPath}.value`, message: 'must be a finite number' })
      } else {
        const bounds = STRATEGY_EFFECT_BOUNDS[metric]
        if (effect.value < bounds.min || effect.value > bounds.max) {
          issues.push({ path: `${effectPath}.value`, message: `must be between ${bounds.min} and ${bounds.max}` })
        }
      }
      if (metric === 'rivalShare' && effect.scope !== 'strongest-rival' && effect.scope !== 'all-rivals') {
        issues.push({ path: `${effectPath}.scope`, message: 'rivalShare requires a rival scope' })
      }
      if ((metric === 'regionFit' || metric === 'usersPopulationShare')
        && effect.scope !== 'global'
        && !WORLD_EVENT_REGION_IDS.includes(effect.scope as never)) {
        issues.push({ path: `${effectPath}.scope`, message: 'regional effects require a region or global scope' })
      }
    })
  }

  return true
}

export const validateStrategyCatalog = (
  value: unknown,
  worldEventIds: ReadonlySet<string> = new Set(WORLD_EVENTS.map((event) => event.id)),
): readonly StrategyCatalogValidationIssue[] => {
  const issues: StrategyCatalogValidationIssue[] = []
  if (!Array.isArray(value)) return [{ path: '$', message: 'must be an array' }]

  if (value.length !== 50) issues.push({ path: '$', message: 'must contain exactly 50 nodes' })
  const nodes = value.filter((node, index) => validateNodeShape(node, index, issues)) as StrategyNode[]
  const byId = new Map(nodes.map((node) => [node.id, node]))
  if (byId.size !== nodes.length) issues.push({ path: '$', message: 'node ids must be unique' })

  for (const category of STRATEGY_CATEGORIES) {
    const actual = nodes.filter((node) => node.category === category).length
    const expected = EXPECTED_STRATEGY_NODE_COUNTS[category]
    if (actual !== expected) issues.push({ path: '$', message: `${category} must contain exactly ${expected} nodes (found ${actual})` })
  }

  nodes.forEach((node, index) => {
    const prerequisiteIds = collectPrerequisiteIds(node.prerequisite)
    prerequisiteIds.forEach((id) => {
      const prerequisiteNode = byId.get(id)
      if (!prerequisiteNode) issues.push({ path: `[${index}].prerequisite`, message: `unknown node id ${id}` })
      else if (prerequisiteNode.tier > node.tier) {
        issues.push({
          path: `[${index}].prerequisite`,
          message: `prerequisite ${id} tier ${prerequisiteNode.tier} exceeds node tier ${node.tier}`,
        })
      }
      if (id === node.id) issues.push({ path: `[${index}].prerequisite`, message: 'node cannot require itself' })
      if (node.exclusions.includes(id)) {
        issues.push({ path: `[${index}].prerequisite`, message: `node cannot both require and exclude ${id}` })
      }
    })
    node.exclusions.forEach((id) => {
      const excluded = byId.get(id)
      if (!excluded) issues.push({ path: `[${index}].exclusions`, message: `unknown node id ${id}` })
      else if (!excluded.exclusions.includes(node.id)) issues.push({ path: `[${index}].exclusions`, message: `${id} must exclude ${node.id}` })
      if (id === node.id) issues.push({ path: `[${index}].exclusions`, message: 'node cannot exclude itself' })
    })
    node.comboEventIds.forEach((id) => {
      if (!worldEventIds.has(id)) issues.push({ path: `[${index}].comboEventIds`, message: `unknown WORLD_EVENTS id ${id}` })
    })
  })

  const visiting = new Set<StrategyNodeId>()
  const visited = new Set<StrategyNodeId>()
  const visit = (id: StrategyNodeId, trail: readonly StrategyNodeId[]) => {
    if (visiting.has(id)) {
      issues.push({ path: '$', message: `prerequisite cycle: ${[...trail, id].join(' -> ')}` })
      return
    }
    if (visited.has(id)) return
    const node = byId.get(id)
    if (!node) return
    visiting.add(id)
    collectPrerequisiteIds(node.prerequisite).forEach((requiredId) => visit(requiredId, [...trail, id]))
    visiting.delete(id)
    visited.add(id)
  }
  nodes.forEach((node) => visit(node.id, []))

  return issues
}

export const assertValidStrategyCatalog = (value: unknown): asserts value is readonly StrategyNode[] => {
  const issues = validateStrategyCatalog(value)
  if (issues.length > 0) {
    throw new Error(`Invalid strategy catalog:\n${issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')}`)
  }
}
