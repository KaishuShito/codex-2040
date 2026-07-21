# Production-engine playtesting

Each policy is a small player agent. `run-policy.ts` drives the real
`src/engine.ts` from 2026 through a terminal ending, records every accepted and
rejected action, acknowledges authored world events, and makes the policy's
explicit 2029/2035 choices.

Run one lane with:

```sh
node_modules/.bin/tsx playtests/run-policy.ts \
  playtests/policies/agent-01.ts \
  playtests/results/agent-01.json 5 12001
```

Result JSON is evidence, not a mock or a parallel scoring model. Parameter
optimization must continue to use production `tickDay`, `transition`,
`scoreState`, and `evaluateEnding`.

## Validation layers

The artifacts in this directory have different evidentiary strength. Do not
describe every JSON file as a user test.

1. `results-optimized/` is a deterministic production-engine stress test: ten
   authored strategies, five seeds each.
2. `results-humanized-before/` and `results-humanized-after/` are synthetic
   sensitivity tests. They add reading delay, missed actions, mistakes, speed
   changes, and bubble reaction, but they are not observations of people.
3. Browser E2E checks visible interaction paths that the engine harness cannot
   prove, such as event pause, speed controls, and short-lived reward bubbles.
4. Anonymous real-player telemetry is the calibration source of truth.

Run the synthetic matrix with:

```sh
node_modules/.bin/tsx playtests/run-humanized.ts playtests/results-humanized-after
node_modules/.bin/tsx playtests/analyze-humanized.ts \
  playtests/results-humanized-after/runs.json \
  playtests/analysis-humanized-after.json
```

See `REPORT.md` for the before/after comparison, limitations, and acceptance
evidence.

## Humanized V2: paired tuning and holdout runs

`humanized-v2.ts` is the stricter synthetic-user harness. Unlike the original
matrix, a V2 policy receives only `PlayerObservation`: values inspectable in the
UI plus visible strategy-node availability. Engine random streams, event
scheduler history, hidden gap timers, and refractory counters are excluded.
The compatibility adapter rebuilds a deliberately lossy state from that
observation, so the ten existing authored policies remain comparable without
receiving the production `GameState`.

Scenario and behavior randomness use separate seeds. Tuning and holdout bases
are disjoint, and every policy/profile combination for a given run index shares
the same scenario seed. V2 also records valid-but-poor mistake actions,
dropout/timeout, time to first action, and time spent with no immediately
available gameplay action.

Run the two predeclared splits without choosing ad-hoc seeds:

```sh
node_modules/.bin/tsx playtests/run-humanized-v2.ts \
  playtests/results-humanized-v2/tuning.json tuning 5
node_modules/.bin/tsx playtests/run-humanized-v2.ts \
  playtests/results-humanized-v2/holdout.json holdout 5
```

These remain synthetic sensitivity tests. Dropout and comprehension parameters
must eventually be calibrated against consented aggregate real-player data.
