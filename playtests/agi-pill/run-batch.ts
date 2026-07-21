import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { analyzePillWorldlines } from './analyze'
import { pillBatchSeeds, runPillWorldline } from './harness'
import { PILL_POLICIES } from './policies'
import { renderPillReportMarkdown } from './report'

const outputPath = resolve(process.argv[2] ?? 'playtests/agi-pill/worldlines.json')
const reportPath = resolve(process.argv[3] ?? 'playtests/agi-pill/REPORT.md')
const seedCount = Math.max(2, Number.parseInt(process.argv[4] ?? '12', 10))
const seeds = pillBatchSeeds(seedCount)
const results = PILL_POLICIES.flatMap(({ id }) => seeds.flatMap((seed) => [0, 1].map((repeat) =>
  runPillWorldline(id, { seed, repeat }))))
const report = analyzePillWorldlines(results)
const evidence = results.filter(({ repeat }) => repeat === 0).map((run) => ({
  policyId: run.policyId,
  seed: run.seed,
  ticks: run.ticks,
  terminal: run.terminal,
  endingId: run.endingId,
  outcomeClass: run.outcomeClass,
  score: run.score,
  success: run.success,
  acceptedActions: run.actionLog.filter(({ accepted }) => accepted).length,
  adverseEvents: run.adverseEvents,
  recoveredAdverseEvents: run.recoveredAdverseEvents,
  dueEventCount: run.dueEventCount,
  executedEventCount: run.executedEventCount,
  eventOptionIds: run.eventOptionIds,
  eligibleUpgradeOpportunities: run.eligibleUpgradeOpportunities,
  upgradePurchases: run.upgradePurchases,
  purchasedUpgradeIds: run.purchasedUpgradeIds,
  longestInoperableTicks: run.longestInoperableTicks,
  longestResourceStarvationTicks: run.longestResourceStarvationTicks,
  recoveriesAvailableDuringStarvation: run.recoveriesAvailableDuringStarvation,
  resources: run.resources,
}))

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, evidence, report }, null, 2)}\n`, 'utf8')
await writeFile(reportPath, renderPillReportMarkdown(report), 'utf8')

process.stdout.write(`AGI Pill: ${results.length} executions / ${report.uniqueWorldlines} unique worldlines\n`)
for (const item of report.findings) process.stdout.write(`${item.severity.toUpperCase()} ${item.id}: ${item.detail}\n`)
if (!report.pass) process.exitCode = 2
