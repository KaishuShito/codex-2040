import { describe, expect, it } from 'vitest'
import { analyzePillWorldlines } from './analyze'
import type { PillPolicyId, PillWorldlineResult } from './types'

const policies: PillPolicyId[] = [
  'balanced',
  'passive',
  'overaccelerate',
  'safety-first',
  'industry-first',
  'governance-first',
]

const fixture = (policyId: PillPolicyId, seed: number, repeat: number): PillWorldlineResult => ({
  harnessVersion: 1,
  policyId,
  seed,
  repeat,
  terminal: true,
  ticks: 100,
  endingId: `${policyId}-${seed % 2}`,
  outcomeClass: policyId === 'passive'
    ? 'stagnation'
    : policyId === 'industry-first'
      ? 'managed-transition'
      : seed % 2 ? 'managed-transition' : 'plural-expansion',
  score: policyId === 'balanced' && seed === 1 ? 90 : policyId === 'safety-first' && seed === 2 ? 92 : 70,
  success: policyId !== 'passive',
  resources: { compute: 10 },
  peakResources: { compute: 20 },
  actionLog: policyId === 'passive' ? [] : [{ tick: 1, type: 'invest', accepted: true }],
  causalLog: [
    { tick: 90, kind: 'warning', id: 'trajectory-warning', causes: ['trajectory'], playerFacing: true },
    { tick: 100, kind: 'ending', id: 'ending', causes: ['trajectory'], playerFacing: true },
  ],
  longestInoperableTicks: 0,
  longestResourceStarvationTicks: 0,
  recoveriesAvailableDuringStarvation: 0,
  adverseEvents: 1,
  recoveredAdverseEvents: 1,
  dueEventCount: 1,
  executedEventCount: 1,
  eventOptionIds: [`event-${policyId}:option-${seed}`],
  eligibleUpgradeOpportunities: 1,
  upgradePurchases: policyId === 'passive' ? 0 : 2,
  purchasedUpgradeIds: policyId === 'passive' ? [] : [`upgrade-${policyId}-a`, `upgrade-${policyId}-b`],
  fingerprint: `${policyId}:${seed}`,
})

describe('AGI Pill batch invariants', () => {
  it('passes a diverse, deterministic, recoverable matrix', () => {
    const runs = policies.flatMap((policy) => [1, 2].flatMap((seed) => [0, 1].map((repeat) => fixture(policy, seed, repeat))))
    const report = analyzePillWorldlines(runs, { generatedAt: 'fixed' })
    expect(report.pass).toBe(true)
    expect(report.runCount).toBe(24)
    expect(report.policyCount).toBe(6)
    expect(report.findings.every(({ severity }) => severity !== 'fail')).toBe(true)
  })

  it('detects nondeterminism, passive auto-win, deadlock, and opaque death', () => {
    const runs = policies.flatMap((policy) => [fixture(policy, 1, 0), fixture(policy, 1, 1)])
    const bad = runs.map((run) => run.policyId === 'passive' && run.repeat === 1 ? {
      ...run,
      fingerprint: 'changed',
      success: true,
      outcomeClass: 'misalignment' as const,
      longestInoperableTicks: 99,
      longestResourceStarvationTicks: 99,
      causalLog: [{ tick: 100, kind: 'ending' as const, id: 'opaque', causes: [], playerFacing: false }],
    } : run)
    const report = analyzePillWorldlines(bad, { generatedAt: 'fixed' })
    expect(report.pass).toBe(false)
    expect(report.findings.filter(({ severity }) => severity === 'fail').map(({ id }) => id).sort()).toEqual(
      expect.arrayContaining(['automatic-passive-win', 'determinism', 'opaque-instant-death', 'resource-deadlock']),
    )
  })

  it('fails explicitly when the matrix contains no viable strategy', () => {
    const runs = policies.flatMap((policy) => [1, 2].flatMap((seed) => [0, 1].map((repeat) => ({
      ...fixture(policy, seed, repeat),
      success: false,
      outcomeClass: 'capture' as const,
    }))))
    const report = analyzePillWorldlines(runs, { generatedAt: 'fixed' })
    expect(report.findings.find(({ id }) => id === 'viable-strategies')?.severity).toBe('fail')
  })
})
