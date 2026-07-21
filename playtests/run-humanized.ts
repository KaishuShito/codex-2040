import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { HUMAN_PROFILES, runHumanizedPlaythrough, type HumanizedPlayResult } from './humanized'
import type { PlayPolicy } from './harness'

const [outputPath = 'playtests/results-humanized/runs.json', runsPerCombinationRaw = '5', seedBaseRaw = '31001'] = process.argv.slice(2)
const runsPerCombination = Math.max(1, Number.parseInt(runsPerCombinationRaw, 10) || 5)
const seedBase = Number.parseInt(seedBaseRaw, 10) || 31_001

const policies: PlayPolicy[] = []
for (let index = 1; index <= 10; index += 1) {
  const file = resolve(`playtests/policies/agent-${String(index).padStart(2, '0')}.ts`)
  const imported = await import(pathToFileURL(file).href) as { default?: PlayPolicy; policy?: PlayPolicy }
  const policy = imported.default ?? imported.policy
  if (!policy) throw new Error(`${file} must export a play policy`)
  policies.push(policy)
}

const results: HumanizedPlayResult[] = []
for (const [policyIndex, policy] of policies.entries()) {
  for (const [profileIndex, profile] of HUMAN_PROFILES.entries()) {
    for (let run = 1; run <= runsPerCombination; run += 1) {
      const seed = (seedBase + policyIndex * 1_000_003 + profileIndex * 100_003 + (run - 1) * 104_729) >>> 0
      results.push(runHumanizedPlaythrough(policy, profile, { seed, run }))
    }
  }
}

const absoluteOutput = resolve(outputPath)
await mkdir(dirname(absoluteOutput), { recursive: true })
await writeFile(absoluteOutput, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
const complete = results.filter(({ completed }) => completed).length
const meanScore = results.reduce((sum, { score }) => sum + score, 0) / results.length
process.stdout.write(`${complete}/${results.length} humanized synthetic runs completed, mean score ${(meanScore * 100).toFixed(1)}\n`)
