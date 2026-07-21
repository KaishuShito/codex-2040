import { describe, expect, it } from 'vitest'
import { AGI_PILL_SOURCES } from './content'
import { applyAgiPillEffects, createAgiPillState } from './engine'
import type { AgiPillEffect, AgiPillMetricKey, AgiPillState } from './types'
import {
  AGI_PILL_AXES,
  AGI_PILL_EFFECT_METRICS,
  AGI_PILL_SOURCE_TIERS,
  AGI_PILL_UPGRADES,
  collectAgiPillPrerequisiteIds,
  getAgiPillUpgrade,
  isAgiPillPrerequisiteSatisfied,
  validateAgiPillUpgradeCatalog,
  type AgiPillUpgradeId,
} from './upgrades'

const observedValue = (state: AgiPillState, metric: AgiPillMetricKey): number => {
  if (metric === 'orbitalIndustry' || metric === 'dysonProgress' || metric === 'postDysonExpansion') return state.expansion[metric]
  if (metric === 'rivalPressure') return state.rivalCivilizations.reduce((total, rival) => total + rival.capability, 0)
  return state[metric]
}

describe('AGI Pill upgrade graph', () => {
  it('contains five bilingual, costed nodes on every strategic axis', () => {
    expect(AGI_PILL_UPGRADES).toHaveLength(45)
    for (const axis of AGI_PILL_AXES) {
      const nodes = AGI_PILL_UPGRADES.filter((item) => item.axis === axis)
      expect(nodes, axis).toHaveLength(5)
      expect(nodes.map((item) => item.tier)).toEqual([1, 2, 3, 4, 5])
    }
    for (const item of AGI_PILL_UPGRADES) {
      for (const copy of [item.title, item.summary, item.action, item.tradeoff]) {
        expect(copy.en.trim()).not.toBe('')
        expect(copy.ja.trim()).not.toBe('')
      }
      expect(Object.values(item.cost).every((cost) => cost > 0)).toBe(true)
      expect(item.effects.length).toBeGreaterThan(0)
      expect(AGI_PILL_SOURCE_TIERS).toContain(item.sourceTier)
      for (const effect of item.effects) {
        expect(AGI_PILL_EFFECT_METRICS).toContain(effect.metric)
        expect(['add', 'multiply', 'set']).toContain(effect.operation)
        expect(Number.isFinite(effect.value)).toBe(true)
        expect(effect.text.en.trim()).not.toBe('')
        expect(effect.text.ja.trim()).not.toBe('')
      }
      expect(item.sourceRefs.length).toBeGreaterThan(0)
    }
  })

  it('is a valid DAG with resolvable prerequisites', () => {
    expect(validateAgiPillUpgradeCatalog(AGI_PILL_UPGRADES)).toEqual([])
    const ids = new Set(AGI_PILL_UPGRADES.map((item) => item.id))
    for (const item of AGI_PILL_UPGRADES) {
      for (const required of collectAgiPillPrerequisiteIds(item.prerequisite)) expect(ids.has(required)).toBe(true)
    }
  })

  it('routes every citation to the content registry at its declared evidence tier', () => {
    const sources = new Map(AGI_PILL_SOURCES.map((source) => [source.id, source]))
    for (const item of AGI_PILL_UPGRADES) {
      const resolved = item.sourceRefs.map((id) => sources.get(id))
      expect(resolved.every(Boolean), `${item.id}: ${item.sourceRefs.join(', ')}`).toBe(true)
      expect(resolved.some((source) => source?.tier === item.sourceTier), `${item.id}: ${item.sourceTier}`).toBe(true)
    }
  })

  it('uses engine-supported, observable stock semantics for every displayed effect', () => {
    const seeded = createAgiPillState({ seed: 45 })
    const initial: AgiPillState = {
      ...seeded,
      intelligence: 2,
      compute: 10,
      energy: 10,
      robots: 10,
      resources: 50,
      safety: 40,
      governance: 40,
      friction: 30,
      risk: 10,
      expansion: { orbitalIndustry: 2, dysonProgress: 10, dysonBuilt: true, postDysonExpansion: 3 },
    }
    for (const item of AGI_PILL_UPGRADES) {
      for (const effect of item.effects) {
        const engineEffect: AgiPillEffect = {
          metric: effect.metric,
          operation: effect.operation,
          value: effect.value,
        }
        const before = observedValue(initial, effect.metric)
        const after = observedValue(applyAgiPillEffects(initial, [engineEffect]), effect.metric)
        expect(after, `${item.id}: ${effect.metric} ${effect.operation} ${effect.value}`).not.toBe(before)
        expect(effect.text.en).toContain(String(Math.abs(effect.value)))
        expect(effect.text.ja).toContain(String(Math.abs(effect.value)))
      }
    }
  })

  it('does not multiply zero-initialized expansion stocks or unlock post-Dyson progress early', () => {
    const expansionMetrics = new Set<AgiPillMetricKey>(['orbitalIndustry', 'dysonProgress', 'postDysonExpansion'])
    for (const item of AGI_PILL_UPGRADES) {
      for (const effect of item.effects) {
        if (expansionMetrics.has(effect.metric)) expect(effect.operation).not.toBe('multiply')
        if (effect.metric === 'postDysonExpansion') expect(item.tags).toContain('post-dyson')
      }
    }
    expect(AGI_PILL_UPGRADES.flatMap((item) => item.effects).some((effect) => effect.text.en.includes('growth x'))).toBe(false)
  })

  it('keeps every node reachable under all/any prerequisite semantics', () => {
    const acquired = new Set<AgiPillUpgradeId>()
    let changed = true
    while (changed) {
      changed = false
      for (const item of AGI_PILL_UPGRADES) {
        if (!acquired.has(item.id) && isAgiPillPrerequisiteSatisfied(item.prerequisite, acquired)) {
          acquired.add(item.id)
          changed = true
        }
      }
    }
    expect(acquired.size).toBe(AGI_PILL_UPGRADES.length)
  })

  it('uses cross-axis dependencies so no axis is a self-contained optimal lane', () => {
    for (const axis of AGI_PILL_AXES) {
      const deepNodes = AGI_PILL_UPGRADES.filter((item) => item.axis === axis && item.tier >= 3)
      expect(deepNodes.some((item) => collectAgiPillPrerequisiteIds(item.prerequisite)
        .some((id) => getAgiPillUpgrade(id)?.axis !== axis)), axis).toBe(true)
    }
  })

  it('makes Dyson a demanding midgame gate with substantial play after it', () => {
    const dyson = getAgiPillUpgrade('resources-dyson-seed')
    expect(dyson?.tier).toBe(4)
    expect(dyson?.tags).toContain('dyson-gate')
    expect(new Set(collectAgiPillPrerequisiteIds(dyson!.prerequisite).map((id) => getAgiPillUpgrade(id)?.axis)).size).toBeGreaterThanOrEqual(5)

    const directOrTransitiveDependents = new Set<AgiPillUpgradeId>(['resources-dyson-seed'])
    let changed = true
    while (changed) {
      changed = false
      for (const item of AGI_PILL_UPGRADES) {
        if (!directOrTransitiveDependents.has(item.id)
          && collectAgiPillPrerequisiteIds(item.prerequisite).some((id) => directOrTransitiveDependents.has(id))) {
          directOrTransitiveDependents.add(item.id)
          changed = true
        }
      }
    }
    expect(directOrTransitiveDependents.size - 1).toBeGreaterThanOrEqual(8)
    expect(AGI_PILL_UPGRADES.filter((item) => item.tags.includes('post-dyson')).length).toBeGreaterThanOrEqual(8)
  })

  it('rejects cycles and missing bilingual tradeoff copy', () => {
    const broken = AGI_PILL_UPGRADES.map((item) => item.id === 'intelligence-agent-clones'
      ? { ...item, prerequisite: { kind: 'node' as const, id: 'intelligence-recursive-research' as const }, tradeoff: { en: '', ja: '' } }
      : item)
    const issues = validateAgiPillUpgradeCatalog(broken)
    expect(issues.some((issue) => issue.message.startsWith('prerequisite cycle'))).toBe(true)
    expect(issues.some((issue) => issue.path.endsWith('.tradeoff'))).toBe(true)
  })
})
