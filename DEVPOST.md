# Devpost Draft — Codex 2040

## Title

Codex 2040

## Tagline

Play the tradeoffs shaping AI's future: access, capability, safety, governance, and competition.

## Category

**Education**

## Official Submission Frame

The official review snapshot sets the deadline at **July 22, 2026, 09:00 JST**. Submissions are judged equally on **Technological Implementation**, **Design**, **Potential Impact**, and **Quality of the Idea**. The entry needs an English description, a working project, a repository that satisfies the access/license rules, a public or unlisted YouTube demo under three minutes with audio, a clear account of how Codex and GPT-5.6 were used, real `/feedback` session IDs, and a final **Submitted** state. Recheck the [Build Week page](https://openai.devpost.com/) and [official rules](https://openai.devpost.com/rules) immediately before submission.

## The Problem

AI future scenarios are difficult to learn from passively. A reader has to hold many coupled systems in their head at once: capability growth, public access, safety work, regulation, trust, organizational capacity, and market concentration. That makes the central lesson easy to miss: maximizing one number is not the same as creating a good future.

## The Solution

Codex 2040 turns those tradeoffs into a playable educational simulation. Players spread useful AI across a world map, invest limited Compute, ship features, and balance capability against safety and governance. They are rewarded for broad access and strong performance, but also for preserving trust and meaningful competition. Deliberately opening the ecosystem can be better than winning a monopoly.

The experience uses the Codex app as the classroom: the Codex 2040 Advisor discusses tradeoffs on the left while the deterministic simulation runs in the in-app browser on the right. A four-step tutorial introduces one genuine Normal ruleset rather than switching to a simplified presentation mode. The Advisor never drives the browser or changes game state; the player makes every move.

## How It Works

The React interface renders a geographic world map, live adoption and market telemetry, a Compute economy, strategy controls, source-labelled events, scenario choices, and an S/A/B/C mission score. Every number is owned by a deterministic TypeScript engine:

- Fixed one-day steps keep growth bounded; the player-facing Normal / Fast Forward control runs 1 or 8 substeps without changing their size.
- Seeded events and identical action sequences are replayable.
- Curated actions apply deterministic effects without requiring an AI service. The browser game does not accept arbitrary feature text.
- Model investment can open capability-versus-safety and capability-versus-governance gaps.
- Trust responds to safety, governance, incidents, and market concentration.
- Open Ecosystem trades away Codex share to reduce concentration and improve trust.
- Autonomous rivals invest, improve, and take share while the player waits, so passive play can lose.
- A catalog of 100 authored events covers disasters, culture, policy, competition, and technology, with deterministic scheduling, cooldowns, bounded effects, and action/event combos.
- Required choices in 2029 and 2035 alter the route to 2040.
- Player actions create bounded Momentum windows; waiting stalls access while costs and competitors continue.
- Critical news pauses time and explains its cause, Trust consequence, and most urgent game-over risk.
- The ending resolves one of eight outcomes and compares the reference scenarios with the player's timeline.

Freeform product ideas are handled outside the game by a read-only Codex Advisor Skill. The Advisor maps an intention to an existing action and explains its cost, prerequisite, effect, and tradeoff. It does not click, inject an event, run a heartbeat, or mutate a save. This keeps Codex useful as a teacher and strategist without making the simulation dependent on model latency.

The current development branch also defines an exact bilingual 50-node catalog: 12 Model, 16 Product, 12 Company, and 10 Open Ecosystem choices. The catalog includes prerequisites, exclusions, costs, deterministic effects, and validation. Full engine/UI integration is still being verified, so the final submission and video must not claim the complete 50-node experience until `npm run check` passes.

The earlier local GM file bridge remains in the repository as a dormant, bounded experiment. Normal gameplay does not start its heartbeat, polling loop, fallback deck, or action transport. The deterministic engine, authored event system, autonomous rivals, and endings are the shipped gameplay path.

## How We Used Codex and GPT-5.6

Codex was our build environment and engineering collaborator. We used it to:

- Refine the learning thesis and define the engine/Advisor authority boundary.
- Translate the specification into a deterministic TypeScript state machine.
- Build and integrate the map, strategy tree, autonomous competition, 100-event catalog, scenario decisions, Advisor contract, voice flow, and ending review.
- Write adversarial and behavioral tests for replay, state bounds, event scheduling and clamps, strategy catalog validation, provenance, branches, and endings.
- Review the implementation against every public claim and draft submission materials.

GPT-5.6 helped reason across the specification, engine, UI, bridge, tests, and documentation. The project also uses OpenAI's official Agents SDK with `RealtimeAgent` and `RealtimeSession`, `gpt-realtime-2.1`, WebRTC audio, and an approval-gated function tool that can reset only the in-game Tibo token cooldown.

## Educational Source Material

The project is an independent adaptation inspired by [AI 2027](https://ai-2027.com/) and [AI 2040: Plan A](https://ai-2040.com/) from the AI Futures Project. It simplifies their dynamics into game mechanics and does not present either scenario as a prediction or reproduce the original works.

Active gameplay uses three canonical provenance labels: **AI 2027** and **AI 2040** for adapted reference-scenario material, and **Your Timeline** for player choices and deterministic world events. The dormant bridge schema can still represent **Live GM**, but normal gameplay does not run that lane. The UI renders source metadata directly rather than guessing from event text.

The engine and ending interface share eight outcomes: Beneficial Abundance, Managed Transition, Fragile Abundance, Race Future, Regulatory Freeze, Safety Incident, Misalignment, and Pyrrhic Monopoly.

## Three-Minute Demo Shot List

**0:00–0:20 — Thesis and two surfaces**  
Frame Codex on the left and Codex 2040 in the right in-app browser. Explain that the engine owns the numbers.

**0:20–0:45 — Learn the rules, then make the first move**
Advance through the four-step tutorial. Begin the simulation, point out that access is stalled without intervention, then deploy Education Mode and show Momentum activate.

**0:45–1:25 — See cause and consequence**
Switch to Fast Forward. The Build Week Tokyo World Brief stops the clock on 2026-07-18; read its Trust outlook plus Control Pressure, then resume at the same speed. Make a strategy investment or ecosystem decision in response.

**1:25–1:45 — Explain provenance and the Advisor boundary**
Show the three active source badges. Ask the Advisor about the current tradeoff, then execute the recommended deterministic action yourself.

**1:45–2:35 — Call the OpenAI Voice Agent**
Open Voice Operator and ask TIBO to reset the in-game Tibo token limit. Show the agent's spoken confirmation request, give a short explicit approval, then show the function tool execute once and pulse the map.

**2:35–2:55 — Show verification and the safety boundary**
Show the test result and briefly name the replay, clamp, retry, bridge, branch, and ending coverage.

**2:55–3:00 — Close**  
End with: “You did not own the world. You helped it learn.”

## Submission Checklist

- [x] Draft title, tagline, Education framing, technical explanation, and demo sequence.
- [x] Add AI 2027 and AI 2040 attribution links.
- [x] Preserve the local browser-to-filesystem GM bridge as a dormant experiment; remove it from the normal gameplay loop.
- [x] Implement canonical source metadata, 2029/2035 decisions, eight ending presentations, and timeline review.
- [x] Replace the automatic demo with a paused four-step tutorial and one Normal ruleset.
- [x] Implement Momentum, critical-event pauses, Trust causes, and visible game-over pressure.
- [x] Implement the official OpenAI Realtime Voice Agent and approval-gated in-game reset tool.
- [x] Add 100 deterministic authored events and autonomous rival progression.
- [x] Remove arbitrary feature text from the browser game and route idea consultation to the read-only Advisor.
- [x] Define and validate the bilingual 50-node strategy catalog.
- [x] Integrate the 50-node engine/UI path and make `npm run check` fully green (140 tests plus production build).
- [ ] Complete the final in-app Browser E2E on the English, Japanese, and static-hosting builds.
- [ ] Rehearse the complete three-minute flow in the Codex app browser on the presentation machine.
- [ ] Verify the actual projector/display layout and local Realtime setup.
- [ ] Capture final screenshots.
- [ ] Record and upload the demo video; add the real video URL only after upload.
- [ ] Add an appropriate repository license, or explicitly share a private repository with the Devpost reviewers as required by the official rules. This legal/repository choice is still open.
- [ ] Push the submission commit to the repository used in Devpost; the current `origin/main` does not yet contain the latest gameplay work.
- [ ] Publish a stable static build to OpenAI Sites and add the real URL only after deployment. No Codex 2040 Site exists yet.
- [ ] E2E-test that exact hosted URL. Static Sites should run the deterministic game with scripted voice fallback; it must not claim a live Realtime connection.
- [ ] Complete any required Devpost team, participant, consent, and category fields.
- [ ] Complete the event's `/feedback` step if required and record the real result; no session has been claimed here.
- [ ] Recheck every implementation claim against the submitted commit.
- [ ] Submit on Devpost and confirm the submitted entry is visible.

## Hosting Plan

Use OpenAI Sites for the stable Devpost judging URL. The Vite production build is a static single-page app, so the game, tutorial, autosave, autonomous rivals, events, decisions, and endings can run without Kai's laptop or a temporary tunnel.

The static build cannot mint Realtime client secrets because `/api/realtime/client-secret` is a Vite development-server route. On Sites, the Voice Operator must visibly use scripted fallback. Keep the live OpenAI Realtime Voice Agent as a local-machine demo and video proof unless a trusted server endpoint with equivalent key isolation and origin controls is deployed. Never put `OPENAI_API_KEY` in the client bundle.

## Official Submission Blockers

- Create the Devpost project draft and select **Education**; no draft was found during the official review.
- Record an English, public or unlisted YouTube demo under three minutes with audio, showing what was built and how Codex/GPT-5.6 were used. The repository MP4 is supporting media, not a substitute for this requirement.
- Supply the final repository URL and satisfy the official access/license requirement.
- Publish and E2E-test the stable judging URL; do not invent it in this draft.
- Complete `/feedback` and add the real session IDs; none are claimed here.
- Re-run `npm ci && npm run check` on the exact submitted commit.
- Move the project to Devpost's final **Submitted** state and verify that the submitted entry is visible.

## Local Verification Commands

```bash
npm ci
npm run check
```

For local browser play and the live Realtime Voice Agent:

```bash
npm run dev
```

For the static artifact intended for Sites:

```bash
npm run build
npm run preview
```

The live Realtime path requires a server-held `OPENAI_API_KEY` in ignored `.env.local`. The static artifact does not.

## Next

The current live function tool intentionally remains limited to the in-game Tibo token reset. New product ideas belong in the separate Advisor conversation; the game itself stays a deterministic strategy game with explicit choices.
