import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runPlaythrough, type PlayPolicy } from './harness'

const [policyPath, outputPath, runCountRaw = '5', seedBaseRaw = '2040'] = process.argv.slice(2)
if (!policyPath || !outputPath) {
  throw new Error('Usage: tsx playtests/run-policy.ts <policy.ts> <output.json> [run-count] [seed-base]')
}

const imported = await import(pathToFileURL(resolve(policyPath)).href) as { default?: PlayPolicy; policy?: PlayPolicy }
const policy = imported.default ?? imported.policy
if (!policy) throw new Error(`Policy module ${policyPath} must export default or named policy`)
const runCount = Math.max(1, Number.parseInt(runCountRaw, 10) || 5)
const seedBase = Number.parseInt(seedBaseRaw, 10) || 2040
const results = Array.from({ length: runCount }, (_, index) => runPlaythrough(policy, {
  run: index + 1,
  seed: (seedBase + index * 104_729) >>> 0,
}))

const absoluteOutput = resolve(outputPath)
await mkdir(dirname(absoluteOutput), { recursive: true })
await writeFile(absoluteOutput, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
const complete = results.filter((result) => result.completed).length
const meanScore = results.reduce((sum, result) => sum + result.score, 0) / results.length
process.stdout.write(`${policy.id}: ${complete}/${results.length} completed, mean score ${(meanScore * 100).toFixed(1)}\n`)

