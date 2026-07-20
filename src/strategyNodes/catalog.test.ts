import { describe, expect, it } from 'vitest'
import { WORLD_EVENTS } from '../worldEvents/catalog'
import { STRATEGY_CATALOG } from './catalog'
import {
  EXPECTED_STRATEGY_NODE_COUNTS,
  collectPrerequisiteIds,
  validateStrategyCatalog,
} from './validator'
import {
  STRATEGY_CATEGORIES,
  STRATEGY_EFFECT_BOUNDS,
  STRATEGY_EFFECT_METRICS,
  type StrategyNodeId,
} from './types'

const byId = new Map<StrategyNodeId, (typeof STRATEGY_CATALOG)[number]>(
  STRATEGY_CATALOG.map((node) => [node.id, node]),
)

describe('strategy node catalog', () => {
  it('contains exactly 50 nodes with the fixed category counts', () => {
    expect(STRATEGY_CATALOG).toHaveLength(50)
    for (const category of STRATEGY_CATEGORIES) {
      expect(STRATEGY_CATALOG.filter((node) => node.category === category)).toHaveLength(
        EXPECTED_STRATEGY_NODE_COUNTS[category],
      )
    }
  })

  it('uses unique kebab-case ids whose prefix matches the category', () => {
    const ids = STRATEGY_CATALOG.map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const node of STRATEGY_CATALOG) {
      expect(node.id).toMatch(/^(model|product|company|ecosystem)-[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(node.id.startsWith(`${node.category}-`)).toBe(true)
    }
  })

  it('preserves all 16 shipped overlay ids', () => {
    const shippedIds = [
      'model-foundation', 'model-reasoning', 'model-agents', 'model-frontier',
      'product-mobile', 'product-sso', 'product-education', 'product-research',
      'product-connectors', 'product-analysis', 'company-safety', 'company-policy',
      'company-datacenter', 'ecosystem-open', 'ecosystem-partners', 'ecosystem-commons',
    ] as const
    for (const id of shippedIds) expect(byId.has(id)).toBe(true)
  })

  it('keeps English and Japanese copy non-empty for title, summary, action, and effects', () => {
    for (const node of STRATEGY_CATALOG) {
      for (const localized of [node.title, node.summary, node.action]) {
        expect(localized.en.trim()).not.toBe('')
        expect(localized.ja.trim()).not.toBe('')
      }
      expect(node.effects.length).toBeGreaterThan(0)
      for (const effect of node.effects) {
        expect(effect.text.en.trim()).not.toBe('')
        expect(effect.text.ja.trim()).not.toBe('')
      }
    }
  })

  it('references existing prerequisite ids and forms a DAG', () => {
    for (const node of STRATEGY_CATALOG) {
      for (const requiredId of collectPrerequisiteIds(node.prerequisite)) expect(byId.has(requiredId)).toBe(true)
    }

    const visiting = new Set<StrategyNodeId>()
    const visited = new Set<StrategyNodeId>()
    const visit = (id: StrategyNodeId) => {
      expect(visiting.has(id), `cycle reaches ${id}`).toBe(false)
      if (visited.has(id)) return
      visiting.add(id)
      const node = byId.get(id)
      expect(node).toBeDefined()
      for (const requiredId of collectPrerequisiteIds(node!.prerequisite)) visit(requiredId)
      visiting.delete(id)
      visited.add(id)
    }
    for (const node of STRATEGY_CATALOG) visit(node.id)
  })

  it('keeps exclusions symmetric', () => {
    for (const node of STRATEGY_CATALOG) {
      for (const excludedId of node.exclusions) {
        expect(byId.get(excludedId)?.exclusions).toContain(node.id)
      }
    }
  })

  it('uses only combo ids present in WORLD_EVENTS', () => {
    const worldEventIds = new Set(WORLD_EVENTS.map((event) => event.id))
    for (const node of STRATEGY_CATALOG) {
      for (const comboEventId of node.comboEventIds) expect(worldEventIds.has(comboEventId)).toBe(true)
    }
  })

  it('uses the closed metric set and keeps every effect within its metric bounds', () => {
    for (const node of STRATEGY_CATALOG) {
      for (const effect of node.effects) {
        expect(STRATEGY_EFFECT_METRICS).toContain(effect.metric)
        const bounds = STRATEGY_EFFECT_BOUNDS[effect.metric]
        expect(effect.value).toBeGreaterThanOrEqual(bounds.min)
        expect(effect.value).toBeLessThanOrEqual(bounds.max)
      }
    }
  })

  it('passes the complete runtime validator', () => {
    expect(validateStrategyCatalog(STRATEGY_CATALOG)).toEqual([])
  })
})
