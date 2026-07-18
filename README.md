# Codex 2040

**Codex 2040 is an educational AI-governance simulation about expanding access without outrunning safety, governance, or healthy competition.**

The product thesis is simple: Codex helps build a game about its own spread, then shares the game board with a Codex game master. In the Codex app experience, the left surface provides narration and discussion while the right in-app browser runs the playable simulation. The player is not trying to own the world; the goal is to help the world adopt useful AI while preserving trust and a plural ecosystem.

> You did not own the world. You helped it learn.

## Why Education

Long-form AI scenarios ask readers to mentally connect capability progress, access, safety, regulation, trust, and concentration. Codex 2040 turns those relationships into actions with visible consequences:

- Invest in capability, then watch safety and governance gaps widen if the organization does not keep up.
- Ship features and expand communities while tracking who receives access.
- Choose between racing, slowing down, and verifiable coordination at pivotal moments.
- Open the ecosystem to give up share, reduce concentration, and rebuild trust.
- Reach 2040 and review how the player's timeline diverged from the reference scenarios.

The score rewards coverage, beneficial access, healthy competition, and safety equally. High adoption through monopoly or unsafe acceleration is therefore not the best ending.

## What Is Implemented

The integrated browser experience includes:

- An interactive geographic world map with eight simulation regions and event markers.
- A deterministic seeded engine using fixed one-day steps at x1, x2, x5, or x8 substeps per frame.
- Logistic adoption, competitor dynamics, regulation, incidents, brownout recovery, and bounded invariants.
- Model, Product, Safety Team, Policy, and Data Center investments funded by Compute.
- Local keyword handling and input filtering for mobile, education, and enterprise proposals.
- Community deployments, an eight-second Token Reset boost, and an Open Ecosystem action.
- A working local-development file bridge for GM actions, heartbeats, and validated event delivery.
- A 60-second watchdog and bounded scripted fallback when the local bridge is unavailable.
- Four canonical provenance labels rendered from engine metadata: **AI 2027**, **AI 2040**, **Your Timeline**, and **Live GM**.
- Required 2029 and 2035 decisions whose choices change engine state and endings.
- Eight resolved outcomes: Beneficial Abundance, Managed Transition, Fragile Abundance, Race Future, Regulatory Freeze, Safety Incident, Misalignment, and Pyrrhic Monopoly.
- A three-decision ending review comparing the reference scenarios with the player's timeline.
- A fully authored automatic demo that reaches its 2040 ending at 54 seconds.
- Automated tests covering the engine, GM contract, bridge client and server, scenario data, branches, and endings.

## Architecture and GM Boundary

- `src/engine.ts` owns state, fixed-step transitions, action effects, incidents, invariants, provenance-bearing news, scoring, and ending evaluation.
- `src/gm.ts` owns the GM schema, content guards, bounded event parsing, heartbeat state, fallback deck, and one-event/one-file contract.
- `src/gmBridgeClient.ts` sanitizes read-only snapshots and player actions, POSTs actions and 60-second heartbeats, and polls for validated events.
- `server/gmBridgePlugin.js` adds same-origin endpoints to the Vite development server and performs atomic filesystem handoff.
- `src/scenario.ts` is the canonical source for provenance metadata, milestones, 2029/2035 choices, and core outcome definitions.
- `src/App.tsx` coordinates the browser runtime, local actions, bridge polling, fallback behavior, automatic demo schedule, decisions, and ending review.
- `src/components/` contains the map, strategy tree, decision, and ending interfaces.

### Local file-bridge flow

1. Each browser runtime creates a distinct `run-<uuid>` when it mounts. Switching between Demo and Normal starts a new run. The run ID is copied onto every snapshot, heartbeat, action, and live GM event; it is separate from the event's `evt-<uuid>` ID.
2. A player action is applied locally first, so gameplay never waits for a GM. The browser POSTs the action plus an allow-listed state snapshot to `/__codex2040/gm/turns`; it also sends an initial snapshot and a heartbeat every 60 seconds.
3. Vite validates the nested run IDs and atomically writes `gm-bridge/runs/<runId>/inbox/turn-*.json`. Each run has independent capacity and retention.
4. A producer consumes turns through `GET /__codex2040/gm/turns?runId=<runId>&limit=3`. Consumed files are atomically moved to that run's `processed/turns/` archive before the response is returned.
5. The producer POSTs one validated, run-bound event at a time to `/__codex2040/gm/events`. The bridge atomically writes it under that run's `events/` directory.
6. The browser polls `/__codex2040/gm/events?runId=<runId>` every 2.5 seconds. Only an exact run match can be delivered; complete legacy or mismatched events are quarantined, partial JSON remains for retry, and delivered files move to that run's `processed/events/`.
7. The browser validates the returned cycle and run ID again, then the deterministic engine clamps and applies it.

Redundant snapshots and heartbeats are compacted per run at the inbox cap, while actions are preserved until the 15-minute TTL. TTL removals are recoverable under `processed/expired-turns/`. Protocol-v1 root `events/*.json` and `gm-bridge/inbox/turn-*.json` files are never delivered; the bridge moves them to `gm-bridge/quarantine/legacy-events/` and `legacy-turns/`.

### GM producer protocol v2

Find the active run after the browser has mounted:

```bash
find gm-bridge/runs -mindepth 1 -maxdepth 1 -type d -print
```

Consume up to three turns. This is the supported acknowledgement step; do not read and leave files in `inbox/`:

```bash
curl -sS \
  -H 'x-codex2040-gm-bridge: 2' \
  'http://127.0.0.1:5173/__codex2040/gm/turns?runId=run-REPLACE_WITH_UUID&limit=3'
```

Copy the exact `runId` from the consumed turn into every event. Generate a new, independent `evt-<uuid>` for `id`, save one event object in a temporary file, then submit it:

```bash
curl -sS -X POST \
  -H 'content-type: application/json' \
  -H 'x-codex2040-gm-bridge: 2' \
  --data-binary @/tmp/codex-2040-event.json \
  'http://127.0.0.1:5173/__codex2040/gm/events'
```

Protocol v1 producers must migrate: add `runId`, use header value `2`, consume turns through the GET endpoint, and submit events through the POST endpoint. Direct root `events/` writes are legacy input and are quarantined.

The repository does **not** automate or invoke an external Codex/LLM producer. Running the app creates the local transport, but it does not generate external model responses by itself. If the bridge is unavailable, the 60-second watchdog can apply a bounded scripted event; the automatic demo also uses authored cues so it remains presentation-safe without a producer.

The authority boundary is strict: the engine owns every number, risk transition, and ending. GM events can supply only allow-listed effects. Unsafe text is rejected, malformed values become zero or are ignored, oversized effects are clamped, and no producer can write risk directly.

## Run Locally

Requirements:

- Node.js `^20.19.0` or `>=22.12.0`
- npm

Install the locked dependency set and start the Vite development server:

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` in the Codex app browser. The Vite server supplies both the app and its local GM bridge endpoints.

Run verification with:

```bash
npm run check
```

Or run the stages separately:

```bash
npm test
npm run build
```

The current integrated snapshot passes all 55 tests across five files and the production build.

## Automatic 60-Second Demo

Select **60s DEMO** and let the authored sequence run. No clicks are required.

| Time | Authored cue |
|---:|---|
| 4s | Education Mode ships and its deterministic local effect lands. |
| 8s | Token Reset lights the global network. |
| 11s | Scripted GM interpretation adds access benefits and child-data governance. |
| 15s | A rival expands the overall learning market. |
| 20s | The 2029 Choose a Path decision opens. |
| 24s | Verified International Slowdown is selected. |
| 32s | The 2035 Hold the Line decision opens. |
| 36s | Hold the Line is selected. |
| 41s | Safety and governance investment catches up. |
| 46s | Open Ecosystem releases power and improves market health. |
| 54s | The simulation resolves the 2040 ending and opens the review. |

Keep Codex visible on the left to narrate the tradeoffs while the browser runs on the right. The bridge status is also visible: **Live Bridge Available** means the local transport answered, not that an external model generated an event.

## Canonical Sources and Endings

Every news item carries an explicit source field; the UI does not infer provenance from its headline.

- **AI 2027** — adapted reference-scenario capability, race, and slowdown dynamics.
- **AI 2040** — adapted reference-scenario governance and coordination ideas from Plan A.
- **Your Timeline** — consequences of player choices, not claims made by either source.
- **Live GM** — GM interpolation delivered through the bridge or scripted fallback, not a source-scenario claim.

The engine and ending UI share the eight ending IDs listed above. Beneficial Abundance requires an S score, the verified 2029 slowdown, the deliberate 2035 pause, sufficient control capacity and trust, viable competitors, and non-monopolistic concentration.

Codex 2040 is an independent educational adaptation inspired by [AI 2027](https://ai-2027.com/) and [AI 2040: Plan A](https://ai-2040.com/), both from the AI Futures Project. It does not reproduce those works or present their scenarios as predictions. The simulation simplifies and recombines ideas for learning; it is not affiliated with or endorsed by the scenario authors.

## Built With Codex

Codex was the development surface and engineering collaborator for the Build Week project. The team used it to refine the learning thesis, establish the engine/GM contract, implement the TypeScript engine and React interface, test deterministic and adversarial cases, integrate the file bridge and scenario experience, and audit submission claims against the code. GPT-5.6 helped reason across the specification, implementation, tests, and documentation.

## Limitations

- No external Codex/LLM producer is bundled, automated, or invoked by the app; there is no production OpenAI API call.
- The file bridge is a Vite development-server plugin. A static production host would need equivalent same-origin endpoints and filesystem handling.
- A successful bridge heartbeat proves that the local transport accepted a snapshot, not that an external producer consumed it or returned an event.
- The automatic demo is an authored happy-path lesson. It guarantees at least an A rank and disables terminal Misalignment so a presentation cannot end prematurely; Normal mode retains harsher branches.
- The scenario is an educational simplification, not a forecast or policy recommendation.
- Realtime voice interaction is a post-MVP proposal documented in `BACKLOG.md`; it is not implemented.
