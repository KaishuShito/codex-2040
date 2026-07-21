# GOAL — Codex 2040 AGI Pill Mode

Status: complete; implementation, independent verification, evidence packet, atomic commits, and branch-only push are complete
Baseline: `b583df1c5484efb7a9c74a3ee83d54b4a907772b` (`codex/sites-d1`)  
Primary verifier: independent real-browser E2E for Standard and AGI Pill modes

## Outcome

Ship a reviewable, bilingual AGI Pill mode beside the unchanged Standard mode. A new player can explicitly choose either mode, save and resume it independently, understand the causes of growth and failure, reach distinct recoverable or terminal futures, and continue beyond the first Dyson-swarm milestone into solar-system-scale governance. Standard saves, deterministic behavior, D1 payloads, and the existing control-room experience remain compatible.

## Grounding

### Observed facts

- The baseline is a deterministic React/Vite simulation whose authoritative state transition lives in `src/engine.ts`.
- Standard currently persists a versioned local session through `src/session.ts`; existing D1 run storage has no mode discriminator.
- Standard has normal/fast time, world news and critical pauses, strategy nodes, rival pressure, endings, audio, Japanese UI, and 235 passing tests at the start of this branch.
- The supplied 786-line article and appendices are a valuable scenario synthesis, not a primary source. Its 1–3, 3–5, and 5–10 year sequence and rapid off-world schedules are conditional scenarios.
- Primary-source mapping and caveats are recorded in `docs/agi-pill/research-and-sources.md`.

### User requirements

- Provide an explicit Standard / AGI Pill selector and keep Standard behavior, saves, and D1 compatibility intact.
- Make AGI Pill quantitatively grounded but deliberately more extreme: technical and industrial explosions mutually accelerate under legible constraints.
- Couple intelligence, compute, energy, robot/industrial capacity, accessible resources, safety/control, governance, social friction, and rival or branch civilizations.
- Provide readable causal failures and recovery actions for explosive success, stalls, capture, accidents, and misalignment; avoid an automatic exponential clicker or a single dominant policy.
- Treat the first Dyson swarm as a scale transition, not an ending. Show Earth → orbit → solar-system expansion and later branch-civilization problems.
- Complete English and Japanese UI, saves/resume, speed, news, events, strategy tree, rivals, result views, sound, desktop, and minimum landscape-mobile behavior.
- Separate the supplied article, primary sources, and game inference in an in-game source route. Do not turn named people or dates into asserted forecasts.
- Work only on `codex/agi-pill-mode`; create atomic commits and push it. Do not merge, deploy, migrate production D1, or create a PR without separate approval.

### Inferred design choices

- AGI Pill is a separate deterministic ruleset and state envelope, not a coefficient toggle inside Standard.
- Era changes are state-gated, with the article's year ranges shown only as scenario priors.
- Robot replication requires an autonomous industrial ecology (closure across mining, refining, parts, assembly, maintenance, logistics, and energy), not literal robot cloning.
- Super-exponential behavior emerges from coupled efficiency and capacity loops with saturation, bottleneck floors, latency, heat, defects, and governance constraints.
- A game-native catastrophic-risk band replaces personality-linked p(doom) numbers and exposes its causal drivers.
- The first stellar-capture milestone unlocks new allocation, latency, rights, congestion, and branch-civilization decisions.

## Constraints and non-goals

- The deterministic engine remains the sole numerical authority; no LLM or UI component may silently change state.
- Do not weaken or remove Standard tests, narrow Standard behavior, forge playtest distributions, tune only to a fixed acceptance threshold, substitute mocks for browser E2E, or hide failures.
- Do not add a D1 production migration. Persist mode-specific data in a backward-compatible envelope or an existing extensible field.
- Do not present speculative schedules as facts, use named-person p(doom comparisons, or imply that physical possibility establishes likelihood.
- Do not merge to main, deploy, create a PR, or modify an existing public Sites version.

## Success criteria

1. New game explicitly selects Standard or AGI Pill; mode identity remains visible and survives reload.
2. A legacy Standard save loads as Standard, a new Standard save round-trips without semantic change, and AGI Pill saves cannot be mistaken for Standard.
3. Standard independently completes a real-browser run with start, speed change, save/reload, critical decision, news, and ending; its existing deterministic tests and D1 contract pass.
4. AGI Pill independently completes real-browser runs in Japanese and English with start, speed change, save/reload, event choice, strategy purchase, recoverable setback, scale transition, and ending/result.
5. AGI Pill visibly couples all required stocks. Every stall, loss, and major risk movement names its causal drivers and at least one available countermeasure unless the run crossed an explicitly warned terminal boundary.
6. Dyson-swarm construction is non-terminal and reveals a further playable solar-system layer with branch-civilization or light-speed governance pressure.
7. Multiple deterministic human-like policy batches cover at least balanced, passive, over-acceleration, safety-first, governance-first, and industry-first play. Evidence shows diverse outcomes, no passive automatic win, no universal single action, and at least one recovery from a serious non-terminal setback.
8. Source UI distinguishes primary analysis/data, secondary/reference synthesis, and game inference, with bilingual caveats and direct links.
9. `npm run check`, the complete test suite, and production build pass from a clean working tree. Desktop and landscape-mobile browser checks produce screenshots/logs.
10. `RESULT.md` records exact commands, counts, browser paths, screenshots, remaining risks, atomic commit SHAs, push state, and independent-audit findings.

## Feedback loop

Inspect the strongest current failure; change one coherent mechanic or integration surface; run its focused tests; run policy simulations when balance is affected; replay the relevant browser path; record evidence and the next action in `WORKLOG.md`. At integration checkpoints run the full Standard suite. Before completion run clean full checks, both browser journeys, the fresh-context audit, and the final Cockpit review.

## Review pressure

- Ten bounded native Codex lanes produce non-overlapping research, design, implementation, simulation, compatibility, and audit artifacts; the lead owns integration and all final claims.
- Cockpit Claude Code performs three read-only critiques: (A) research/worldbuilding/game-loop blind spots, (B) mid-implementation design/UI/balance, and (C) final independent hostile review. Each recommendation receives an adopt/reject rationale in `WORKLOG.md`.
- The independent E2E lane re-enters with fresh context immediately before completion and may not edit product code.

## Blocker standard

Difficulty, long runtime, flaky first attempts, or an unfinished lane are not blockers. Mark the goal blocked only after the same genuine external condition prevents meaningful progress for the required consecutive goal turns, with reproduced evidence and the smallest user or external action needed. Preserve partial artifacts and the exact next safe action.

## Completion proof

Completion requires integrated implementation, full green checks, clean-state real-browser evidence for both modes, bilingual desktop and landscape-mobile screenshots, policy-batch artifacts, Cockpit A/B/C disposition notes, a fresh-context audit, `RESULT.md`, atomic commits, and a successful push of `codex/agi-pill-mode`. No required item may be replaced by an assertion from the implementing agent.
