import type { PillBatchReport } from './types'

const pct = (value: number) => `${(value * 100).toFixed(1)}%`

export const renderPillReportMarkdown = (report: PillBatchReport): string => {
  const policies = Object.values(report.byPolicy)
  const lines = [
    '# AGI Pill synthetic worldline report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Verdict: **${report.pass ? 'PASS' : 'FAIL'}** — ${report.runCount} deterministic executions, ${report.uniqueWorldlines} unique policy/seed worldlines.`,
    '',
    '## Policy distribution',
    '',
    '| Policy | Runs | Success | Mean score | Actions | Events | Upgrades | Recovery | Outcomes |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...policies.map((policy) => `| ${policy.policyId} | ${policy.runs} | ${pct(policy.successRate)} | ${policy.meanScore.toFixed(2)} | ${policy.meanAcceptedActions.toFixed(1)} | ${policy.meanEventsExecuted.toFixed(1)} | ${policy.meanUpgradePurchases.toFixed(1)} | ${pct(policy.recoveryRate)} | ${Object.entries(policy.outcomes).map(([id, count]) => `${id}:${count}`).join(', ')} |`),
    '',
    '## Invariants',
    '',
    '| Status | Invariant | Evidence |',
    '|---|---|---|',
    ...report.findings.map((item) => `| ${item.severity.toUpperCase()} | ${item.id} | ${item.detail.replaceAll('|', '\\|')} |`),
    '',
    '## Outcome distribution',
    '',
    ...Object.entries(report.outcomeDistribution).map(([id, count]) => `- ${id}: ${count}`),
    '',
    '## Interpretation limits',
    '',
    ...report.limitations.map((item) => `- ${item}`),
    '',
    'A passing synthetic report is supporting engine evidence only. Browser E2E remains the primary verifier for player-visible causality and recovery affordances.',
    '',
  ]
  return lines.join('\n')
}
