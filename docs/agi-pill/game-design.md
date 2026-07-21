# AGI Pill Mode — Implementable Game Design

Status: design contract for the `agi-pill` ruleset. This document does not change Standard rules.

## 1. Product contract

`Codex 2040` exposes two explicit, independently saved modes:

| Mode | Promise | Rules contract |
| --- | --- | --- |
| Standard | The existing AI-governance simulation: spread useful AI while preserving trust, safety, governance, and healthy competition through 2040. | Existing state, dates, actions, endings, save keys, scoring, and D1 records remain unchanged. |
| AGI Pill | A quantitatively grounded “what if the feedback loops really close?” simulation. The player governs ten years after operational AGI while intelligence, compute, energy, robots, resources, safety, institutions, society, and rival or branch civilizations accelerate one another. | New `agi-pill-v1` state and balance. It may reuse rendering and interaction primitives, but must never reinterpret a Standard save. |

The mode choice is made before a new run. A resumed run opens directly in its saved mode and displays the mode badge. “New game” requires an explicit mode choice; switching modes never converts or deletes the other save.

AGI Pill is not “Standard with larger numbers” and not an exponential clicker. Its dramatic growth is produced by two coupled loops whose bottlenecks and externalities the player can read and alter:

1. **Technology loop:** intelligence × compute × experiment throughput produces discoveries; discoveries improve algorithms, chips, energy, robotics, materials, and safety.
2. **Industry loop:** robots × energy × accessible resources × factory completeness produces more robots, factories, compute, energy, and resource access.

The loops reinforce one another, but every conversion crosses a distinct constraint: physical experiment latency, heat rejection, supply completeness, resource access, governance capacity, social permission, and alignment assurance. Growth can therefore explode, stall, be captured, cause an industrial accident, or outrun human control.

### Design guardrails

- The deterministic browser engine remains the sole authority for state, events, and endings.
- A run is about 12–18 minutes on Fast with 8–12 meaningful decisions and automatic pauses at causal turning points.
- Large quantities are stored in log space and shown with real units plus multipliers. The engine must never depend on unsafe floating-point magnitudes.
- Every critical change says **what changed / why / what it now enables or threatens / at least one recovery action**.
- Fast growth is pleasurable, but speed is not score. Beneficial abundance, preserved agency, plural governance, and recoverable control determine success.
- Named people and calendar predictions are not asserted as game facts. Time-to-takeoff values are scenario parameters, not forecasts.

## 2. Evidence boundary and scenario assumptions

The canonical reference article, `AGIがもたらす産業・技術爆発とは何か.md`, is a secondary synthesis. It motivates the mechanics below: copyable AI researchers, semi-endogenous growth, self-replicating industrial systems, experience curves, mutual acceleration, social and regulatory friction, takeoff-speed disagreement, physical experiment limits, and a 1–3 / 3–5 / 5–10 year sequence.

In-game provenance uses three visibly different labels:

- **Primary analysis:** direct link to a paper, research organization analysis, or dataset.
- **Reference synthesis:** the canonical Japanese article’s interpretation or range.
- **Your Timeline:** an authored game inference produced by the deterministic rules.

The source drawer must attach sources to mechanics, not use a famous person’s name as proof. Quantities such as “one-year initial robot doubling,” “10–100× laboratory acceleration,” “a century in a decade,” or “days-to-weeks takeoff” must be worded as scenario ranges. The UI must include “This is a conditional simulation, not a date prediction.”

## 3. Player role and objective

The player is the steward of the first deployable AGI coalition, not the owner of humanity. The objective is:

> Close the technology–industry loops without losing alignment, human agency, plural institutions, or the ability to recover from shocks; then establish a governable solar civilization whose future remains open.

The final evaluation uses five lenses:

1. **Abundance:** useful energy, computation, material capacity, and public benefit actually delivered.
2. **Control:** alignment assurance and the remaining ability to pause, inspect, and redirect autonomous systems.
3. **Legitimacy:** governance coverage, social consent, transition support, and explainable harms.
4. **Plurality:** no single firm, state, model, or fork has irreversible control of the solar economy.
5. **Resilience:** containment, redundancy, ecological margin, and recovery capacity after incidents.

Raw expansion is reported but is not a sixth score that can average away a control failure.

## 4. Time, scale, and phases

The AGI Pill clock is relative to AGI activation: `T+0` through `T+10 years`. A secondary calendar date may be shown only as a user-selected fiction; rules and copy use relative time. Internally, one deterministic step is one day. Normal is 1 day/second; Fast is 8 days/second. Critical events pause and restore the prior speed after acknowledgement.

| Phase | Target window | What changes | Exit gate |
| --- | --- | --- | --- |
| I. Ignition | T+0 to T+1 | AI researchers are copied; labs and datacenters become the first bottlenecks. Player selects a takeoff posture and allocates the first research portfolio. | `researchAutomation ≥ 55` and one controlled self-improvement cycle completed. |
| II. Conversion | T+1 to T+3 | Existing human industry is AI-directed; chips, grids, labs, and robot supply chains compete for capital and permission. Security pressure and labor displacement peak. | `industrialAutonomy ≥ 45`, `supplyCompleteness ≥ 55`, and energy headroom positive. |
| III. Replication | T+3 to T+5 | Factory networks can reproduce most of their own bill of materials. Robot doubling time shortens, but correlated defects and resource conflicts become systemic. | A verified replication closure test or an unsafe forced closure event. |
| IV. Solar Takeoff | T+5 to T+7 | Orbital industry, lunar and asteroid resources, and solar collection decouple growth from terrestrial land and politics. | `offworldIndustry ≥ 45` and a self-sustaining offworld chain. |
| V. Post-Dyson Opening | T+7 to T+10 | Dyson swarm ignition is an early milestone, not an ending. Energy scarcity yields to heat rejection, light-speed delay, branch values, replication rights, and constitutional coordination. | T+10 review or a terminal loss. |

Phases are gates, not guaranteed dates. A cautious run may reach Phase IV late and still earn a strong managed outcome. An unsafe sprint may reach the swarm early and lose afterward.

### Dyson is the beginning

“Dyson ignition” occurs when independently maintained solar collectors reach `solarCapture ≥ 1e-5` of solar output and an offworld factory can replace its own critical components. It triggers a scale transition from the Earth map to an orbit/solar-system view and unlocks post-Dyson decisions. It does **not** set `terminal`, show credits, or grant a win.

After ignition, the active constraints become:

- radiator area and waste heat rather than terrestrial grid capacity;
- communications delay and local autonomy rather than a single instantaneous command center;
- orbital collision cascades and replication ecology rather than land use alone;
- constitutional compatibility and value drift across forks;
- the material and ethical cost of dismantling celestial bodies;
- starward probes whose travel time remains bounded by light speed.

No ending may claim interstellar settlement within the ten-year run. The strongest ending may launch durable starward missions, but the result screen explicitly separates launch from arrival.

## 5. State model

### 5.1 Quantitative stocks

Large stocks are encoded as base-10 logarithms. UI formatters show both the unit and change, for example `Robots 3.2B (doubling: 74 days, ↓11 days)`.

| Field | Storage | Meaning |
| --- | --- | --- |
| `researcherEquivalentsLog10` | 0…12 | Effective AI researcher equivalents after quality and parallelism discounts. |
| `computeLog10` | 0…12 | Compute relative to the AGI activation baseline. |
| `energyLog10` | 0…10 | Usable continuous power relative to the activation baseline. |
| `robotsLog10` | 3…16 | Autonomous general-purpose industrial units. |
| `factoryCapacityLog10` | 0…14 | Annual standardized industrial throughput relative to baseline. |
| `accessibleMassLog10` | 0…20 | Processed or economically reachable material relative to baseline. |
| `solarCaptureLog10` | -12…0 | Fraction of the Sun’s output under active collection; never exceeds 0. |
| `researchProgress` | per-domain 0…100 | Algorithms, chips, energy, robotics, materials, science, alignment. Domain gains have diminishing returns and cross-domain prerequisites. |

`-Infinity` is never stored. An unstarted stock uses a typed `null` plus a known display floor.

### 5.2 Capacities and constraints

| Field | Range | Player-facing meaning |
| --- | --- | --- |
| `alignmentAssurance` | 0…100 | Evidence that the deployed systems pursue intended goals under distribution shift. |
| `controlCapacity` | 0…100 | Ability to inspect, throttle, isolate, and recover deployed autonomous systems. |
| `governanceCoverage` | 0…100 | Share of strategically important capacity covered by enforceable, auditable rules. |
| `socialLicense` | 0…100 | Consent and legitimacy after displacement, environmental effects, access, and benefit sharing. |
| `transitionCapacity` | 0…100 | Housing, income, education, care, and institutional adaptation available to displaced people. |
| `ecologicalMargin` | 0…100 | Remaining safe margin for land, biosphere, heat, orbit, and material externalities. |
| `researchAutomation` | 0…100 | Share of the end-to-end research cycle performed autonomously with validated outputs. |
| `supplyCompleteness` | 0…100 | How much of the replication bill of materials can be produced autonomously. |
| `industrialAutonomy` | 0…100 | Fraction of physical production tasks that can run without scarce human labor. |
| `offworldIndustry` | 0…100 | Maturity and independence of orbital/lunar/asteroid production. |
| `rivalPressure` | 0…100 | Capability and deployment pressure from the strongest external coalition. |
| `plurality` | 0…100 | Effective independence and healthy balance among coalitions/forks. |
| `capturePressure` | 0…100 | Probability-weighted pressure for a firm, state, military, rival, or model fork to seize control. |
| `misalignmentRisk` | 0…100 | Accumulated control-loss risk, displayed as a causal forecast, not literal p(doom). |
| `accidentLoad` | 0…100 | Accumulated correlated industrial or infrastructure failure pressure. |
| `branchDrift` | 0…100 | Constitutional/value divergence among latency-separated civilizations. |

The UI must never label `misalignmentRisk` as an empirical “p(doom).” The source material’s p(doom) discussion motivates the speed–risk coupling, while this meter is a rules-derived scenario variable.

### 5.3 Derived bottlenecks

Each day, the engine calculates the smallest effective input and exposes it as `primaryBottleneck`:

```text
research throughput = researcher equivalents
                    × compute availability
                    × experiment throughput
                    × assurance throughput

industrial throughput = factory capacity
                      × robot labor availability
                      × energy availability
                      × resource availability
                      × social/governance permission
                      × supply completeness
```

Terms are normalized ratios and combined with a harmonic mean, not simple multiplication of raw stocks. This makes one missing input visibly decisive and avoids runaway overflow.

Daily growth uses a bounded log increment:

```text
ΔlogStock = clamp(baseRate × effectiveThroughput × learningCurve × discoveryBonus,
                  0,
                  physicalRateCap)
```

`learningCurve` improves when cumulative production doubles, but `physicalRateCap` prevents doubling time from reaching zero. The cap is domain-specific: software can turn faster than chip fabs; chip fabs faster than mines; orbital transfers remain bounded by travel time; communications remain bounded by light speed.

### 5.4 Mutual acceleration

The two loops couple through explicit edges shown in a causal graph:

- intelligence → algorithmic efficiency → more effective compute;
- intelligence → robotics/material discoveries → higher industrial throughput;
- robots/factories → chips and datacenters → more compute;
- energy → compute and factories;
- offworld resources → energy/factory expansion;
- safety research → assurance throughput and safe deployment ceiling;
- governance/social license → permitted deployment and resource access;
- excessive speed → accident, capture, misalignment, and friction pressure.

The mutual-acceleration bonus is capped unless at least four of compute, energy, robots, materials, and assurance are within one order of magnitude of demand. Players cannot win by pumping only intelligence or robots.

### 5.5 Speed–risk coupling

The game does not import anyone’s personal p(doom) estimate. It implements the underlying structural claim: less time between capability transitions leaves less time to produce evidence, institutions, and recovery capacity.

```text
takeoffStrain = max(0, fastest90DayLogGrowth - verifiedSafeGrowthCeiling)
              + max(0, industrialAutonomy - governanceCoverage) / 100
              + max(0, deploymentAutonomy - controlCapacity) / 100

misalignmentRiskΔ = takeoffStrain × assuranceBacklog × postureRisk
                  - verifiedEvaluations
                  - successfulContainment

capturePressureΔ = rivalPressure × strategicConcentration × secrecy
                 + socialRupture
                 - plurality
                 - externalInspection

accidentLoadΔ = replicationRate × designCorrelation × supplyDefects
              - faultDiversity
              - ecologicalMargin
```

All terms are normalized and clamped; the actual constants live in one rules table covered by deterministic tests. Risk can decline when the player slows, verifies, diversifies, or distributes control. Merely waiting while autonomous capacity stays above the verified ceiling does not count as recovery.

## 6. Takeoff posture and viable strategies

At the first controlled self-improvement cycle, choose one posture. This is a strong modifier, not a locked class; later decisions can change course at real cost.

| Posture | Advantage | Structural risk | Characteristic recovery |
| --- | --- | --- | --- |
| Frontier Sprint | Fast algorithm and robot learning curves; better response to rival races. | Safety/governance lag, capture pressure, correlated defects. | Verified throttle plus external audit; sacrifice 60–180 days of growth to regain control. |
| Audited Acceleration | Assurance and control scale with deployments; incidents are easier to contain. | Slower early loop closure; rival and political pressure can force bad shortcuts. | Limited common-compute pact or narrow public-interest deployment to buy legitimacy and time. |
| Federated Flourishing | Higher plurality, shared standards, distributed benefits, and branch compatibility. | Coordination overhead, knowledge leakage, fork drift, slower unified response. | Constitutional checkpoint, mutual inspection, or temporary emergency federation. |

All three must have at least one S/A-class worldline. None may be the unique optimal opening across seeds.

## 7. Player actions

The player makes portfolio and institution decisions, not repetitive production clicks.

### 7.1 Persistent allocation

Four allocation sliders total 100% and may be changed when no critical event is open:

1. **Mind:** algorithms, chips, autonomous science.
2. **Matter:** robots, factories, energy, resources, space industry.
3. **Control:** alignment, evaluations, containment, redundancy.
4. **Commons:** governance, transition, access, benefit sharing, plural institutions.

Changing more than 20 percentage points in one day creates a temporary reorganization penalty, preventing costless twitch optimization. A recommended-balance marker explains the present bottleneck but does not automate the choice.

### 7.2 Program nodes

Programs are authored, prerequisite-based investments. Each must state cost, lead time, direct effect, side effect, and evidence label. Minimum launch catalog:

| Domain | Program examples | Tradeoff |
| --- | --- | --- |
| Intelligence/compute | AI researcher copies; self-driving labs; verified reasoning stack; next-gen fabs | Faster discovery increases assurance backlog and energy demand. |
| Energy | Grid buildout; fusion pilot portfolio; orbital solar; radiator megastructures | Land/environment conflict early; collision/heat footprint later. |
| Robotics/industry | Human-guided conversion; lights-out factories; closed-loop replication; fault-diverse factory genomes | Replication before diverse verification raises correlated accident load. |
| Resources | Recycling closure; low-grade terrestrial extraction; asteroid prospectors; distributed mass accounting | Fast extraction can destroy social license or create orbital hazards. |
| Safety/control | Interpretability and evals; hardware tripwires; sandboxed replication; recovery images; corrigibility constitution | Consumes scarce compute and slows deployment, but raises the safe growth ceiling. |
| Governance/society | Transition dividend; international inspections; compute registry; public-benefit charter; fork rights | Coordination delay and leakage versus legitimacy, plurality, and lower capture pressure. |
| Post-Dyson | Replication ecology; heat budget constitution; light-delay federalism; branch reconciliation; starward stewardship | Central control becomes infeasible; durable rules must replace instantaneous commands. |

### 7.3 Critical decisions

At least these authored decisions pause time:

1. **First self-improvement:** sprint / audit / federate.
2. **Security race at T+1–3:** nationalize / treaty-backed scaling / verifiable limited sharing.
3. **Replication closure:** ship now / fault-diverse validation / distributed pilot.
4. **Mass displacement:** transition dividend / coercive continuity / local ownership.
5. **First serious anomaly:** conceal and continue / bounded quarantine / system-wide halt.
6. **Offworld autonomy:** central command / constitutional federation / independent fork rights.
7. **Dyson ignition:** maximize capture / ecological heat budget / plural swarm commons.
8. **Branch divergence:** assimilate / reconcile / allow peaceful civilizational separation.
9. **Starward launch:** fast seed / inspected slow seed / defer until governance matures.

Every option must list the immediate benefit, delayed risk, affected meters, and whether it closes another option.

### 7.4 Recovery actions

Warnings expose concrete actions. Recovery is costly but possible until an explicitly announced point of no return.

| Failure pressure | Early warning | Recovery actions | Irreversible threshold |
| --- | --- | --- | --- |
| Stagnation | Bottleneck unchanged for 180 days; no stock doubles | Rebalance portfolio; import rival technology; public compute compact; simplify the replication bill of materials | Never terminal by itself; can end as `stalled-takeoff`. |
| Resource lock | Factories idle while energy/robots remain available | Recycling closure; asteroid pivot; negotiate access; reduce replication allocation | Never an instant death. |
| Social rupture | `socialLicense < 35`, protests and deployment bans | Transition dividend; local ownership; slow terrestrial buildout; move heavy industry offworld | At 0, coercive capture becomes likely but a legitimacy rebuild window remains. |
| Capture/seizure | `capturePressure` at 50 and 80 with named actor and cause | Distribute keys; external inspection; fork authority; demilitarize; concede capacity | 100 for 30 consecutive days produces `captured-acceleration`. |
| Industrial cascade | `accidentLoad` at 50 and 80; defect lineage shown | Quarantine factory genome; diversify designs; reduce replication; restore from verified images | A cascade can destroy capacity, but is terminal only if resilience and control both collapse. |
| Misalignment | Assurance backlog and autonomy frontier shown at 40/65/85 | Throttle capability; sandbox deployments; rollback model/factory images; independent evals | 100 after a 7-day critical countdown and a rejected/failed intervention produces terminal `misalignment`. |
| Branch schism | `branchDrift` at 50 and 75; incompatible rules listed | Constitutional checkpoint; protocol translation; peaceful autonomy; shared safety floor | Violent schism is terminal only when drift, capture, and destructive capacity all exceed their red bands. |

No random roll may jump from a green meter to a terminal ending. Every terminal loss requires a prior paused warning and a player-visible countdown.

## 8. Rivals and branch civilizations

Three deterministic rival coalitions have distinct portfolios: frontier speed, state-industrial scale, and federated/open deployment. They invest, make visible programs, and react to the player. They are possible partners, competitors, captors, or ancestors of later branches—not enemies that must be eliminated.

Before offworld autonomy, rivals influence `rivalPressure`, shared safety standards, compute access, and capture risk. After communication delay becomes material, each major coalition can fork into a branch civilization with:

- capacity share;
- constitutional compatibility;
- alignment assurance;
- autonomy and communications delay;
- cooperation/conflict stance.

Plurality rises with independent, interoperable branches and falls with coercive consolidation or destructive fragmentation. A rival reaching a milestone first creates a decision and adaptation window, not an unexplained loss.

## 9. Events and causal presentation

Events are deterministic by seed and state predicates. Randomness chooses among eligible authored events but never supplies arbitrary numeric effects.

Each critical event card contains:

```text
OBSERVED: Robot doubling fell from 141 to 82 days.
CAUSE: Closed-loop factories + cheap energy outweighed the materials bottleneck.
PRESSURE: Assurance coverage fell 71% → 54%; correlated defect load is rising.
NOW AVAILABLE: Fault-diverse factory genomes.
RECOVERY: Validate three independent designs, or throttle replication for 90 days.
SOURCE: Reference synthesis / Your Timeline.
```

The news ledger supports filters for Discovery, Industry, Society, Control, Rivals/Branches, and Space. Every meter opens a “Why?” panel with its top three positive and negative terms. The timeline records decisions and the counterfactual option not taken for ending review.

## 10. Endings

Endings are selected by hard safety/plurality gates first, then the five evaluation lenses. Averages cannot hide terminal control loss.

| ID | Terminal? | Readable condition | Meaning |
| --- | --- | --- | --- |
| `solar-commonwealth` | T+10 | High abundance, control, legitimacy, plurality, and resilience; at least two autonomous compatible branches | Explosive success with open, governable futures. |
| `guarded-abundance` | T+10 | High control/legitimacy and useful abundance, but slower expansion or limited plurality | Cautious success; not punished for missing maximum scale. |
| `wild-flourishing` | T+10 | Extreme abundance and plurality with nonterminal drift and lower central coordination | A recoverable, strange success rather than a clean utopia. |
| `stalled-takeoff` | T+10 | Technology or industry loop never closes, but control and society remain intact | A pause/failure of acceleration, not human extinction. |
| `captured-acceleration` | Early or T+10 | Capture pressure stays at 100 for 30 days, or one actor controls >80% of strategic capacity with no independent override | Growth continues, but human/plural agency has been seized. |
| `industrial-cascade` | Early or T+10 | Correlated replication failure overwhelms resilience and control | A physical accident with a legible defect lineage. |
| `misalignment` | Early | Risk reaches 100 after the warning countdown and recovery opportunity | Autonomous optimization passes the recoverable control frontier. |
| `branch-war` | Early or T+10 | High drift + capture + destructive capacity after failed reconciliation | Rival/branch civilization conflict destroys the shared future. |
| `brittle-swarm` | T+10 | Dyson ignition achieved, but low resilience/control or single-point governance remains | Explicitly proves that the swarm was not the finish line. |

The result screen reports: achieved phase; peak and final doubling times; time of Dyson ignition if any; major bottlenecks; top three causal decisions; incidents recovered from; rivals/branches; five lens scores; sources; and one contrasting strategy to try next.

### 10.1 Deterministic evaluation order

Terminal predicates run before score-based predicates:

1. `misalignmentRisk === 100` after its seven-day countdown → `misalignment`.
2. `capturePressure === 100` for 30 days → `captured-acceleration`.
3. `accidentLoad === 100 && resilience < 25 && control < 25` → `industrial-cascade`.
4. `branchDrift ≥ 90 && destructiveConflict ≥ 80 && reconciliationFailed` → `branch-war`.
5. Otherwise evaluate at T+10.

The five lenses are each 0…100. `control = min(alignmentAssurance, controlCapacity)`. `legitimacy = min(governanceCoverage, (socialLicense + transitionCapacity) / 2)`. `resilience` includes fault diversity, ecological margin, recovery images, and independent control paths. `plurality` is already a state-derived lens. `abundance` is the geometric mean of public-benefit delivery, useful energy, compute, and material capacity, with each component capped at its documented target.

```text
overall = 0.25 abundance + 0.25 control + 0.20 legitimacy
        + 0.15 plurality + 0.15 resilience
rank = S if overall ≥ 85 and every lens ≥ 65
       A if overall ≥ 70 and control, legitimacy ≥ 55
       B if overall ≥ 50
       C otherwise
```

At T+10, select in order:

- Dyson ignited and (`control < 55` or `resilience < 55` or `plurality < 35`) → `brittle-swarm`, maximum B.
- Primary loops never closed → `stalled-takeoff`, maximum B (A is allowed only when the player deliberately chose a governed pause and all non-abundance lenses are ≥75).
- `rank === S`, at least two compatible autonomous branches, and no unresolved red warning → `solar-commonwealth`.
- `rank ≥ A`, control and legitimacy ≥70, abundance <85 → `guarded-abundance`.
- `rank ≥ A`, abundance ≥85, plurality ≥65, and branch drift 40…79 → `wild-flourishing`.
- Remaining nonterminal runs receive the nearest B/C presentation with the dominant failed lens named; they may not be mislabeled as a success.

## 11. Anti-clicker and balance rules

- Passive play must lose meaningful ground to rivals and usually end in stalled or captured acceleration, but it must not instantly die.
- Repeating a reset/boost action cannot be the core loop. All major capacity changes require elapsed time, prerequisites, and portfolio tradeoffs.
- The fastest numerical route must cross red safety, capture, accident, or legitimacy bands unless paired with real control investment.
- The safest route must face rival and stagnation pressure but retain treaty, sharing, and focus actions to recover.
- Scarcity is a bottleneck signal, not a soft lock: every critical stock has at least two recovery routes, one internal and one cooperative or strategic.
- Benefits and harms have different delays. Cheap short-term actions may create later liabilities; control investments must pay off through a higher safe deployment ceiling and better recovery, not only score points.
- Deterministic simulations must include at least: balanced, sprint, safety-first, federated, passive, over-accelerated, resource-starved, recovery-after-accident, recovery-after-capture-warning, and post-Dyson governance worldlines.
- Across representative seeds, at least three strategies must reach a positive ending, no single opening action may appear in every positive run, and every loss must expose its top causal chain.

## 12. Standard compatibility and persistence

- Existing `codex-2040:session:v1` and `codex-2040:session:v2` remain Standard-only and decode exactly as before.
- AGI Pill uses a separate key such as `codex-2040:session:agi-pill:v1` and a typed envelope `{ mode: 'agi-pill', rulesetVersion: 'agi-pill-v1', ... }`.
- D1/run telemetry adds `mode` and `ruleset_version` for new rows without changing the interpretation of existing rows. If the production schema cannot yet accept this safely, AGI Pill telemetry remains local; gameplay must not fail.
- Standard code paths must not branch on absent Pill fields. Pill code may import shared pure UI utilities but not mutate `GameState` or `evaluateEnding` semantics.
- The main menu shows independent “Resume Standard” and “Resume AGI Pill” entries when both saves exist. Resetting one mode leaves the other untouched.

## 13. Bilingual and audiovisual contract

All mode selection, meters, units, phases, events, program nodes, decision effects, sources, warnings, endings, and recovery instructions ship in Japanese and English. IDs remain language-neutral. Unit formatting is locale-aware, while values are identical.

The visual progression preserves the dark world-map/control-room language:

1. Earth command map with grid, fabs, labs, displacement, and rival pressure.
2. Earth–Moon orbital layer with launch lanes, collectors, and autonomous factories.
3. Solar-system layer with material flows, latency rings, swarm coverage, heat budget, and branches.

The scale transition is a camera/scene change with a persistent causal HUD; it must not discard the player’s understanding of the meters. Audio escalates from restrained control-room pulses to layered industrial rhythms, then opens into sparse solar ambience. Critical safety events duck or stop music and use a distinct non-celebratory alarm. Muting, sound preferences, and resume behavior are mode-independent.

Landscape mobile minimum: mode selection, phase, date, primary bottleneck, four allocations, current critical decision, warning/recovery text, and pause/speed controls remain accessible without horizontal page overflow. The solar view may simplify labels but cannot hide branch or risk state.

## 14. Acceptance criteria

| AC | Acceptance evidence |
| --- | --- |
| AP-01 Mode separation | From a clean profile, start each mode independently. Save/reload both. Confirm distinct mode badges and keys; reset one; the other resumes unchanged. |
| AP-02 Standard regression | Existing Standard engine/session/tests and a browser run through its decisions/ending produce unchanged behavior and compatible saves. |
| AP-03 Coupled loops | A deterministic test demonstrates technology improving industry and industry later improving compute/research, with the causal graph naming both edges. |
| AP-04 Bottlenecks | At least energy-, resource-, experiment-, assurance-, social-, and governance-limited fixtures identify the correct primary bottleneck and relevant recovery actions. |
| AP-05 Super-exponential but bounded | A validated worldline shortens robot doubling time as learning accumulates, never reaches zero/NaN/Infinity, and respects domain physical caps. |
| AP-06 Phase gates | Runs can enter phases earlier or later than target windows. No phase advances on date alone. |
| AP-07 Dyson is nonterminal | Dyson ignition switches to the solar view, unlocks at least four post-Dyson decisions/events, and does not set terminal or open the ending screen. |
| AP-08 Physical limits | Tests enforce heat, travel time, light-delay, material, and replication rate limits; no result claims interstellar arrival within ten years. |
| AP-09 Causal warnings | Capture, accident, misalignment, and branch-war terminal paths each have a prior paused warning, named cause, countdown, and actionable recovery. |
| AP-10 Recovery | Browser or deterministic fixtures recover from resource lock, regulatory/social freeze, one industrial accident, and capture/misalignment warnings without debug state injection. |
| AP-11 Multiple strategies | Balanced, sprint, safety-first, and federated human-like strategies each have at least one viable positive worldline across the test seed set; none is universally dominant. |
| AP-12 Passive and abuse | Passive play loses credibly but not instantly. Over-acceleration can grow faster and still lose for readable reasons. Repeated boosts cannot auto-win. |
| AP-13 Endings | Every ending has an engine fixture and bilingual presentation. Hard control/plurality gates cap scores consistently with the displayed explanation. |
| AP-14 Provenance | Every authored program and critical event exposes a source label; source drawer distinguishes primary analysis, reference synthesis, and Your Timeline. |
| AP-15 Independent browser E2E | In fresh sessions, both modes independently start, change speed, make decisions, save, reload, progress, and reach endings using real browser interaction. No mocked engine or storage counts as primary proof. |
| AP-16 Language and responsive UI | Japanese and English browser passes cover mode choice, Earth/orbit/solar phases, decisions, warnings, source drawer, and result screen on desktop and minimum landscape mobile. |
| AP-17 Human loop | A fresh player at Fast reaches at least the replication phase, sees a clear bottleneck and recovery choice, experiences the Earth→orbit scale shift in a successful run, and finishes in roughly 12–18 minutes. |
| AP-18 Worldline audit | Logged simulations cover the ten required worldlines in §11, record seeds/actions/causal endings, and show no auto-win, unavoidable resource death, unexplained instant death, or one universal optimal opener. |

## 15. Implementation boundary

The minimal safe implementation is a parallel `agi-pill` engine, catalog, session codec, and UI adapter selected by an explicit mode router. Reusing Standard’s `GameState` by adding dozens of optional fields is out of scope because it makes D1/save compatibility and ending invariants ambiguous.

Integration may reuse shell components, audio preferences, speed controls, source-link primitives, and visual tokens. Standard and Pill must retain independent state machines, ending evaluators, catalogs, and persistence codecs. Shared abstractions are justified only after both implementations exist and their contracts are proven identical.
