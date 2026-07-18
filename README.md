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
- An official OpenAI Voice Agent (`RealtimeAgent` + `RealtimeSession`) over browser WebRTC for **Kibo — Demo Operator**, explicitly identified as a fictionalized operator using a generic synthetic voice.
- A two-call `trigger_token_reset` function-tool contract: the first call creates a visible pending request, and a second call can invoke the existing in-game reset only after a separate explicit spoken confirmation.
- A same-UI scripted voice fallback for missing credentials, microphone denial, or Realtime failure.
- Automated tests covering the engine, GM contract, bridge client and server, scenario data, branches, and endings.

## Architecture and GM Boundary

- `src/engine.ts` owns state, fixed-step transitions, action effects, incidents, invariants, provenance-bearing news, scoring, and ending evaluation.
- `src/gm.ts` owns the GM schema, content guards, bounded event parsing, heartbeat state, fallback deck, and one-event/one-file contract.
- `src/gmBridgeClient.ts` sanitizes read-only snapshots and player actions, POSTs actions and 60-second heartbeats, and polls for validated events.
- `server/gmBridgePlugin.js` adds same-origin endpoints to the Vite development server and performs atomic filesystem handoff.
- `server/realtimePlugin.js` uses the standard OpenAI API key only on the Vite server to mint a 120-second Realtime client secret. Upstream failures collapse to a non-sensitive fallback response.
- `src/voiceAgent.ts` constructs the official OpenAI Agents SDK `RealtimeAgent` and `RealtimeSession`, pins `gpt-realtime-2.1` with the `webrtc` transport, and owns audio, subtitles, mute, lifecycle, and the function tool.
- `src/voiceReset.ts` validates both `trigger_token_reset` calls, owns the visible approval state, rejects mismatched or duplicate confirmations, and respects the engine cooldown before allowing one game action.
- `src/components/VoiceCallPanel.tsx` renders the operator identity, game-only scope, call state, microphone state, subtitles, fallback, keyboard hints, and approval controls.
- `src/scenario.ts` is the canonical source for provenance metadata, milestones, 2029/2035 choices, and core outcome definitions.
- `src/App.tsx` coordinates the browser runtime, local actions, bridge polling, fallback behavior, automatic demo schedule, decisions, and ending review.
- `src/components/` contains the map, strategy tree, decision, and ending interfaces.

### Local file-bridge flow

1. A player action is applied locally first, so gameplay never waits for a GM.
2. The browser POSTs the action plus an allow-listed state snapshot to `/__codex2040/gm/turns`. It POSTs a heartbeat to the same endpoint every 60 seconds.
3. Vite's local bridge validates the turn and atomically writes `gm-bridge/inbox/turn-*.json`.
4. A producer may consume that inbox and atomically write one `events/evt-<uuid>.json` file per proposed event.
5. The browser polls `/__codex2040/gm/events` every 2.5 seconds. The bridge validates complete files, leaves partial or invalid files for retry, and moves delivered files to `gm-bridge/processed/`.
6. The browser validates the returned cycle again, then the deterministic engine clamps and applies it.

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

For live Realtime voice, place `OPENAI_API_KEY` in the ignored local `.env.local`. Vite loads it only into the server configuration; it is not exposed through `import.meta.env` or the client bundle. If the key is absent, invalid, or lacks Realtime access, the call panel automatically uses scripted voice fallback.

Run verification with:

```bash
npm run check
```

Or run the stages separately:

```bash
npm test
npm run build
```

The current integrated snapshot passes all 61 tests across eight files and the production build.

## Realtime Voice Demo

1. Select **NORMAL** so the authored 60-second director does not spend the reset cooldown first.
2. Open **VOICE OPERATOR**, then select **START CALL**. The browser asks for microphone access only after this explicit action.
3. Ask: **「ゲーム内Tiboトークンのリミットをリセットして」**.
4. The Voice Agent calls `trigger_token_reset` with `confirmed: false`; the game shows the pending tool request but does not execute it.
5. The agent asks for confirmation aloud. Say **「はい、実行して」**. It then makes a second tool call with the matching approval ID and spoken confirmation; the existing engine reset runs once and the map emits its global pulse. No UI confirmation is required on this normal path.
6. Use **MUTE**, **END CALL**, or the keyboard controls shown in the panel as needed. If the key, microphone, or Realtime connection is unavailable, the same panel clearly switches to scripted SpeechSynthesis backup, where visible buttons provide the explicit confirmation.

The primary implementation follows the official [Voice agents](https://developers.openai.com/api/docs/guides/voice-agents), [Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc), and [Realtime tools](https://developers.openai.com/api/docs/guides/realtime-mcp) flows. Scripted SpeechSynthesis is only the failure backup and is never treated as a live Voice Agent connection.

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

- The GM file bridge still has no external producer. Realtime voice is a separate local-development OpenAI API path and cannot propose numeric GM effects.
- The file bridge is a Vite development-server plugin. A static production host would need equivalent same-origin endpoints and filesystem handling.
- The Realtime client-secret route is also Vite-development-only. A deployed build needs a trusted server endpoint with equivalent key isolation and origin controls.
- A successful bridge heartbeat proves that the local transport accepted a snapshot, not that an external producer consumed it or returned an event.
- The automatic demo is an authored happy-path lesson. It guarantees at least an A rank and disables terminal Misalignment so a presentation cannot end prematurely; Normal mode retains harsher branches.
- The scenario is an educational simplification, not a forecast or policy recommendation.
