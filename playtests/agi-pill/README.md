# AGI Pill deterministic worldlines

This directory owns synthetic balance evidence for AGI Pill mode. It deliberately does not edit or tune the production engine.

The batch matrix uses shared scenario seeds across seven human-like strategic intents: balanced, passive, over-accelerate, safety-first, industry-first, governance-first, and compute-first. Every policy/seed pair is repeated exactly so nondeterminism is observable rather than assumed away.

The harness executes the same 13 paced-and-eligible authored event modals as the shipped UI, chooses options deterministically from each policy's declared priorities, and checks/funds at most one affordable visible strategy-tree program every 240 simulated days, capped at eight programs per run. Costs, phase tiers, the 12-card visibility window, prerequisites, effects, and flags mirror `AgiPillGame`; the slower cadence models a player reading tradeoffs rather than emptying every newly affordable branch.

The invariant report checks:

- exact-repeat determinism;
- meaningful policy and outcome diversity;
- at least two independently viable strategic intents;
- whether one policy dominates all shared scenarios;
- automatic wins under passive play;
- prolonged, actionless resource starvation;
- catastrophic endings without visible warning and explicit causes;
- whether adverse events retain recorded recovery paths.

These are synthetic engine checks, not evidence that a human can understand the UI. Browser E2E and real play remain the primary verifier. Thresholds are diagnostics, not targets for tuning the engine until the report turns green.

Run the focused unit checks with:

```sh
npx vitest run playtests/agi-pill
```

After `src/agiPill/engine.ts` is integrated, `run-batch.ts` executes the production engine and writes the small checked-in `worldlines.json` and `REPORT.md` evidence artifacts.
