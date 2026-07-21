import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  HUMAN_PROFILES,
  adaptLegacyPolicy,
  humanizedV2Seeds,
  runHumanizedPlaythroughV2,
  type HumanizedSplit,
  type HumanizedV2Result,
} from './humanized-v2'
import type { PlayPolicy } from './harness'

const [
  outputPath = 'playtests/results-humanized-v2/holdout.json',
  splitRaw = 'holdout',
  runsPerCombinationRaw = '5',
] = process.argv.slice(2)
const split: HumanizedSplit = splitRaw === 'tuning' ? 'tuning' : 'holdout'
const runsPerCombination = Math.max(1, Number.parseInt(runsPerCombinationRaw, 10) || 5)

const policies: PlayPolicy[] = []
for (let index = 1; index <= 10; index += 1) {
  const file = resolve(`playtests/policies/agent-${String(index).padStart(2, '0')}.ts`)
  const imported = await import(pathToFileURL(file).href) as { default?: PlayPolicy; policy?: PlayPolicy }
  const policy = imported.default ?? imported.policy
  if (!policy) throw new Error(`${file} must export a play policy`)
  policies.push(policy)
}

const results: HumanizedV2Result[] = []
for (const [policyIndex, legacyPolicy] of policies.entries()) {
  const policy = adaptLegacyPolicy(legacyPolicy)
  for (const [profileIndex, profile] of HUMAN_PROFILES.entries()) {
    for (let runIndex = 0; runIndex < runsPerCombination; runIndex += 1) {
      const seeds = humanizedV2Seeds(split, runIndex, policyIndex, profileIndex)
      results.push(runHumanizedPlaythroughV2(policy, profile, {
        split,
        ...seeds,
        run: runIndex + 1,
      }))
    }
  }
}

const absoluteOutput = resolve(outputPath)
await mkdir(dirname(absoluteOutput), { recursive: true })
await writeFile(absoluteOutput, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
const complete = results.filter(({ completed }) => completed).length
const dropout = results.filter(({ droppedOut }) => droppedOut).length
const timeout = results.filter(({ timedOut }) => timedOut).length
process.stdout.write(`${complete}/${results.length} V2 ${split} runs completed; ${dropout} dropout; ${timeout} timeout\n`)
