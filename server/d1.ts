export const MINIMUM_COHORT_SIZE = 5
export const MINIMUM_PERCENTILE_COHORT_SIZE = 10

export type RunLanguage = 'ja' | 'en'
export type RunRank = 'S' | 'A' | 'B' | 'C'
export type RunEnding =
  | 'beneficial-abundance'
  | 'managed-transition'
  | 'fragile-abundance'
  | 'race-future'
  | 'regulatory-freeze'
  | 'safety-incident'
  | 'misalignment'
  | 'pyrrhic-monopoly'
export type RunChoice2029 = 'race' | 'slowdown' | 'verified-slowdown'
export type RunChoice2035 = 'hold-the-line' | 'accelerate'

export type RunRecord = {
  play_id: string
  completion_token: string
  ruleset_version: string
  language: RunLanguage
  started_at: string
  completed_at: string | null
  final_score: number | null
  rank: RunRank | null
  ending: RunEnding | null
  choice_2029: RunChoice2029 | null
  choice_2035: RunChoice2035 | null
  active_play_seconds: number | null
}

export type StartRunInput = Pick<
  RunRecord,
  'play_id' | 'completion_token' | 'ruleset_version' | 'language' | 'started_at'
>

export type CompleteRunInput = Pick<
  RunRecord,
  | 'completed_at'
  | 'final_score'
  | 'rank'
  | 'ending'
  | 'choice_2029'
  | 'choice_2035'
  | 'active_play_seconds'
>

export type AuthorizedCompleteRunInput = CompleteRunInput & { completion_token: string }

export type Distribution = Record<string, number>

export type RunAggregate = {
  total_completed: number | null
  percentile: number | null
  ending_distribution: Distribution | null
  choice_2029_distribution: Distribution | null
  choice_2035_distribution: Distribution | null
}

export type RunStats = {
  minimum_cohort_size: number
  ruleset_version: string
  language: RunLanguage | null
  total_started: number | null
  total_completed: number | null
  average_score: number | null
  average_active_play_seconds: number | null
  ending_distribution: Distribution | null
  choice_2029_distribution: Distribution | null
  choice_2035_distribution: Distribution | null
}

export type WriteResult =
  | { status: 'created'; run: RunRecord }
  | { status: 'duplicate'; run: RunRecord }
  | { status: 'conflict'; run: RunRecord }

export interface RunsRepository {
  start(input: StartRunInput): Promise<WriteResult>
  complete(playId: string, input: AuthorizedCompleteRunInput): Promise<WriteResult | { status: 'not_found' } | { status: 'unauthorized' }>
  get(playId: string): Promise<RunRecord | null>
  aggregateFor(run: RunRecord): Promise<RunAggregate>
  stats(language: RunLanguage | null, rulesetVersion: string): Promise<RunStats>
}

const RUN_COLUMNS = `
  play_id,
  completion_token,
  ruleset_version,
  language,
  started_at,
  completed_at,
  final_score,
  rank,
  ending,
  choice_2029,
  choice_2035,
  active_play_seconds
`

const sameStart = (run: RunRecord, input: StartRunInput) =>
  run.play_id === input.play_id
  && run.ruleset_version === input.ruleset_version
  && run.language === input.language
  && run.started_at === input.started_at

const sameCompletion = (run: RunRecord, input: CompleteRunInput) =>
  run.completed_at === input.completed_at
  && run.final_score === input.final_score
  && run.rank === input.rank
  && run.ending === input.ending
  && run.choice_2029 === input.choice_2029
  && run.choice_2035 === input.choice_2035
  && run.active_play_seconds === input.active_play_seconds

const rowsToDistribution = (rows: Array<{ value: string | null; count: number }>) => {
  const visible = rows.filter(({ count }) => count >= MINIMUM_COHORT_SIZE)
  return visible.length > 0
    ? Object.fromEntries(visible.map(({ value, count }) => [value ?? 'not_reached', count]))
    : null
}

export function createRunsRepository(db: D1Database): RunsRepository {
  const get = async (playId: string) => {
    const row = await db
      .prepare(`SELECT ${RUN_COLUMNS} FROM game_runs WHERE play_id = ?1`)
      .bind(playId)
      .first<RunRecord>()
    return row ?? null
  }

  return {
    async start(input) {
      const result = await db.prepare(`
        INSERT INTO game_runs (play_id, completion_token, ruleset_version, language, started_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(play_id) DO NOTHING
      `).bind(
        input.play_id,
        input.completion_token,
        input.ruleset_version,
        input.language,
        input.started_at,
      ).run()

      const run = await get(input.play_id)
      if (!run) throw new Error('D1 did not return the run after insertion')
      if (result.meta.changes === 1) return { status: 'created', run }
      return sameStart(run, input)
        ? { status: 'duplicate', run }
        : { status: 'conflict', run }
    },

    async complete(playId, input) {
      const result = await db.prepare(`
        UPDATE game_runs
        SET completed_at = ?2,
            final_score = ?3,
            rank = ?4,
            ending = ?5,
            choice_2029 = ?6,
            choice_2035 = ?7,
            active_play_seconds = ?8
        WHERE play_id = ?1 AND completion_token = ?9 AND completed_at IS NULL
      `).bind(
        playId,
        input.completed_at,
        input.final_score,
        input.rank,
        input.ending,
        input.choice_2029,
        input.choice_2035,
        input.active_play_seconds,
        input.completion_token,
      ).run()

      const run = await get(playId)
      if (!run) return { status: 'not_found' }
      if (run.completion_token !== input.completion_token) return { status: 'unauthorized' }
      if (result.meta.changes === 1) return { status: 'created', run }
      return sameCompletion(run, input)
        ? { status: 'duplicate', run }
        : { status: 'conflict', run }
    },

    get,

    async aggregateFor(run) {
      if (run.final_score === null) {
        return {
          total_completed: null,
          percentile: null,
          ending_distribution: null,
          choice_2029_distribution: null,
          choice_2035_distribution: null,
        }
      }

      const cohortWhere = 'completed_at IS NOT NULL AND ruleset_version = ?1 AND language = ?2'
      const [overview, endings, choices2029, choices2035] = await db.batch([
        db.prepare(`
          SELECT COUNT(*) AS total_completed,
                 ROUND(100.0 * SUM(CASE WHEN final_score <= ?3 THEN 1 ELSE 0 END) / COUNT(*)) AS percentile
          FROM game_runs
          WHERE ${cohortWhere}
        `).bind(run.ruleset_version, run.language, run.final_score),
        db.prepare(`SELECT ending AS value, COUNT(*) AS count FROM game_runs WHERE ${cohortWhere} GROUP BY ending`).bind(run.ruleset_version, run.language),
        db.prepare(`SELECT choice_2029 AS value, COUNT(*) AS count FROM game_runs WHERE ${cohortWhere} GROUP BY choice_2029`).bind(run.ruleset_version, run.language),
        db.prepare(`SELECT choice_2035 AS value, COUNT(*) AS count FROM game_runs WHERE ${cohortWhere} GROUP BY choice_2035`).bind(run.ruleset_version, run.language),
      ])

      const cohort = overview.results[0] as { total_completed: number; percentile: number }
      if (cohort.total_completed < MINIMUM_COHORT_SIZE) {
        return {
          total_completed: null,
          percentile: null,
          ending_distribution: null,
          choice_2029_distribution: null,
          choice_2035_distribution: null,
        }
      }

      return {
        total_completed: cohort.total_completed,
        percentile: cohort.total_completed >= MINIMUM_PERCENTILE_COHORT_SIZE
          ? Math.round(cohort.percentile / 10) * 10
          : null,
        ending_distribution: rowsToDistribution(endings.results as Array<{ value: string | null; count: number }>),
        choice_2029_distribution: rowsToDistribution(choices2029.results as Array<{ value: string | null; count: number }>),
        choice_2035_distribution: rowsToDistribution(choices2035.results as Array<{ value: string | null; count: number }>),
      }
    },

    async stats(language, rulesetVersion) {
      const languageClause = language ? 'AND language = ?2' : ''
      const bind = (statement: D1PreparedStatement) => language
        ? statement.bind(rulesetVersion, language)
        : statement.bind(rulesetVersion)
      const [overview, endings, choices2029, choices2035] = await db.batch([
        bind(db.prepare(`
          SELECT COUNT(*) AS total_started,
                 COUNT(completed_at) AS total_completed,
                 AVG(CASE WHEN completed_at IS NOT NULL THEN final_score END) AS average_score,
                 AVG(CASE WHEN completed_at IS NOT NULL THEN active_play_seconds END) AS average_active_play_seconds
          FROM game_runs
          WHERE ruleset_version = ?1 ${languageClause}
        `)),
        bind(db.prepare(`SELECT ending AS value, COUNT(*) AS count FROM game_runs WHERE completed_at IS NOT NULL AND ruleset_version = ?1 ${languageClause} GROUP BY ending`)),
        bind(db.prepare(`SELECT choice_2029 AS value, COUNT(*) AS count FROM game_runs WHERE completed_at IS NOT NULL AND ruleset_version = ?1 ${languageClause} GROUP BY choice_2029`)),
        bind(db.prepare(`SELECT choice_2035 AS value, COUNT(*) AS count FROM game_runs WHERE completed_at IS NOT NULL AND ruleset_version = ?1 ${languageClause} GROUP BY choice_2035`)),
      ])

      const summary = overview.results[0] as {
        total_started: number
        total_completed: number
        average_score: number | null
        average_active_play_seconds: number | null
      }
      const suppressed = summary.total_completed < MINIMUM_COHORT_SIZE

      return {
        minimum_cohort_size: MINIMUM_COHORT_SIZE,
        ruleset_version: rulesetVersion,
        language,
        total_started: suppressed ? null : summary.total_started,
        total_completed: suppressed ? null : summary.total_completed,
        average_score: suppressed || summary.average_score === null ? null : Math.round(summary.average_score * 10) / 10,
        average_active_play_seconds: suppressed || summary.average_active_play_seconds === null
          ? null
          : Math.round(summary.average_active_play_seconds),
        ending_distribution: suppressed ? null : rowsToDistribution(endings.results as Array<{ value: string | null; count: number }>),
        choice_2029_distribution: suppressed ? null : rowsToDistribution(choices2029.results as Array<{ value: string | null; count: number }>),
        choice_2035_distribution: suppressed ? null : rowsToDistribution(choices2035.results as Array<{ value: string | null; count: number }>),
      }
    },
  }
}
