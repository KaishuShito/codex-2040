# WORKLOG — AGI Pill Mode

## 2026-07-21 — Activation setup

- Confirmed clean detached baseline `b583df1c5484efb7a9c74a3ee83d54b4a907772b` and created `codex/agi-pill-mode`.
- Read `/Users/kai/.codex/skills/ultragoal/SKILL.md` in full and applied Activate mode. No child goals and no token budget.
- Inspected `SPEC.md`, `package.json`, the source/test tree, `src/App.tsx`, `src/engine.ts` exports, and `src/session.ts` compatibility behavior.
- Read the supplied 786-line reference including the takeoff, p(doom), AGI-timeline, pre-AGI, and physical-limit appendices. Embedded images were excluded from textual inspection; all prose and references were retained.
- Baseline/current checkpoint: `npm test` → 32 files, 235 tests passed.
- Started 10 native Codex lanes with non-overlapping ownership: sources, game design, engine, events, upgrades, UI/space, i18n/sources, session compatibility, policy simulation, and independent E2E/red-team.
- Cockpit A first attempt requested explicit maximum effort, but Claude terminal mode rejects CLI model/effort overrides. Re-issued on the configured Claude Code default; task `8b6d622e` is running. No repository edits are authorized for that review.

## Red-team before activation

- **Fake success by test weakening:** prohibited; full existing Standard suite and browser journey remain mandatory.
- **Fake E2E through mocks:** prohibited; real browser starts from a new game and covers save/reload through endings independently for both modes.
- **Words satisfied but experience missed:** success requires visible coupled causality, recovery actions, multiple policy outcomes, and post-Dyson play—not merely a mode flag or faster numbers.
- **Speculation presented as evidence:** source tiers, caveats, and conditional era labels are acceptance criteria; named p(doom values are excluded.
- **Compatibility hidden by parallel state:** legacy/new Standard round-trips and unchanged D1 contract are explicit verifier cases.
- **Public or irreversible overreach:** merge, deploy, production migration, and PR creation remain approval-gated; only the named branch may be pushed.
- **Self-review bias:** Cockpit A/B/C and a fresh-context non-editing E2E audit are required before completion.
- **Bad recovery loop:** every failed focused verifier feeds one scoped change, rerun, and logged next action; difficulty is not a blocker.

## Review decisions

### Cockpit A — completed

Task: `8b6d622e`, Claude Code terminal runtime, effective Fable 5 / high effort, read-only.

- **Adopted:** add a normative Pill supplement; `docs/agi-pill/spec.md` now binds determinism, bounded-log state, state-gated eras, independent saves, recoverable warnings, post-Dyson play, and browser acceptance.
- **Adopted:** physically separate saves. Standard retains its v2/v1 keys; Pill uses `codex-2040:agi-pill-session:v1`. The Standard wrapper never writes the Pill key.
- **Adopted:** relabel 0–100 Dyson UI as progress to the **first swarm ignition threshold**, not completion of stellar capture.
- **Adopted:** make era names primary and year ranges explicitly “typical scenario ranges”; the engine already requires state gates in addition to minimum elapsed time.
- **Adopted:** define the player as a Civilization Transition Council and rivals as actors that can become branch civilizations.
- **Already satisfied:** engine stocks use bounded log-capacity indices and physical caps; no raw astronomical integer growth is stored.
- **Adopted:** tighten the batch harness: three distinct policy signatures, dominant shared-seed best-score share below 60%, capture/stagnation included in opaque-loss checks, and low recovery is a failure rather than a warning.
- **Adopted:** add Davidson/Houlden, Epoch algorithmic-progress, and NASA solar/communications entries, plus source caveats and variable links. Change p(doom-facing copy to “catastrophic risk band.”
- **Rejected as an implementation direction:** era-dependent tick units. A fixed one-day deterministic tick is easier to replay and already numerically safe because stocks are bounded logs; only rendering cadence changes.
- **Deferred with reason:** preserving stale pre-release Pill states as archives. This branch has no released Pill save population. Fail-closed ruleset decoding is retained; a future ruleset change must add a migration/archive UI before release.

### Cockpit B — completed

Task: `c79fd555`, Claude Code terminal runtime, effective Fable 5 / high effort, read-only.

- **Adopted (P0):** fixed-date events were not allowed to substitute for causality. `isAgiPillEventEligible` now combines an authored earliest-era gate, a pacing floor, state predicates, and flags. Late-emerging causes remain eligible instead of silently expiring. Browser proof observed no event at T+1 while predicates were false, then authored events after the capability/industry state became true.
- **Adopted (P0):** recovery copy needed an executable path. Chosen options now persist a bounded recovery window; the dashboard exposes the trigger, action, days remaining, and an actual countermeasure applying the authored effects. The final browser run executed multiple event recoveries.
- **Adopted (P0):** `rivalPressure` catalog deltas no longer become raw `1 + value` multipliers. Bounded pressure deltas preserve non-zero rivals and retain capture pressure; focused tests cover positive and negative effects.
- **Adopted (P0):** rescaled early event costs so normal safe choices cannot zero the canonical compute/energy base. Added resource-recovery black start for a legitimately exhausted run, with a zero-stock regression fixture and real-browser recovery proof.
- **Adopted (P0):** replaced misleading/no-op upgrade multipliers with engine-observable stock/tradeoff effects, prevented pre-Dyson post-expansion preload, and cross-validated all 45 program sources/effects.
- **Adopted (P0):** the canonical harness now executes the same eligible authored events, option effects, recovery flags, affordability, visible first-12 program rule, DAG prerequisites, and upgrade costs as the UI. Final batch: 168 executions / 84 unique worldlines, 10 events / 15 option branches / 720 choices, 18 programs / 932 purchases, zero missed eligible events.
- **Adopted (P1):** warning countdowns now directly gate terminal loss; industrial accident has a reachable fixture and recovery policies receive a responsive risk path.
- **Adopted (P1):** added an explicit T+10 scenario-horizon review that pauses, explains the forecast boundary, and lets play continue beyond Dyson. Every non-active outcome, including stagnation, now pauses and is visible in the localized result modal.
- **Adopted (P1):** connected era-first labels, localized cause/rival/posture/headroom/outcome copy, unified source tier taxonomy, alias-aware source registry, and event/program source buttons. Japanese and English browser runs were both exercised.
- **Adopted (P1):** Pill saves now persist speed and pause state with backward-compatible defaults; due state events correctly re-pause after reload. Standard save and D1 contracts remain unchanged.
- **Adopted (P2):** added an Earth-only industrial loop and rival-pressure overlay, clarified robots as a bounded index, and strengthened landscape-mobile layout.
- **Rejected as literal units:** interpreting the 0–100 robot stock as `10^index` robots. The normative model is a bounded log-capacity index spanning multiple capability/industrial components, not a literal unit counter; UI copy now calls this out instead of implying `10^80` machines.
- **Deferred as non-blocking presentation work:** rendering all 45 strategy nodes simultaneously. The runtime deliberately shows the currently actionable prerequisite frontier (up to 12) while the 45-node catalog, reachability, source, and effect contracts are fully tested. A future graph browser may expose locked descendants without changing mechanics.

### Cockpit C — P1 repair pass (`8e2de892`)

- **No P0. Adopted P1 countdown finding:** resource-lock expiry now produces the announced stagnation result and industrial-cascade expiry produces the announced accident instead of leaving a permanent `0 DAYS` warning. Added a regression covering both 70–99 debt cascade and resource-lock expiry. Recovery tests now act inside the actual visible window.
- **Adopted P1 reachability finding:** increased the extreme-risk physical-incident hazard so it competes with misalignment, moved fast-takeoff crisis pacing/conditions into reachable bounded-index ranges, and added the 12-year no-expansion stagnation result. The regenerated 168-run batch organically reaches 14 accidents and 24 stagnations, and now executes all 13 events / 21 options.
- **Adopted P1 evidence finding:** completed `RESULT.md` and added a visually inspected Japanese AGI Pill post-Dyson ending screenshot with run seed. Atomic commits, push, and fresh-context audit remain sequenced after the same-session C re-review.
- **Adopted P2 fail-closed finding:** malformed policy, phase, outcome, warning kind, and warning recovery policies are rejected during save decode; regression cases cover malicious enum strings.
- **Adopted P2 parity finding in the highest-drift location:** event pacing floors are now exported from the authored catalog and consumed by both UI and batch harness.
- **Adopted P2 branding finding:** all user-facing/documentation `Tibo` spellings were normalized to uppercase `TIBO`; the idiomatic TypeScript factory identifier `createTiboRealtimeAgent` remains PascalCase and is not player-facing branding.
- **Adopted P2 milestone finding:** the dashboard marks the first canonical incomplete milestone active rather than assuming milestone array length equals canonical progress.
- **Not treated as a live defect:** the event scheduler's eligibility type excludes `post-dyson`, and both production/harness callers guard that phase before invocation. The guard and type are explicit rather than relying on a `NaN` comparison.

### Cockpit C — same-session re-review

- Re-ran the hostile read-only review after the three P1 repairs. Verdict: **ship-ready; P0 none; P1 none**.
- **Adopted from remaining P2s:** fail-closed warning numeric validation, explicit phase-hole handling, a complete evidence index, and clean staging of the durable goal packet.
- **Accepted as residual P2:** some upgrade cost/affordability logic remains duplicated between the UI and batch harness. Catalog cross-validation and full tests mitigate current drift; consolidating this logic is a follow-up, not a release blocker.

## Lead-browser post-fix replay

- Restored the independent Standard 2040 ending through the visible selector in English after `e26a149`; verified the English governed-takeoff shell, score/ending, competition ranking, decision review, sources, controls, and TIBO protocol. Captured desktop and 865×400 landscape evidence.
- Started a new Pill run through visible UI only, selected 8x and Overclock, and reached `CRITICAL WINDOW / Control deficit / RECOVERABLE` at T+4Y 324D. The date was unchanged after three real seconds and the UI offered three executable countermeasures. Captured `agi-pill-warning-auto-pause-en.png`.
- `npm run check` on committed implementation HEAD: 41 files / 293 tests, TypeScript, client production build, and Worker production build passed.
- Formal naming audit: requested legacy search returned zero; focused TIBO/voice suites passed 4 files / 34 tests.

## Fresh-context audit repair cycle

- The first final audit accepted the Pill warning pause and Standard English shell, but correctly kept the goal open for two P1s: authored Standard news/events still rendered Japanese source strings, and the 865×400 Standard ending clipped its fourth market card and explanatory copy.
- **Fixed dynamic Standard English (`9f41a7c`):** all 100 authored world events and every combo now resolve non-Japanese English headline/cause/flavor/combo copy from stable IDs. Initial, milestone, incident, extinction, action, region, upgrade, strategy, rival, feature, and decision news use exact or typed-pattern translation. Unknown source-language GM/player/rival payloads are not invented; English UI displays an explicit source-language-only notice. Japanese mode returns the original text unchanged.
- **Fixed compact landscape (`8370965`):** added an ending-only 721–900px / landscape / ≤520px layout. Market cards become a 2×2 grid; market explanation, decision recap, receipt, footer, and controls wrap without changing desktop or the existing ≤720px phone layout.
- **Lead browser confirmation:** English latest intel was `Youth protest agent walkout`; no Japanese headline remained in the visible DOM. Actual CSS viewports 865×400 and 844×391 activated the compact rules, showed all four market actors, and had no page horizontal overflow.
- Combined implementation HEAD: `npm run check` passed 41 files / 296 tests, TypeScript, client production build, and Worker production build.

## Current next action

- Fresh-context final re-audit returned PASS at `9f41a7c`: P0/P1/P2 product findings all zero; independent `npm run check` passed 41 files / 296 tests and both production builds.
- Intentionally adopted the auditor's test-only delta as atomic commit `b8bba6e`; it verifies unknown player/rival/external English fallbacks and English-source passthrough without changing production behavior.

Commit the durable goal packet/evidence, rerun the frozen-HEAD gate, push only `codex/agi-pill-mode`, then complete the active parent goal.
