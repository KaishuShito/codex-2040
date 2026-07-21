# AGI Pill independent browser audit

Owner: Lane 10 (fresh-context E2E / red team)  
Baseline commit: `b583df1c5484efb7a9c74a3ee83d54b4a907772b`  
Audit target: `codex/agi-pill-mode`  
Status: baseline recorded; final implementation audit not yet run

## Independence and pass rule

This file defines an acceptance audit, not an implementation plan. The auditor must start from a clean browser context and treat the running UI as the primary verifier. Unit tests, simulations, DOM snapshots, build output, and source inspection support the verdict but cannot replace real browser runs.

Overall PASS requires all of the following:

- one independent Standard run and one independent AGI Pill run, each created through the visible mode selector;
- visible proof of start, interaction, save/reload, speed restoration, news/event handling, a consequential decision, and an ending for each mode;
- both Japanese and English runs, desktop and landscape-mobile checks;
- clean `npm run check`, the complete test suite, production build, and humanized worldline suite;
- no regression of legacy Standard/D1 session behavior;
- evidence paths that another reviewer can open without trusting the implementer summary.

Any required item marked FAIL or NOT RUN makes the audit FAIL. A mocked browser, direct state injection, unit-test-only ending, or a simulation whose thresholds were tuned to its fixtures is not acceptable evidence.

## Baseline: observed facts

The following facts were observed against a temporary, clean checkout of the baseline commit on `http://127.0.0.1:5179/` on 2026-07-21. They are not assumptions about the in-progress branch.

- Startup opens a Japanese role/tutorial dialog over the control-room map. The visible actions are `説明から始める` and `説明をスキップ`; there is no mode selector in the baseline.
- Starting a run exposes the world map, region action, Model/Product/Company strategy controls, ecosystem/strategy-tree controls, news history, rival telemetry, TIBO reset, pause, normal speed, and fast speed.
- A real visible action (`東アジア` community event) followed by Fast advanced the date from `2026-01-01` to `2026-01-25` and added visible history.
- Reload restored the progressed game without reopening the tutorial, retained Fast, and continued from the saved timeline (visible date `2026-03-22` when inspected after reload).
- `新しいゲーム` opens a destructive custom confirmation (`2026年から始めますか？`) describing overwrite of the current timeline/autosave. The simulation is blocked while this dialog is open according to `App.tsx`'s `simulationBlocked` predicate.
- The UI baseline is Japanese-first. English strings exist in voice and ending presentation, but there is no visible whole-game language selector in the baseline.
- Persistence uses `codex-2040:session:v2` with fallback decoding for `codex-2040:session:v1`; malformed/stale session behavior has unit coverage.
- Critical news, pending world events, tutorial, decisions, upgrade overlay, pause, restart confirmation, and terminal state are intended to block time. Critical acknowledgement promises restoration to the selected Normal/Fast speed.

Supporting baseline commands:

```sh
git archive b583df1c5484efb7a9c74a3ee83d54b4a907772b | tar -x -C <temporary-directory>
npm ci
npm run dev -- --host 127.0.0.1 --port 5179
```

## User requirements translated into falsifiable checks

### A. Entry, mode identity, and reset

- [ ] A1. A clean New Game flow visibly offers exactly Standard and AGI Pill before the run begins, in both JA and EN.
- [ ] A2. The selector explains the modes without presenting AGI Pill as a hidden debug/demo toggle.
- [ ] A3. Starting Standard produces the established 2026 control-room/world-map experience and no Pill-only meters, rules, copy, or events.
- [ ] A4. Starting AGI Pill visibly identifies the mode and exposes its distinct interacting systems; a recolor or multiplier-only fork fails.
- [ ] A5. New Game clearly warns that the current save will be replaced and requires an explicit confirm/cancel path.
- [ ] A6. Cancelling reset preserves the exact active run and selected mode. Confirming reset returns to mode selection, not silently to a default.

### B. Save, reload, and D1/legacy compatibility

- [ ] B1. Standard: take a visible action, advance time, record date/resources/history, reload, and prove the same mode and state return.
- [ ] B2. AGI Pill: take a visible action affecting at least two coupled systems, record state, reload, and prove mode, timeline, decisions, spatial stage, and speed return.
- [ ] B3. A baseline v2 Standard save loads as Standard with no conversion loss and can continue/save/reload again.
- [ ] B4. A supported v1 fixture follows the documented migration path; malformed or future-version payloads fail safely without corrupting the next New Game.
- [ ] B5. Switching from one mode to a new run cannot leak event queues, upgrades, news, rivals, language, ending flags, or Pill spatial-stage state into the other.
- [ ] B6. Any D1 telemetry/run payload retains the existing Standard contract. New mode fields are additive/versioned, never a destructive production migration.

### C. Time, pause, news, decisions, and ending

- [ ] C1. Each mode independently proves Pause freezes the visible date for at least 3 real seconds.
- [ ] C2. Each mode independently proves Normal advances at approximately 1 day/second and Fast at approximately 8 days/second over a bounded sample.
- [ ] C3. A critical event reached while Fast is selected freezes the date; reading/acknowledging it resumes Fast rather than silently changing to Normal.
- [ ] C4. Ticker/noncritical news does not pause and its visible cause/effect matches the numerical change.
- [ ] C5. Required decisions block progression until a choice is made. At least two different options produce visibly different downstream state/news, not only different ending copy.
- [ ] C6. Standard independently reaches an ending via visible play and shows score/rank, causal recap, major choices, rival/competition outcome, and sources.
- [ ] C7. AGI Pill independently reaches at least one success and one failure/partial ending via visible play. Direct state injection, test-only time travel, or mocked endings do not count.
- [ ] C8. Reaching a Dyson swarm is not terminal and does not use end-screen language; post-Dyson play exposes further constraints, decisions, and observable spatial expansion.

### D. AGI Pill system integrity and causal legibility

- [ ] D1. Intelligence/compute, energy, robot production, resources, safety, governance, social friction, and rivals/branch civilizations are all visible and mechanically active.
- [ ] D2. At least three feedback loops are demonstrated in the UI (for example intelligence→automation→production, production→energy/resource demand, and safety/governance→trust/coordination→deployment).
- [ ] D3. A bottleneck stops or bends growth despite high capability; the player receives a readable cause and at least one recoverable action.
- [ ] D4. Over-acceleration can cause appropriation, accident, or misalignment through a traceable warning chain; it is not an unexplained random instant death.
- [ ] D5. Safety-first play can recover and progress but is not a guaranteed no-cost win. Delay exposes rival, social, or opportunity costs.
- [ ] D6. Passive play has a credible loss/stagnation path; it does not auto-win or become permanently actionless due to unavoidable resource exhaustion.
- [ ] D7. A rival or branch civilization makes strategically meaningful moves and the UI explains its pressure and available counterplay.
- [ ] D8. Earth→orbit→solar-system scale changes are visually unmistakable while retaining the control-room design language and usable controls.
- [ ] D9. The 1–3, 3–5, and 5–10 year horizons are expressed as scenario ranges/branches, not asserted predictions. Takeoff speed, p(doom), and physical limits are framed as model assumptions with source/inference labels.

### E. Humanized worldline matrix

Run with different seeds where supported. Preserve raw logs and final state summaries. At minimum:

| ID | Mode | Strategy | Expected audit property |
|---|---|---|---|
| S-IDLE | Standard | no actions except required acknowledgements | credible rival/passive loss; no crash or unexplained death |
| S-BAL | Standard | balanced access/safety/governance | recoverable path to a coherent ending |
| P-IDLE | Pill | passive | stagnation/loss with readable bottlenecks and remaining possible actions |
| P-RUSH | Pill | maximize takeoff/production | explosive gains plus warning chain and nontrivial accident/misalignment risk |
| P-SAFE | Pill | safety/governance first | slower takeoff, rival/opportunity pressure, eventual recovery path |
| P-RESOURCE | Pill | robots/energy/resources first | physical bottlenecks move rather than disappear; no automatic optimal script |
| P-OPEN | Pill | cooperation/open ecosystem | coordination benefits plus friction/appropriation tradeoffs |
| P-RIVAL | Pill | react to rival/branch civilization | at least two viable responses with different consequences |
| P-POSTDYSON | Pill | continue past Dyson swarm | meaningful post-Dyson decisions and a later ending |
| P-RECOVERY | Pill | deliberately trigger a severe warning then recover | recovery is possible before terminal threshold and causally explained |

Matrix pass conditions:

- no single repeated action dominates all non-passive Pill strategies;
- at least three distinct viable strategic profiles reach nonterminal late play;
- passive, rush, and safe runs do not converge to identical histories/endings;
- no run enters a state with no affordable/available recovery action unless it is an explicitly explained terminal outcome;
- event/ending distributions are reported honestly, including failures and outliers.

### F. JA/EN, sources, audio, and presentation

- [ ] F1. Complete JA and EN entry, HUD, tooltips, news, critical events, decisions, strategy tree, rivals, post-Dyson screens, endings, and reset/save copy.
- [ ] F2. Changing language never changes numerical state, seed outcome, mode, speed, or save compatibility.
- [ ] F3. Source links distinguish primary sources, the provided reference memo, and game-design inference. Proper names/dates are not presented as certainty without support.
- [ ] F4. Source links are keyboard reachable, have meaningful labels, and open the claimed relevant source.
- [ ] F5. Audio on/off and BGM state remain usable in both modes; critical/scale-transition cues do not become required to understand state.

### G. Desktop, landscape mobile, and accessibility minimum

- [ ] G1. Representative desktop (recommended evidence: 1440×900) shows mode identity, date/speed, primary resources, map/space view, action controls, and alerts without overlap.
- [ ] G2. Landscape mobile (recommended evidence: 844×390) permits mode selection, progression, critical acknowledgement, decision choice, strategy interaction, and ending review without clipped unreachable controls.
- [ ] G3. Keyboard-only path can select mode, start, pause/change speed, acknowledge critical events, choose decisions, and restart.
- [ ] G4. Visible focus, accessible names, pressed/selected state, progress semantics, color-independent warnings, and reduced-motion behavior are checked.

## Required final evidence bundle

Store evidence under a stable branch path (recommended `artifacts/agi-pill-audit/<timestamp>/`) and reference exact paths from `RESULT.md` and this file.

- `environment.txt`: commit SHA, dirty status, Node/npm versions, browser/version, viewport, start command, locale/timezone.
- `check.log`, `tests.log`, `build.log`, and worldline logs with exit codes and uncensored failures.
- separate timestamped browser trace/log for `standard-ja`, `standard-en`, `pill-ja`, and `pill-en`.
- before-action, before-reload, after-reload, critical-event, major-decision, ending, and post-Dyson screenshots where applicable.
- desktop and landscape-mobile screenshots for both modes and both languages.
- console error/warning capture for each independent run.
- a concise state-delta ledger: action → immediate numerical/UI changes → later consequence → available countermeasure.
- final table mapping every checklist ID above to PASS/FAIL, artifact path, and one-sentence observation.

Screenshots must show enough surrounding UI to establish mode/date/state; cropped decorative images alone are insufficient. Logs must come from the tested commit. If the branch changes after evidence capture, rerun affected checks.

## Initial red-team risks

1. **Compatibility ambiguity:** mode is not present in the baseline session schema. Defaulting absent mode to Standard and versioning Pill-only state must be proven with a real legacy fixture, not only TypeScript defaults.
2. **Aesthetic masquerading as a mode:** a dramatic dashboard can conceal a shared multiplier-only engine. D1–D7 require coupled state changes, bottlenecks, rivals, causality, and recovery.
3. **Dyson false finish:** a cinematic unlock can still behave as an ending if controls disappear, goals stop, or growth becomes automatic. C8/P-POSTDYSON explicitly forbid this.
4. **Resume-speed regressions:** baseline intentionally restores Normal/Fast after critical overlays. New mode selection, spatial transitions, and Pill events add more pause paths that can accidentally reset or double-run timers.
5. **Cross-mode save leakage:** a single autosave key can silently deserialize Pill state into Standard or vice versa. New Game, legacy load, and mode-switch clean state need adversarial proof.
6. **Translation as partial veneer:** the baseline is Japanese-first; English-only ending/voice fragments are not whole-product i18n. Every interactive and causal surface must be audited.
7. **Simulation self-fulfilling tests:** fixed strategy bots and thresholds can be co-tuned until tests pass. Preserve unseen/fresh seeds and at least one manual browser play for rush, safe, passive, and post-Dyson paths.
8. **Unreachable browser ending:** unit tests may prove terminal math while the real UI takes impractical hours or deadlocks behind resources/events. C6/C7 require visible-play endings.
9. **Mobile hidden-state failure:** responsive CSS can hide the speed readout or critical context while leaving buttons technically present. Landscape mobile must prove comprehension and interaction, not only lack of horizontal scroll.
10. **Source laundering:** citing the supplied memo as if it were a primary source would make quantitative drama look authoritative. Source class and inference labels must be visible in-game.

## Final audit section (reserved)

Final product verdict: **PASS**  
Tested implementation HEAD: `9f41a7c13c967471fcfb03c540233db76c5b8bb4` (including mobile fix `8370965`)  
Final re-audit date: 2026-07-21 JST

No P0, P1, or P2 product finding remains from the fresh-context audit.

- Standard English now receives a typed locale through the full runtime. Initial and deterministic action news are translated by exact or typed-pattern lookup; all 100 authored world events and their combos are exhaustively checked for English headline/cause/flavor/combo copy. Unknown external or generated Japanese copy uses an explicit English source-language fallback instead of invented translation.
- AGI Pill warnings are player decision boundaries. A newly visible warning automatically pauses even after 8x play; browser evidence held the date fixed for three seconds and showed the three executable recovery policies.
- Standard ending review now switches to a two-column market grid at the required 844x391 and 865x400 landscape sizes. Browser measurements reported `scrollWidth === clientWidth`, and all four market cards were visible.
- Independent `npm run check` passed: 41 test files / 296 tests, TypeScript, client production build, and Worker build. The only build note is the pre-existing non-fatal chunk-size warning.
- Existing evidence also supports independent Standard and Pill starts, save/reload and speed restoration, bilingual Pill outcomes, causal events/recoveries, Dyson as a nonterminal transition, post-Dyson play, synthetic policy diversity, and desktop/mobile result views.

Active-goal disposition: the implementation and product verification portions satisfy `GOAL.md`. The parent lead intentionally included the test-only fallback regression as atomic commit `b8bba6e`. The remaining packaging gates are the durable goal/evidence commit, clean frozen-HEAD check, and push of `codex/agi-pill-mode`; they are not product defects.
