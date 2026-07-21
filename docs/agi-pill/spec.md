# AGI Pill normative supplement

Status: normative for `codex/agi-pill-mode`. If this supplement conflicts with the Standard sections of `SPEC.md`, the conflict is resolved by keeping Standard unchanged and applying this file only to `mode: "agi-pill"`. Detailed design rationale lives in `game-design.md`; evidence boundaries live in `research-and-sources.md`.

## Product contract

The player is the **Civilization Transition Council**: a plural steering body that can allocate shared programs, negotiate with rival coalitions, and authorize or pause high-impact infrastructure, but does not directly command every lab, state, factory, or later branch civilization.

Early rivals are frontier labs, state-industrial coalitions, and open collectives. As communication latency and off-world autonomy rise, they may become cooperating or competing branch civilizations. Rival success creates pressure and choices, not an unexplained instant loss.

`Standard` and `AGI Pill` are separate games selected before a new run:

- Standard retains its existing engine, actions, dates, saves, D1 payloads, scoring, and endings.
- AGI Pill uses a distinct `agi-pill-v1` deterministic state machine, catalog, result model, and independent local save key.
- Neither mode converts, deletes, or silently overwrites the other. No D1 schema or production migration is introduced by this branch.

## Authority and numerical representation

- The pure deterministic engine is the sole numerical authority. Same seed and actions produce the same state, warnings, rivals, milestones, and ending.
- Large physical stocks are stored as bounded log-capacity indices. UI copy must not present them as raw unit counts.
- Every internal step is one day. Normal advances one step per second and Fast eight. Critical decisions and warnings pause; acknowledgement restores the chosen speed.
- Growth is a coupled result of intelligence, compute, energy, robotics, accessible resources, safety, governance, social friction, and rival pressure.
- Mutual acceleration may shrink effective doubling time, but bounded log indices, diminishing returns, heat/transport/experiment constraints, and explicit physical caps prevent numerical singularities.

## State-gated eras

Elapsed time alone must never unlock an era. The 1–3, 3–5, and 5–10 year ranges are labels for a typical scenario, not predictions or sufficient transition conditions.

1. **Conversion Era:** research and existing-industry conversion; security and legitimacy pressure.
2. **Recursive Industry Era:** requires a closed enough factory ecology across energy, robots, resources, maintenance, and governance.
3. **Solar-System Expansion Era:** requires orbital industrial capacity; introduces transit, heat, debris, resource, and control-latency constraints.
4. **Post-Dyson Opening:** the first swarm ignition threshold is nonterminal. It unlocks energy allocation, heat rejection, light-lag governance, digital-person rights, and branch-civilization decisions.

The UI labels the Dyson value as progress toward the **first ignition threshold**, not percentage completion of all possible stellar capture.

## Decisions, warnings, and recovery

- The core loop is choosing a sustained posture, funding cross-axis programs, and resolving authored critical events—not repeating a production click.
- Every material change exposes what changed, its causal drivers, what it enables or threatens, and a recovery move.
- Capture, industrial cascade, resource lock, and misalignment require a visible paused warning and countdown before terminal loss.
- Recovery is costly and may trade speed or capability for control, but must be effective before the announced point of no return.
- Passive play can lose to rival capture; over-acceleration can lose to misalignment; safety or governance investment can stall. None is an automatic outcome detached from current state.

## Evidence and copy

- The supplied Japanese article is a reference synthesis, not primary evidence.
- Source UI separates primary research, research synthesis/model, reference article, and game inference.
- Each linked claim shows a caveat describing what the source does not establish and the game variables it informs.
- Named-person p(doom values and claims of timeline consensus are excluded. The game shows a rules-derived **catastrophic risk band** and its drivers, not an objective probability.
- Calendar ranges, Mercury disassembly, rapid swarm schedules, and cross-domain acceleration multiplications must be described conditionally.

## Acceptance criteria

1. A fresh browser session shows an explicit Standard / AGI Pill selector; a running mode remains visible.
2. Legacy Standard v1/v2 and current Standard saves still load; a Pill save round-trips through its independent key; resetting one leaves the other.
3. Pill state is deterministic and invariant-bounded under focused fixtures and batch simulation.
4. Energy-, resource-, experiment-, assurance-, social-, and governance-limited fixtures name the correct bottleneck.
5. At least two human-like strategies reach a true post-Dyson positive ending across representative seeds; passive never auto-wins and no policy owns 60% or more of shared-seed best scores.
6. Capture, accident, misalignment, and stagnation outcomes expose prior warnings and causal endings; the recovery ledger contains effective examples.
7. Dyson ignition changes the visible scale and remains nonterminal; at least four post-Dyson programs/events remain visible or actionable.
8. English and Japanese cover mode selection, all axes, events, programs, sources, warnings, rivals, post-Dyson UI, and results.
9. Desktop 1440×900 and landscape mobile 844×390 retain mode, time, bottleneck, policy, current decision/warning, and speed controls without horizontal page overflow.
10. `npm run check`, production build, the complete Standard suite, independent real-browser paths for both modes, policy report, Cockpit A/B/C dispositions, fresh-context audit, evidence artifacts, atomic commits, and branch push all succeed before goal completion.
