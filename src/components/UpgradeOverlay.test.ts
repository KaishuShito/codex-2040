import { describe, expect, it } from 'vitest'
import type { StrategyNodeId, StrategyPrerequisite } from '../strategyNodes'
import {
  inferLegacyStrategyProgress,
  isStrategyPrerequisiteSatisfied,
  resolveStrategyNodeUiState,
} from './UpgradeOverlay'

const completed = (...ids: StrategyNodeId[]) => new Set<StrategyNodeId>(ids)

describe('UpgradeOverlay catalog state helpers', () => {
  it('evaluates nested all and any prerequisites', () => {
    const prerequisite: StrategyPrerequisite = {
      kind: 'all',
      terms: [
        { kind: 'node', id: 'model-foundation' },
        {
          kind: 'any',
          terms: [
            { kind: 'node', id: 'company-safety' },
            { kind: 'node', id: 'company-policy' },
          ],
        },
      ],
    }

    expect(isStrategyPrerequisiteSatisfied(prerequisite, completed('model-foundation', 'company-safety'))).toBe(true)
    expect(isStrategyPrerequisiteSatisfied(prerequisite, completed('model-foundation'))).toBe(false)
    expect(isStrategyPrerequisiteSatisfied(prerequisite, completed('company-policy'))).toBe(false)
  })

  it('maps the legacy App state into catalog progress during migration', () => {
    const progress = inferLegacyStrategyProgress({
      capability: 7,
      safety: 3,
      governance: 2,
      efficiency: 1.25,
      enabledFeatures: ['mobile', 'education', 'analysis'],
    })

    expect(progress).toEqual(completed(
      'model-foundation',
      'model-reasoning',
      'model-agents',
      'product-mobile',
      'product-education',
      'product-analysis',
      'company-safety',
      'company-datacenter',
    ))
    expect(progress.has('model-frontier')).toBe(false)
    expect(progress.has('company-policy')).toBe(false)
  })

  it('keeps a repeatable acquired node actionable when the engine reports ready', () => {
    expect(resolveStrategyNodeUiState(
      { status: 'ready', cost: 120, blockingNodeId: null },
      'complete',
    )).toBe('ready')
  })

  it('maps every terminal engine status without trusting UI inference', () => {
    expect(resolveStrategyNodeUiState({ status: 'acquired', cost: 0 }, 'ready')).toBe('complete')
    expect(resolveStrategyNodeUiState({ status: 'capped', cost: 0 }, 'ready')).toBe('complete')
    expect(resolveStrategyNodeUiState({ status: 'excluded', cost: 0 }, 'ready')).toBe('excluded')
    expect(resolveStrategyNodeUiState({ status: 'insufficient-compute', cost: 240 }, 'ready')).toBe('cost')
    expect(resolveStrategyNodeUiState({ status: 'cooldown', cost: 0 }, 'ready')).toBe('cooldown')
    expect(resolveStrategyNodeUiState({ status: 'disabled', cost: 0 }, 'ready')).toBe('locked')
  })
})
