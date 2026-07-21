# AGI Pill synthetic worldline report

Generated: 2026-07-21T10:04:21.496Z

Verdict: **PASS** — 168 deterministic executions, 84 unique policy/seed worldlines.

## Policy distribution

| Policy | Runs | Success | Mean score | Actions | Events | Upgrades | Recovery | Outcomes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| balanced | 24 | 100.0% | 90.08 | 20.2 | 8.2 | 8.0 | 100.0% | plural-expansion:24 |
| compute-first | 24 | 0.0% | -49.00 | 10.8 | 2.1 | 3.9 | 53.1% | accident:8, misalignment:16 |
| governance-first | 24 | 0.0% | 10.36 | 14.0 | 0.0 | 8.0 | 100.0% | stagnation:24 |
| industry-first | 24 | 83.3% | 64.40 | 90.1 | 10.2 | 8.0 | 0.0% | misalignment:4, plural-expansion:20 |
| overaccelerate | 24 | 0.0% | -55.07 | 5.1 | 1.3 | 2.8 | 0.0% | accident:6, misalignment:18 |
| passive | 24 | 0.0% | -27.29 | 1.0 | 1.0 | 0.0 | 0.0% | capture:24 |
| safety-first | 24 | 100.0% | 93.49 | 45.0 | 8.0 | 8.0 | 100.0% | plural-expansion:24 |

## Invariants

| Status | Invariant | Evidence |
|---|---|---|
| PASS | determinism | Every exact policy/seed repeat produced the same normalized fingerprint. |
| PASS | policy-diversity | 7 policies, 7 active policies, 6 distinct outcome signatures. |
| PASS | viable-strategies | 3 policies reached at least one successful trajectory: balanced, industry-first, safety-first. |
| PASS | single-optimum | Quality-or-speed objective share for the most dominant policy was 50.0% ({"balanced":12,"compute-first":0,"governance-first":0,"industry-first":0,"overaccelerate":0,"passive":0,"safety-first":12}). |
| PASS | automatic-passive-win | Passive play never won automatically. |
| PASS | resource-deadlock | No prolonged resource starvation became an actionless deadlock. |
| PASS | opaque-instant-death | Every catastrophic ending had a player-visible warning and explicit ending causes. |
| PASS | recovery-legibility | 34/116 adverse events were followed by a recorded recovery (29.3%). |
| PASS | authored-systems-exercised | 738 due event choices executed across 13 events/21 options; 928 affordable upgrades funded across 18 programs; missed events=0; unfunded active runs=0. |

## Outcome distribution

- accident: 14
- capture: 24
- misalignment: 38
- plural-expansion: 68
- stagnation: 24

## Interpretation limits

- These are deterministic synthetic policies, not observations of real players.
- The harness can test engine causality and option availability, but not whether the browser UI communicates them clearly.
- Balance thresholds are diagnostic guardrails; product tuning must not be changed merely to make this report green.

A passing synthetic report is supporting engine evidence only. Browser E2E remains the primary verifier for player-visible causality and recovery affordances.
