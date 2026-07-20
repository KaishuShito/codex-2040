# Devpost Draft — Codex 2040

## Title

Codex 2040

## Tagline

Play the tradeoffs shaping AI's future: access, capability, safety, governance, and competition.

## Category

**Education**

## The Problem

AI future scenarios are difficult to learn from passively. A reader has to hold many coupled systems in their head at once: capability growth, public access, safety work, regulation, trust, organizational capacity, and market concentration. That makes the central lesson easy to miss: maximizing one number is not the same as creating a good future.

## The Solution

Codex 2040 turns those tradeoffs into a playable educational simulation. Players spread useful AI across a world map, invest limited Compute, ship features, and balance capability against safety and governance. They are rewarded for broad access and strong performance, but also for preserving trust and meaningful competition. Deliberately opening the ecosystem can be better than winning a monopoly.

The experience uses the Codex app as the classroom: Codex provides narration and discussion on the left while the deterministic simulation runs in the in-app browser on the right. A four-step tutorial introduces one genuine Normal ruleset rather than switching to a simplified presentation mode.

## How It Works

The React interface renders a geographic world map, live adoption and market telemetry, a Compute economy, strategy controls, source-labelled events, scenario choices, and an S/A/B/C mission score. Every number is owned by a deterministic TypeScript engine:

- Fixed one-day steps keep growth bounded; the player-facing Normal / Fast Forward control runs 1 or 8 substeps without changing their size.
- Seeded events and identical action sequences are replayable.
- Local keyword rules apply feature effects immediately, even without an AI service.
- Model investment can open capability-versus-safety and capability-versus-governance gaps.
- Trust responds to safety, governance, incidents, and market concentration.
- Open Ecosystem trades away Codex share to reduce concentration and improve trust.
- Required choices in 2029 and 2035 alter the route to 2040.
- Player actions create bounded Momentum windows; waiting stalls access while costs and competitors continue.
- Critical news pauses time and explains its cause, Trust consequence, and most urgent game-over risk.
- The ending resolves one of eight outcomes and compares the reference scenarios with the player's timeline.

The local-development GM bridge is also implemented. The browser POSTs sanitized actions and 60-second heartbeats to a same-origin Vite endpoint. The server atomically writes turn files to `gm-bridge/inbox/`; the browser polls every 2.5 seconds for schema-validated `events/evt-<uuid>.json` files, which are archived after delivery and clamped again by the engine.

An external Codex/LLM producer that consumes inbox turns and writes event files is **not** automated or invoked by the app. When the local bridge is unavailable, the watchdog retains a bounded scripted fallback. A bridge-available indicator confirms local transport only; it does not claim external model inference.

The model boundary remains strict: GM events can propose only allow-listed effects. The system filters content, limits each event cycle, preserves state invariants, and keeps all risk and ending logic inside the engine.

## How We Used Codex and GPT-5.6

Codex was our build environment and engineering collaborator. We used it to:

- Refine the learning thesis and define the engine/GM authority boundary.
- Translate the specification into a deterministic TypeScript state machine.
- Build and integrate the map, strategy tree, scenario decisions, local file bridge, fallback loop, and ending review.
- Write adversarial and behavioral tests for replay, state bounds, event clamps, bridge transport, retries, provenance, branches, and endings.
- Review the implementation against every public claim and draft submission materials.

GPT-5.6 helped reason across the specification, engine, UI, bridge, tests, and documentation. The project also uses OpenAI's official Agents SDK with `RealtimeAgent` and `RealtimeSession`, `gpt-realtime-2.1`, WebRTC audio, and an approval-gated function tool that can reset only the in-game Tibo token cooldown.

## Educational Source Material

The project is an independent adaptation inspired by [AI 2027](https://ai-2027.com/) and [AI 2040: Plan A](https://ai-2040.com/) from the AI Futures Project. It simplifies their dynamics into game mechanics and does not present either scenario as a prediction or reproduce the original works.

Every event carries one of four canonical provenance labels: **AI 2027** and **AI 2040** for adapted reference-scenario material, **Your Timeline** for player counterfactuals, and **Live GM** for bridge-delivered or scripted GM interpolation. The UI renders this metadata directly rather than guessing from event text.

The engine and ending interface share eight outcomes: Beneficial Abundance, Managed Transition, Fragile Abundance, Race Future, Regulatory Freeze, Safety Incident, Misalignment, and Pyrrhic Monopoly.

## Three-Minute Demo Shot List

**0:00–0:20 — Thesis and two surfaces**  
Frame Codex on the left and Codex 2040 in the right in-app browser. Explain that the engine owns the numbers.

**0:20–0:45 — Learn the rules, then make the first move**
Advance through the four-step tutorial. Begin the simulation, point out that access is stalled without intervention, then deploy Education Mode and show Momentum activate.

**0:45–1:25 — See cause and consequence**
Switch to Fast Forward. The Build Week Tokyo World Brief stops the clock on 2026-07-18; read its Trust outlook plus Control Pressure, then resume at the same speed. Make a strategy investment or ecosystem decision in response.

**1:25–1:45 — Explain provenance**
Show the four source badges. Clarify which events adapt AI 2027 or AI 2040, which are player counterfactuals, and which are GM interpolation.

**1:45–2:35 — Call the OpenAI Voice Agent**
Open Voice Operator and ask Kibo to reset the in-game Tibo token limit. Show the agent's spoken confirmation request, give a short explicit approval, then show the function tool execute once and pulse the map.

**2:35–2:55 — Show verification and the safety boundary**
Show the test result and briefly name the replay, clamp, retry, bridge, branch, and ending coverage.

**2:55–3:00 — Close**  
End with: “You did not own the world. You helped it learn.”

## Submission Checklist

- [x] Draft title, tagline, Education framing, technical explanation, and demo sequence.
- [x] Add AI 2027 and AI 2040 attribution links.
- [x] Implement the local browser-to-filesystem GM bridge, validated event polling, and scripted fallback.
- [x] Implement canonical source metadata, 2029/2035 decisions, eight ending presentations, and timeline review.
- [x] Replace the automatic demo with a paused four-step tutorial and one Normal ruleset.
- [x] Implement Momentum, critical-event pauses, Trust causes, and visible game-over pressure.
- [x] Implement the official OpenAI Realtime Voice Agent and approval-gated in-game reset tool.
- [x] Run `npm run check`: 8 test files and 85 tests pass; the production build succeeds.
- [ ] Rehearse the complete three-minute flow in the Codex app browser on the presentation machine.
- [ ] Verify the actual projector/display layout and local bridge directories.
- [ ] Capture final screenshots.
- [ ] Record and upload the demo video; add the real video URL only after upload.
- [ ] Publish a repository, if desired or required; add the real public URL only after publication.
- [ ] Deploy the app, if desired or required; add the real deployed URL only after deployment.
- [ ] Complete any required Devpost team, participant, consent, and category fields.
- [ ] Complete the event's `/feedback` step if required and record the real result; no session has been claimed here.
- [ ] Recheck every implementation claim against the submitted commit.
- [ ] Submit on Devpost and confirm the submitted entry is visible.

## Next

Future voice extensions can route feature proposals, region events, and 2029/2035 choices through the same deterministic action and clamp boundaries. The current prototype intentionally limits the live function tool to the in-game Tibo token reset.
