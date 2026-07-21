import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const gameRuns = sqliteTable('game_runs', {
  playId: text('play_id').primaryKey(),
  completionToken: text('completion_token').notNull(),
  rulesetVersion: text('ruleset_version').notNull(),
  language: text('language', { enum: ['ja', 'en'] }).notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  finalScore: integer('final_score'),
  rank: text('rank', { enum: ['S', 'A', 'B', 'C'] }),
  ending: text('ending', {
    enum: [
      'beneficial-abundance',
      'managed-transition',
      'fragile-abundance',
      'race-future',
      'regulatory-freeze',
      'safety-incident',
      'misalignment',
      'pyrrhic-monopoly',
    ],
  }),
  choice2029: text('choice_2029', {
    enum: ['race', 'slowdown', 'verified-slowdown'],
  }),
  choice2035: text('choice_2035', {
    enum: ['hold-the-line', 'accelerate'],
  }),
  activePlaySeconds: integer('active_play_seconds'),
}, (table) => [
  check('game_runs_language_check', sql`${table.language} IN ('ja', 'en')`),
  check('game_runs_final_score_check', sql`${table.finalScore} IS NULL OR ${table.finalScore} BETWEEN 0 AND 100`),
  check('game_runs_rank_check', sql`${table.rank} IS NULL OR ${table.rank} IN ('S', 'A', 'B', 'C')`),
  check('game_runs_ending_check', sql`${table.ending} IS NULL OR ${table.ending} IN ('beneficial-abundance', 'managed-transition', 'fragile-abundance', 'race-future', 'regulatory-freeze', 'safety-incident', 'misalignment', 'pyrrhic-monopoly')`),
  check('game_runs_choice_2029_check', sql`${table.choice2029} IS NULL OR ${table.choice2029} IN ('race', 'slowdown', 'verified-slowdown')`),
  check('game_runs_choice_2035_check', sql`${table.choice2035} IS NULL OR ${table.choice2035} IN ('hold-the-line', 'accelerate')`),
  check('game_runs_active_play_seconds_check', sql`${table.activePlaySeconds} IS NULL OR ${table.activePlaySeconds} BETWEEN 0 AND 21600`),
  check('game_runs_completion_check', sql`(${table.completedAt} IS NULL AND ${table.finalScore} IS NULL AND ${table.rank} IS NULL AND ${table.ending} IS NULL AND ${table.activePlaySeconds} IS NULL) OR (${table.completedAt} IS NOT NULL AND ${table.finalScore} IS NOT NULL AND ${table.rank} IS NOT NULL AND ${table.ending} IS NOT NULL AND ${table.activePlaySeconds} IS NOT NULL)`),
  index('game_runs_ruleset_completed_idx').on(table.rulesetVersion, table.completedAt),
  index('game_runs_language_completed_idx').on(table.language, table.completedAt),
  index('game_runs_ending_idx').on(table.ending),
])

export type GameRun = typeof gameRuns.$inferSelect
