import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { PlayResult } from './harness'

const resultsDirectory = resolve(process.argv[2] ?? 'playtests/results')
const outputPath = resolve(process.argv[3] ?? 'playtests/analysis.json')
const files = (await readdir(resultsDirectory)).filter((file) => /^agent-\d+\.json$/.test(file)).sort()
const results = (await Promise.all(files.map(async (file) => JSON.parse(
  await readFile(resolve(resultsDirectory, file), 'utf8'),
) as PlayResult[]))).flat()

const mean = (values: number[]) => values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
const counts = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]))
const summarize = (runs: PlayResult[]) => ({
  runs: runs.length,
  completed: runs.filter((run) => run.completed).length,
  meanScore: mean(runs.map((run) => run.score)),
  meanWorldAdoption: mean(runs.map((run) => run.worldAdoption)),
  meanCodexShare: mean(runs.map((run) => run.codexShare)),
  meanTrust: mean(runs.map((run) => run.trust)),
  meanExtinctionRisk: mean(runs.map((run) => run.extinctionRisk)),
  meanBrownoutDays: mean(runs.map((run) => run.brownoutDays)),
  meanMaxBrownoutStreak: mean(runs.map((run) => run.maxBrownoutStreak ?? 0)),
  meanZeroComputeDays: mean(runs.map((run) => run.zeroComputeDays)),
  meanAcceptedActions: mean(runs.map((run) => run.acceptedActionCount)),
  meanRejectedActions: mean(runs.map((run) => run.rejectedActionCount)),
  endings: counts(runs.map((run) => run.ending)),
  ranks: counts(runs.map((run) => run.rank)),
})

const policyIds = [...new Set(results.map((result) => result.policyId))].sort()
const suspicious = {
  highRankLowAccess: results.filter((run) => (run.rank === 'S' || run.rank === 'A') && run.worldAdoption < .10)
    .map(({ policyId, run, rank, worldAdoption, score }) => ({ policyId, run, rank, worldAdoption, score })),
  computeDeadlocks: results.filter((run) => run.zeroComputeDays >= 180)
    .map(({ policyId, run, zeroComputeDays, brownoutDays, ending }) => ({ policyId, run, zeroComputeDays, brownoutDays, ending })),
  terminalBeforeChoices: results.filter((run) => run.choice2029 === null || (run.year >= 2035 && run.choice2035 === null))
    .map(({ policyId, run, year, ending, choice2029, choice2035 }) => ({ policyId, run, year, ending, choice2029, choice2035 })),
  excessiveRejectedActions: results.filter((run) => run.rejectedActionCount > Math.max(10, run.acceptedActionCount))
    .map(({ policyId, run, acceptedActionCount, rejectedActionCount }) => ({ policyId, run, acceptedActionCount, rejectedActionCount })),
}

const analysis = {
  generatedAt: new Date().toISOString(),
  evidence: {
    files,
    policyCount: policyIds.length,
    runCount: results.length,
    allCompleted: results.every((result) => result.completed),
    minimumSatisfied: policyIds.length >= 10 && results.length >= 50 && results.every((result) => result.completed),
  },
  overall: summarize(results),
  byPolicy: Object.fromEntries(policyIds.map((id) => [id, summarize(results.filter((result) => result.policyId === id))])),
  suspicious,
}

await writeFile(outputPath, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify(analysis.evidence)}\n`)
process.stdout.write(`scores=${(analysis.overall.meanScore * 100).toFixed(1)} access=${(analysis.overall.meanWorldAdoption * 100).toFixed(1)}% deadlocks=${suspicious.computeDeadlocks.length}\n`)
if (!analysis.evidence.minimumSatisfied) process.exitCode = 2
