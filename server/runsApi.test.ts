import { describe, expect, it } from 'vitest'
import {
  MINIMUM_COHORT_SIZE,
  MINIMUM_PERCENTILE_COHORT_SIZE,
  type AuthorizedCompleteRunInput,
  type RunAggregate,
  type RunLanguage,
  type RunRecord,
  type RunsRepository,
  type RunStats,
  type StartRunInput,
  type WriteResult,
} from './d1'
import { handleRunsApi } from './runsApi'
import { RULESET_VERSION } from '../shared/ruleset'

const PLAY_ID = '11111111-1111-4111-8111-111111111111'
const STARTED_AT = '2026-07-21T00:00:00.000Z'

const emptyAggregate = (): RunAggregate => ({
  total_completed: null,
  percentile: null,
  ending_distribution: null,
  choice_2029_distribution: null,
  choice_2035_distribution: null,
})

const distribution = (runs: RunRecord[], field: 'ending' | 'choice_2029' | 'choice_2035') =>
  Object.fromEntries([...new Set(runs.map((run) => run[field]))].map((value) => [
    value ?? 'not_reached',
    runs.filter((run) => run[field] === value).length,
  ]))

const privacySafeDistribution = (runs: RunRecord[], field: 'ending' | 'choice_2029' | 'choice_2035') => {
  const visible = Object.entries(distribution(runs, field)).filter(([, count]) => count >= MINIMUM_COHORT_SIZE)
  return visible.length > 0 ? Object.fromEntries(visible) : null
}

class MemoryRepository implements RunsRepository {
  runs = new Map<string, RunRecord>()

  async start(input: StartRunInput): Promise<WriteResult> {
    const existing = this.runs.get(input.play_id)
    if (existing) {
      const duplicate = existing.ruleset_version === input.ruleset_version
        && existing.language === input.language
        && existing.started_at === input.started_at
      return { status: duplicate ? 'duplicate' : 'conflict', run: existing }
    }
    const run: RunRecord = {
      ...input,
      completed_at: null,
      final_score: null,
      rank: null,
      ending: null,
      choice_2029: null,
      choice_2035: null,
      active_play_seconds: null,
    }
    this.runs.set(input.play_id, run)
    return { status: 'created', run }
  }

  async complete(playId: string, input: AuthorizedCompleteRunInput) {
    const existing = this.runs.get(playId)
    if (!existing) return { status: 'not_found' as const }
    if (existing.completion_token !== input.completion_token) return { status: 'unauthorized' as const }
    if (existing.completed_at !== null) {
      const duplicate = (Object.keys(input) as Array<keyof AuthorizedCompleteRunInput>)
        .every((key) => existing[key] === input[key])
      return { status: duplicate ? 'duplicate' as const : 'conflict' as const, run: existing }
    }
    const { completion_token: _, ...completion } = input
    const run = { ...existing, ...completion }
    this.runs.set(playId, run)
    return { status: 'created' as const, run }
  }

  async get(playId: string) {
    return this.runs.get(playId) ?? null
  }

  async aggregateFor(run: RunRecord): Promise<RunAggregate> {
    if (run.final_score === null) return emptyAggregate()
    const cohort = [...this.runs.values()].filter((candidate) =>
      candidate.completed_at !== null
      && candidate.ruleset_version === run.ruleset_version
      && candidate.language === run.language)
    if (cohort.length < MINIMUM_COHORT_SIZE) return emptyAggregate()
    return {
      total_completed: cohort.length,
      percentile: cohort.length >= MINIMUM_PERCENTILE_COHORT_SIZE
        ? Math.round(10 * cohort.filter((candidate) => candidate.final_score! <= run.final_score!).length / cohort.length) * 10
        : null,
      ending_distribution: privacySafeDistribution(cohort, 'ending'),
      choice_2029_distribution: privacySafeDistribution(cohort, 'choice_2029'),
      choice_2035_distribution: privacySafeDistribution(cohort, 'choice_2035'),
    }
  }

  async stats(language: RunLanguage | null, rulesetVersion: string): Promise<RunStats> {
    const runs = [...this.runs.values()].filter((run) =>
      run.ruleset_version === rulesetVersion
      && (language === null || run.language === language))
    const completed = runs.filter((run) => run.completed_at !== null)
    const suppressed = completed.length < MINIMUM_COHORT_SIZE
    return {
      minimum_cohort_size: MINIMUM_COHORT_SIZE,
      ruleset_version: rulesetVersion,
      language,
      total_started: suppressed ? null : runs.length,
      total_completed: suppressed ? null : completed.length,
      average_score: suppressed ? null : completed.reduce((sum, run) => sum + run.final_score!, 0) / completed.length,
      average_active_play_seconds: suppressed ? null : completed.reduce((sum, run) => sum + run.active_play_seconds!, 0) / completed.length,
      ending_distribution: suppressed ? null : distribution(completed, 'ending'),
      choice_2029_distribution: suppressed ? null : distribution(completed, 'choice_2029'),
      choice_2035_distribution: suppressed ? null : distribution(completed, 'choice_2035'),
    }
  }
}

const call = (repository: RunsRepository, path: string, init?: RequestInit) => handleRunsApi(
  new Request(`https://codex-2040.test${path}`, init),
  { DB: null as unknown as D1Database },
  { repository },
)

const startBody = (playId = PLAY_ID) => ({
  play_id: playId,
  ruleset_version: RULESET_VERSION,
  language: 'ja',
  started_at: STARTED_AT,
})

const completionBody = (completionToken: string, score = 78) => ({
  completion_token: completionToken,
  completed_at: '2026-07-21T00:14:02.000Z',
  final_score: score,
  rank: 'A',
  ending: 'managed-transition',
  choice_2029: 'verified-slowdown',
  choice_2035: 'hold-the-line',
  active_play_seconds: 842,
})

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://codex-2040.test' },
  body: JSON.stringify(body),
})

describe('runs API', () => {
  it('starts a run idempotently and rejects a conflicting reuse of play_id', async () => {
    const repository = new MemoryRepository()
    const created = await call(repository, '/api/runs/start', post(startBody()))
    expect(created?.status).toBe(201)
    expect(await created?.json()).toMatchObject({ ok: true, duplicate: false, run: { play_id: PLAY_ID } })

    const duplicate = await call(repository, '/api/runs/start', post(startBody()))
    expect(duplicate?.status).toBe(200)
    expect(await duplicate?.json()).toMatchObject({ ok: true, duplicate: true })

    const conflict = await call(repository, '/api/runs/start', post({ ...startBody(), language: 'en' }))
    expect(conflict?.status).toBe(409)
  })

  it('strictly rejects unknown fields, invalid enums, cross-origin writes, and oversized JSON', async () => {
    const repository = new MemoryRepository()
    const unknownField = await call(repository, '/api/runs/start', post({ ...startBody(), email: 'not-collected@example.com' }))
    expect(unknownField?.status).toBe(400)

    const invalidLanguage = await call(repository, '/api/runs/start', post({ ...startBody(), language: 'fr' }))
    expect(invalidLanguage?.status).toBe(400)

    const crossOrigin = await call(repository, '/api/runs/start', {
      ...post(startBody()),
      headers: { 'content-type': 'application/json', origin: 'https://other.test' },
    })
    expect(crossOrigin?.status).toBe(403)

    const missingOrigin = await call(repository, '/api/runs/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(startBody()),
    })
    expect(missingOrigin?.status).toBe(403)

    const oversized = await call(repository, '/api/runs/start', post({ ...startBody(), padding: 'x'.repeat(4_096) }))
    expect(oversized?.status).toBe(413)
  })

  it('completes once, returns the same receipt on retry, and rejects conflicting results', async () => {
    const repository = new MemoryRepository()
    const started = await call(repository, '/api/runs/start', post(startBody()))
    const { completion_token: completionToken } = await started!.json() as { completion_token: string }

    const completed = await call(repository, `/api/runs/${PLAY_ID}/complete`, post(completionBody(completionToken)))
    expect(completed?.status).toBe(200)
    expect(await completed?.json()).toMatchObject({
      ok: true,
      duplicate: false,
      run: { final_score: 78, rank: 'A' },
      aggregate: emptyAggregate(),
    })

    const duplicate = await call(repository, `/api/runs/${PLAY_ID}/complete`, post(completionBody(completionToken)))
    expect(await duplicate?.json()).toMatchObject({ ok: true, duplicate: true })

    const conflict = await call(repository, `/api/runs/${PLAY_ID}/complete`, post(completionBody(completionToken, 79)))
    expect(conflict?.status).toBe(409)

    const unauthorized = await call(repository, `/api/runs/${PLAY_ID}/complete`, post(completionBody('wrong-token-123456789012345678901234567890')))
    expect(unauthorized?.status).toBe(403)
  })

  it('rejects completion timestamps before the recorded start', async () => {
    const repository = new MemoryRepository()
    const started = await call(repository, '/api/runs/start', post(startBody()))
    const { completion_token: completionToken } = await started!.json() as { completion_token: string }
    const response = await call(repository, `/api/runs/${PLAY_ID}/complete`, post({
      ...completionBody(completionToken),
      completed_at: '2026-07-20T23:59:59.000Z',
    }))
    expect(response?.status).toBe(400)
  })

  it('reveals aggregate distributions only once the comparable cohort reaches five', async () => {
    const repository = new MemoryRepository()
    const playIds = Array.from({ length: 5 }, (_, index) => `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`)
    for (const [index, playId] of playIds.entries()) {
      const started = await call(repository, '/api/runs/start', post(startBody(playId)))
      const { completion_token: completionToken } = await started!.json() as { completion_token: string }
      await call(repository, `/api/runs/${playId}/complete`, post(completionBody(completionToken, 70 + index)))
    }

    const receipt = await call(repository, `/api/runs/${playIds[4]}/receipt`)
    expect(await receipt?.json()).toMatchObject({
      ok: true,
      aggregate: {
        total_completed: 5,
        percentile: null,
        ending_distribution: { 'managed-transition': 5 },
        choice_2029_distribution: { 'verified-slowdown': 5 },
        choice_2035_distribution: { 'hold-the-line': 5 },
      },
    })

    const stats = await call(repository, '/api/runs/stats?language=ja')
    expect(await stats?.json()).toMatchObject({
      ok: true,
      stats: { ruleset_version: RULESET_VERSION, language: 'ja', total_completed: 5, average_score: 72 },
    })
  })

  it('keeps stats cohorts separate across scoring rulesets', async () => {
    const repository = new MemoryRepository()
    const createCohort = async (rulesetVersion: string, score: number, prefix: string) => {
      for (let index = 0; index < 5; index += 1) {
        const playId = `${prefix}${String(index + 1).padStart(12, '0')}`
        const started = await call(repository, '/api/runs/start', post({
          ...startBody(playId),
          ruleset_version: rulesetVersion,
        }))
        const { completion_token: completionToken } = await started!.json() as { completion_token: string }
        await call(repository, `/api/runs/${playId}/complete`, post(completionBody(completionToken, score)))
      }
    }

    await createCohort('codex-2040-rules-v1', 90, '77777777-7777-4777-8777-')
    await createCohort(RULESET_VERSION, 60, '88888888-8888-4888-8888-')

    const current = await call(repository, '/api/runs/stats?language=ja')
    expect(await current?.json()).toMatchObject({
      stats: { ruleset_version: RULESET_VERSION, total_completed: 5, average_score: 60 },
    })

    const legacy = await call(repository, '/api/runs/stats?language=ja&ruleset_version=codex-2040-rules-v1')
    expect(await legacy?.json()).toMatchObject({
      stats: { ruleset_version: 'codex-2040-rules-v1', total_completed: 5, average_score: 90 },
    })
  })

  it('suppresses one-person aggregate cells even when the overall cohort has five runs', async () => {
    const repository = new MemoryRepository()
    const playIds = Array.from({ length: 5 }, (_, index) => `66666666-6666-4666-8666-${String(index + 1).padStart(12, '0')}`)
    for (const [index, playId] of playIds.entries()) {
      const started = await call(repository, '/api/runs/start', post(startBody(playId)))
      const { completion_token: completionToken } = await started!.json() as { completion_token: string }
      const body = completionBody(completionToken, 70 + index)
      await call(repository, `/api/runs/${playId}/complete`, post(index === 4
        ? { ...body, ending: 'race-future' }
        : body))
    }

    const receipt = await call(repository, `/api/runs/${playIds[4]}/receipt`)
    expect(await receipt?.json()).toMatchObject({
      aggregate: {
        total_completed: 5,
        percentile: null,
        ending_distribution: null,
        choice_2029_distribution: { 'verified-slowdown': 5 },
      },
    })
  })
})
