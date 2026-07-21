import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { HumanizedPlayResult } from './humanized'

const inputPath = resolve(process.argv[2] ?? 'playtests/results-humanized/runs.json')
const outputPath = resolve(process.argv[3] ?? 'playtests/analysis-humanized.json')
const results = JSON.parse(await readFile(inputPath, 'utf8')) as HumanizedPlayResult[]
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
const quantile = (values: number[], q: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))]
}
const counts = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]))
const summarize = (runs: HumanizedPlayResult[]) => ({
  runs: runs.length,
  completed: runs.filter(({ completed }) => completed).length,
  meanScore: mean(runs.map(({ score }) => score)),
  meanAccess: mean(runs.map(({ worldAdoption }) => worldAdoption)),
  meanTrust: mean(runs.map(({ trust }) => trust)),
  meanCompute: mean(runs.map(({ compute }) => compute)),
  p95Compute: quantile(runs.map(({ compute }) => compute), 0.95),
  meanBrownoutDays: mean(runs.map(({ brownoutDays }) => brownoutDays)),
  p95BrownoutDays: quantile(runs.map(({ brownoutDays }) => brownoutDays), 0.95),
  meanMaxBrownoutStreak: mean(runs.map(({ maxBrownoutStreak }) => maxBrownoutStreak ?? 0)),
  p95MaxBrownoutStreak: quantile(runs.map(({ maxBrownoutStreak }) => maxBrownoutStreak ?? 0), 0.95),
  meanZeroComputeDays: mean(runs.map(({ zeroComputeDays }) => zeroComputeDays)),
  meanAcceptedActions: mean(runs.map(({ acceptedActionCount }) => acceptedActionCount)),
  meanRejectedActions: mean(runs.map(({ rejectedActionCount }) => rejectedActionCount)),
  meanDeferredActions: mean(runs.map(({ deferredActions }) => deferredActions)),
  meanBubbleCatchRate: mean(runs.map(({ bubblesSeen, bubblesCollected }) => bubblesSeen ? bubblesCollected / bubblesSeen : 0)),
  meanRealMinutes: mean(runs.map(({ realSecondsElapsed }) => realSecondsElapsed / 60)),
  endings: counts(runs.map(({ ending }) => ending)),
  ranks: counts(runs.map(({ rank }) => rank)),
})

const profileIds = [...new Set(results.map(({ profileId }) => profileId))].sort()
const policyIds = [...new Set(results.map(({ policyId }) => policyId))].sort()
const analysis = {
  generatedAt: new Date().toISOString(),
  limitations: [
    'These are deterministic synthetic behavior models, not observations of real people.',
    'The underlying strategic intents were authored by agents and can remain more coherent than a first-time human.',
    'DOM discoverability, pointer travel, reading comprehension, audio, and social context require Browser sessions or real telemetry.',
  ],
  evidence: {
    runCount: results.length,
    policyCount: policyIds.length,
    profileCount: profileIds.length,
    allCompleted: results.every(({ completed }) => completed),
    expectedMatrixSatisfied: policyIds.length >= 10 && profileIds.length >= 5 && results.length >= 250,
  },
  overall: summarize(results),
  byProfile: Object.fromEntries(profileIds.map((id) => [id, summarize(results.filter(({ profileId }) => profileId === id))])),
  byPolicy: Object.fromEntries(policyIds.map((id) => [id, summarize(results.filter(({ policyId }) => policyId === id))])),
  redFlags: {
    passiveHighRanks: results.filter(({ policyId, rank }) => policyId.includes('passive') && (rank === 'S' || rank === 'A' || rank === 'B')).length,
    lowAccessHighRanks: results.filter(({ worldAdoption, rank }) => worldAdoption < 0.1 && (rank === 'S' || rank === 'A')).length,
    longDeadlocks: results.filter(({ zeroComputeDays }) => zeroComputeDays >= 180).length,
    excessiveTreasuries: results.filter(({ compute }) => compute >= 15_000).length,
  },
}

await writeFile(outputPath, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify(analysis.evidence)}\n`)
process.stdout.write(`score=${(analysis.overall.meanScore * 100).toFixed(1)} access=${(analysis.overall.meanAccess * 100).toFixed(1)}% deadlocks=${analysis.redFlags.longDeadlocks} passive-high=${analysis.redFlags.passiveHighRanks}\n`)
if (!analysis.evidence.expectedMatrixSatisfied || !analysis.evidence.allCompleted) process.exitCode = 2
