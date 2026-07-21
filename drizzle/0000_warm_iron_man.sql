CREATE TABLE `game_runs` (
	`play_id` text PRIMARY KEY NOT NULL,
	`completion_token` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`language` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`final_score` integer,
	`rank` text,
	`ending` text,
	`choice_2029` text,
	`choice_2035` text,
	`active_play_seconds` integer,
	CONSTRAINT "game_runs_language_check" CHECK("game_runs"."language" IN ('ja', 'en')),
	CONSTRAINT "game_runs_final_score_check" CHECK("game_runs"."final_score" IS NULL OR "game_runs"."final_score" BETWEEN 0 AND 100),
	CONSTRAINT "game_runs_rank_check" CHECK("game_runs"."rank" IS NULL OR "game_runs"."rank" IN ('S', 'A', 'B', 'C')),
	CONSTRAINT "game_runs_ending_check" CHECK("game_runs"."ending" IS NULL OR "game_runs"."ending" IN ('beneficial-abundance', 'managed-transition', 'fragile-abundance', 'race-future', 'regulatory-freeze', 'safety-incident', 'misalignment', 'pyrrhic-monopoly')),
	CONSTRAINT "game_runs_choice_2029_check" CHECK("game_runs"."choice_2029" IS NULL OR "game_runs"."choice_2029" IN ('race', 'slowdown', 'verified-slowdown')),
	CONSTRAINT "game_runs_choice_2035_check" CHECK("game_runs"."choice_2035" IS NULL OR "game_runs"."choice_2035" IN ('hold-the-line', 'accelerate')),
	CONSTRAINT "game_runs_active_play_seconds_check" CHECK("game_runs"."active_play_seconds" IS NULL OR "game_runs"."active_play_seconds" BETWEEN 0 AND 21600),
	CONSTRAINT "game_runs_completion_check" CHECK(("game_runs"."completed_at" IS NULL AND "game_runs"."final_score" IS NULL AND "game_runs"."rank" IS NULL AND "game_runs"."ending" IS NULL AND "game_runs"."active_play_seconds" IS NULL) OR ("game_runs"."completed_at" IS NOT NULL AND "game_runs"."final_score" IS NOT NULL AND "game_runs"."rank" IS NOT NULL AND "game_runs"."ending" IS NOT NULL AND "game_runs"."active_play_seconds" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `game_runs_ruleset_completed_idx` ON `game_runs` (`ruleset_version`,`completed_at`);--> statement-breakpoint
CREATE INDEX `game_runs_language_completed_idx` ON `game_runs` (`language`,`completed_at`);--> statement-breakpoint
CREATE INDEX `game_runs_ending_idx` ON `game_runs` (`ending`);