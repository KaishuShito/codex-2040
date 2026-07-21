# Codex 2040 playtest and balance report

## What this evidence can prove

The original 50 worldlines are useful production-engine stress tests, not a
claim that 50 people played the game. Ten independent agent-authored strategies
each drove the real `src/engine.ts` through five deterministic scenario seeds.
They exposed passive high scores, Brownout recovery loops, excessive late-game
treasuries, and strategy-specific failure modes.

The 250-run matrix adds five synthetic behavior profiles (`novice`, `cautious`,
`competitive`, `explorer`, and `frugal`) to those ten strategic intents. It
models reading time, delayed risk recognition, rounded observations, missed or
mistaken actions, speed switching, and imperfect reward-bubble collection. It
is a sensitivity test, not a substitute for first-time players.

## Evidence stack

| Layer | Runs | Purpose | Important limitation |
| --- | ---: | --- | --- |
| Production-engine strategy matrix | 50 | Find economic, scoring, and ending failures | Strategies can read and reason about the engine better than a novice |
| Synthetic behavior matrix | 250 before + 250 after | Compare the same behavior noise before/after tuning | Synthetic profiles are not people |
| In-app Browser E2E | Representative paths | Verify visible controls and transient interaction | Does not measure comprehension or enjoyment |
| Anonymous real plays | Pending calibration set | Measure actual confusion, abandonment, timing, and choices | Requires enough consented sessions |

## Before and after

The same 10 policies, 5 behavior profiles, and 5 seeds were run before and
after the selected parameter change.

| Metric | Before | After |
| --- | ---: | ---: |
| Completed | 250 / 250 | 250 / 250 |
| Mean score | 74.5 | 74.5 |
| Mean world access | 12.24% | 11.35% |
| Final PF p95 | 65,485 | 8,662 |
| Passive high ranks | 5 / 5 | 0 / 5 |
| Final PF >= 15,000 | 124 / 250 | 0 / 250 |
| Mean total Brownout days | 556 | 531 |
| Max continuous Brownout p95 | not recorded | 81 days |
| Mean bubble catch rate | 43.2% | 43.0% |

The economy stopped accumulating meaningless late-game stockpiles without
raising the overall mean score. Passive play now finishes at C, while healthy
governance, access, and open-ecosystem routes still reach A/S. Repeated
Brownouts remain a design warning: the p95 continuous lock is bounded, but the
total number of constrained days is still high.

## Selected tuning

- Access target: 20% -> 17.5%.
- Fewer than two meaningful interventions caps the result at C.
- Emergency compute lifeline: 220 PF -> 320 PF.
- Brownout capability is 75% of current capability rather than a near-zero
  constant, so unsafe high-capability systems remain dangerous.
- Brownout recovery requires 45 PF plus 30 days of projected full-power deficit.
- Brownout operating cost is 25% of normal, allowing a real recovery path.
- Treasury carry cost is 0.5% per day only on PF above a 1,000 PF allowance.
- Reward bubbles remain 5-8 PF and do not directly change momentum or risk.

## Browser evidence

The local app was exercised through the Codex in-app Browser at
`http://127.0.0.1:5174/`:

- The OpenAI CEO onboarding could be dismissed and the simulation advanced.
- A community event created a visible, short-lived 6 PF reward bubble.
- TIBO Token Reset created three visible bubbles worth 6, 8, and 7 PF; one was
  collected and removed while the other two remained.
- Fast mode advanced roughly eight simulation days per second.
- An authored event and the 2029 choice both paused the date until acknowledgement.
- The Browser console contained no error-level entries.

`npm run check` passed the full test suite and both client and Worker builds.

## Independent realism audit

The audit found an important boundary: in the first synthetic harness, about
77.5% of score variance and 82.5% of access variance was explained by the ten
strategic policies, while human profiles explained only about 4.5% and 1.7%.
Most policies also had access to internal engine values. Therefore these 250
runs must be called a synthetic sensitivity test, not a simulated user study.

The next harness revision must use only a visible `PlayerObservation`, separate
scenario and behavior seeds, reserve untouched policies/seeds as a holdout,
model harmful valid mistakes and abandonment, and report low-agency time rather
than only zero-PF deadlocks.

That V2 harness is now implemented. Its compatibility adapter gives the ten
existing policies a deliberately lossy state rebuilt from `PlayerObservation`;
hidden timers, scheduler history, engine RNG, and refractory counters are no
longer exposed. Scenario and behavior seeds are independent, and every policy
sees the same scenario seed for a given run index.

### V2 tuning versus untouched holdout

| Metric | Tuning split | Holdout split |
| --- | ---: | ---: |
| Synthetic runs | 250 | 250 |
| Reached a terminal ending | 114 | 109 |
| Modeled dropout | 23 | 21 |
| Modeled timeout | 113 | 120 |
| Mean score at stop | 71.2 | 70.7 |
| Mean access at stop | 8.71% | 8.45% |
| Mean low-agency days | 47.5 | 42.3 |
| Mean first-action time | 38.3 sec | 48.8 sec |
| Valid but mistaken investments | 708 | 695 |

The close tuning/holdout result is evidence against obvious seed overfitting.
It is not evidence that the modeled abandonment and timeout rates are real.
Those rates are intentionally treated as uncalibrated hypotheses until actual
player sessions supply a distribution. Scores recorded at dropout/timeout describe the
state at stop and must not be reported as completed endings.

## Real-player calibration

For the next ten or more anonymous plays, the minimum useful aggregate evidence
is:

- tutorial completion and abandonment point;
- time to first meaningful action;
- normal/fast switching;
- action sequence and rejected actions;
- event acknowledgement time;
- time spent unable to afford a meaningful action;
- 2029/2035 decisions and ending.

The existing D1 worldline receipt is useful for final outcomes, but outcome-only
data cannot calibrate confusion or interaction timing. Any expanded telemetry
should remain anonymous, disclose what is collected, and avoid raw free text or
voice content.
