# AGI Pill Mode: research and source map

Status: design input, not a forecast. Last checked: 2026-07-21 (JST).

## Purpose and evidence labels

This note translates the supplied Japanese essay, `AGIがもたらす産業・技術爆発とは何か.md`, into game mechanics without presenting its scenario as consensus fact. The essay was read in full, including its appendices. It is a valuable scenario synthesis, but not itself a primary source.

Evidence labels used below:

- **P — primary analysis/data:** original paper, model, dataset, or official scientific source. A P label does not mean the conclusion is established; Forethought and Epoch reports contain explicit scenario assumptions and judgement calls.
- **S — secondary synthesis:** the supplied essay's summary of other work, interviews, or historical analogy.
- **A — author inference/speculation:** a conclusion that goes beyond the cited source, an uncited numerical bridge, or a narrative projection.

Game copy should expose those labels as **Model / Evidence / Scenario** rather than “true / false”. Any number controlled by uncertain assumptions must be shown as a range or scenario setting, never as a named person's prediction.

## Claim audit and game-facing translation

| Topic and claim in the essay | Class | Primary-source check and caveat | Game variable or rule | Player-facing label |
|---|---|---|---|---|
| AI research labour can be copied much faster than human research labour; the essay uses about 25x/year versus about 4%/year. | P-backed scenario | [Forethought, *Preparing for the Intelligence Explosion*](https://www.forethought.org/research/preparing-for-the-intelligence-explosion) derives 25x/year from roughly 10x inference-efficiency improvement times 2.5x inference-compute growth. It explicitly assumes trends continue to human/AI research parity and describes larger figures as guesses. | `aiResearchCapacity`, `inferenceEfficiency`, `computeCapacity`; growth is capped by energy, chips, experiment throughput, coordination, and safety overhead. | **AI研究能力 / AI Research Capacity**; tooltip: “モデル仮定。計算資源と効率の積” |
| A century of technological progress could be compressed into less than a decade. | P scenario, not measured fact | The same Forethought report argues for this conditional outcome and stresses asymmetric acceleration and slower experiment-heavy fields. The phrase is a scenario conclusion, not an empirical forecast. | `knowledgeStock` grows by field; software/math advance faster than medicine, heavy engineering, or deployment. Never award “100 years” as a single meter. | **研究圧縮率 / Research Compression** with a range and source button |
| Research productivity declines as ideas get harder to find. | P empirical, extrapolation uncertain | [Bloom et al., AER 2020](https://www.aeaweb.org/articles?id=10.1257/aer.20180338) documents rising research effort and falling productivity, including over 18x more researchers to sustain Moore's law. It does not establish post-AGI returns. | `researchDifficulty[field]` rises with progress; parallel researchers suffer diminishing returns. Better tools, data, and experiment design can partially offset it. | **研究難度 / Research Difficulty** |
| Software self-improvement can create a fast intelligence takeoff. | P model with wide subjective uncertainty | [Davidson & Houlden, 2025](https://www.forethought.org/research/how-quick-and-big-would-a-software-intelligence-explosion-be) estimates about 60% for >3 years of recent AI progress compressed into <1 year and about 20% for >10 years, while calling the model speculative and heavily judgement-dependent. Compute is held fixed in the model. | `softwareTakeoffRate` is selected or revealed from a distribution; it depends on `softwareReturns`, `experimentCompute`, and `distanceToSoftwareCeiling`. | **テイクオフ速度 / Takeoff Speed**: Gradual / Fast / Discontinuous; “scenario parameter” badge |
| Fixed compute may substantially limit algorithm-only gains. | P analysis, contested | [Epoch AI, *How fast can algorithms advance capabilities?*](https://epoch.ai/gradient-updates/how-fast-can-algorithms-advance-capabilities) examines compute-dependent algorithmic progress. Treat this as a counterweight to software-only takeoff, not a settled ceiling. | Low `experimentCompute` causes a software plateau; new fabs, energy, data, or experimental systems reopen progress. | **実験計算ボトルネック / Experiment Compute Bottleneck** |
| “Self-replicating robots” means a whole industrial ecology reproducing its productive capacity, not a humanoid literally cloning itself. | P scenario definition | [Forethought, *The Industrial Explosion*](https://www.forethought.org/research/the-industrial-explosion) explicitly describes an array of factories and actuators collectively producing the machines that reproduce the system. | `industrialClosure` measures how much of mining, refining, parts, assembly, maintenance, logistics, and energy is autonomously closed. Replication unlocks only above a closure threshold. | **産業閉鎖率 / Industrial Closure**; avoid “one robot clones itself” art/copy |
| Initial autonomous industrial doubling might be around one year. | P back-of-envelope estimate | Forethought's two rough approaches produce about one year under abundant AI cognition and current physical technology, but its more cautious summary says “a few years” and lists factory construction and cost penalties. | `initialIndustrialDoublingMonths` should default to a broad band (12–36 months), altered by bottlenecks. Do not hard-code one year as fact. | **初期倍増時間 / Initial Doubling Time**; show uncertainty band |
| Learning/experience curves could shorten doubling times, creating super-exponential growth. | P-supported mechanism; magnitude uncertain | Forethought finds no trustworthy robot-specific curve and extrapolates from related industries; it estimates 1–5 production doublings per halving of cost. The essay's finite-time “divergence” is mathematical extrapolation, not a physical prediction. | `learningRate` lowers unit cost only after cumulative production; floors from heat, transport, defects, scarce inputs, and construction time prevent singularities. | **学習曲線 / Learning Curve** and **物理フロア / Physical Floor** |
| Physical labour could eventually double in days or weeks. | P speculative upper-bound analogy | Forethought uses biological anchors and a rough carrying-capacity calculation, while warning that unmodelled capital types can bottleneck growth. | Late-game `minimumDoublingTime` is an uncertain floor. Reaching it increases defect propagation, control latency, heat, ecological pressure, and accident risk. | **極限倍増時間 / Limit Doubling Time**; “upper-bound scenario” badge |
| Technology and industry mutually accelerate: knowledge improves production, while energy/compute/industry expands research. | P model mechanism, not calibrated fact | Both Forethought reports and [Epoch's review](https://epoch.ai/publications/explosive-growth-from-ai-a-review-of-the-arguments) discuss feedback through substitutable labour and capital. Epoch says explosive growth is difficult to rule out but far from certain. | Two coupled loops: `knowledge -> efficiency/closure` and `energy+compute+labs -> research`. Bottlenecks and governance act on the links, not as arbitrary global debuffs. | **相互加速 / Coupled Acceleration** causal diagram |
| Regulation and social friction can prevent or delay explosive growth; competition can weaken restraint. | P review plus A geopolitical narrative | Epoch identifies regulation, slow automation, alignment, harsher R&D diminishing returns, and unknown bottlenecks as strong objections. The essay's specific US–China wartime path is a scenario, not a sourced inevitability. | `governanceCapacity`, `publicLegitimacy`, `coordination`, `rivalPressure`, and `deploymentFriction`; rivals respond to observed capability and treaties, not a scripted nationality claim. | **統治能力 / Governance Capacity**, **社会摩擦 / Social Friction**, **競争圧力 / Rival Pressure** |
| Takeoff speed structurally changes catastrophe risk because faster change leaves less time to inspect and adapt. | Mechanistic inference; individual p(doom) figures are not comparable measurements | The relationship is plausible but the essay combines non-equivalent personal statements, media reports, and inferred numbers. Do not encode named-person p(doom) values or imply a measured correlation. | `catastropheHazard` is generated from capability, autonomy, control deficit, replication scale, and response time. Show a calibrated band plus drivers, never a magic “doom roll”. | **破局リスク帯 / Catastrophic Risk Band**; “モデル出力・個人予測ではない” |
| 1–3 years: optimization, conversion of existing industry, security pressure. | S/A scenario phase | The essay synthesizes Forethought's AI-directed-human-labour phase with historical mobilization analogies. Dates are illustrative, not sourced milestones. | Phase gate requires existing-capital conversion, trained operators, legitimacy, and supply chains; player can arrive earlier/later. | **転換期 / Conversion Era**; subtitle “典型レンジ 1–3年” |
| 3–5 years: autonomous factories achieve closure and robot production compounds. | S/A scenario phase | No primary source establishes this calendar. It is a useful conditional middle phase. | Phase gate uses `industrialClosure`, maintenance autonomy, energy surplus, and defect control—not elapsed time alone. | **自己増殖産業期 / Recursive Industry Era**; “典型レンジ 3–5年” |
| 5–10 years: off-world replication and solar-system expansion begin. | A scenario projection | Dyson-style energy collection is physically discussable, but this timetable and Mercury-disassembly path are not empirically validated. | Off-world expansion needs launch throughput, in-situ resource utilization, radiation-hard autonomy, communications, and political legitimacy. Multiple asteroid/lunar/Mercury strategies must exist. | **太陽系展開期 / Solar-System Expansion Era**; “シナリオ、予言ではない” |
| A Dyson swarm is a plausible energy-harvesting concept and not the end of civilization's growth. | P concept; construction schedule speculative | Dyson's proposal concerns detectable stellar energy capture/waste heat; modern searches treat partial swarms as hypothetical technosignatures. NASA gives solar luminosity as about 3.83e26 W in its [Universe glossary](https://science.nasa.gov/universe/glossary/). Neither establishes buildability on a 5–10 year schedule. | `stellarCaptureFraction` begins near zero. First swarm milestone unlocks power, heat rejection, orbital coordination, digital-population rights, and branch-civilization problems rather than ending play. | **恒星光捕集率 / Stellar Capture Fraction**; milestone: **序章を越えた / Beyond the Prologue** |
| Solar-system scale removes Earth governance and communications assumptions. | P physical constraint, gameplay inference | NASA notes communications are light-speed limited; Earth–Mars one-way latency is about 4–24 minutes in its [space communications explainer](https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/). | `controlLatency` and `branchAutonomy` grow with distance. Central control becomes slower; local agents/civilizations can diverge, bargain, defect, or federate. | **統制遅延 / Control Latency**, **分岐文明 / Branch Civilization** |
| Material and energy limits are mostly cost limits in the early phase, while true physical limits remain. | P review plus overstatement in essay | Epoch says current resource use is far below theoretical limits, not that constraints “do not exist”. Forethought likewise models energy, land, capital, and raw materials as possible bottlenecks. | Separate `accessibleResources` from total abundance. Extraction energy, purity, location, heat rejection, transit time, and ecological cost determine usable stock. | **可採資源 / Accessible Resources**, not “resources remaining” |
| Existing science can be accelerated 10–100x, and some computational tasks much more. | Mixed P studies and A multiplication | The essay combines field-specific autonomous-lab results, roadmaps, and multiplicative extrapolations. Cross-domain multiplication is not validated as an economy-wide rate. | Each field has `automationFraction`, `experimentParallelism`, `simulationSubstitution`, and an irreducible validation delay. Benefits do not multiply globally without integration work. | **分野別研究加速 / Field Research Acceleration** |

## Core systems implied by the evidence

### 1. Coupled stocks, flows, and bottlenecks

The mode should simulate at least these independently visible stocks:

| Stock | Main inflows | Main constraints and failure signals |
|---|---|---|
| Intelligence/capability | AI research labour, software improvements, training and experiment compute | diminishing returns, data/experiment bottlenecks, evaluation gap, control deficit |
| Compute | fabs, chips, datacentres, algorithmic efficiency | power, cooling, construction, supply concentration, cyber compromise |
| Energy | terrestrial generation, storage, orbital solar, later stellar capture | grid build-out, heat rejection, land/ecology, transmission, intermittency |
| Robot/industrial capacity | converted factories, autonomous factories, learning curves | closure gaps, maintenance, defects, rare process inputs, logistics |
| Accessible resources | mining, recycling, in-situ space resources | extraction energy, refining, ecological damage, transport latency |
| Safety/control | evaluations, interpretability, containment, incident learning | capability growth, autonomy, replication scale, rival secrecy, time pressure |
| Governance/legitimacy | treaties, audits, shared benefits, accountable institutions | social disruption, coercion, inequality, institutional decision latency |
| Rival/branch civilization power | independent R&D, industry, space settlements, digital populations | coordination, communications latency, value drift, resource disputes |

No single stock should be a universal currency. A player with abundant compute but insufficient energy, trusted governance, experiment throughput, or industrial closure should stall in a legible way and retain at least one recovery action.

### 2. Super-exponential growth without an idle clicker

Use shrinking doubling time as an emergent outcome:

`effective doubling time = base construction time × bottleneck multiplier × safety overhead × physical floor / (design efficiency × learning effect)`

The learning effect may improve with cumulative output, but it must saturate. The bottleneck multiplier is the maximum or a soft-minimum of energy, materials, closure, logistics, heat, and governance adequacy. This keeps growth causal: a new smelter, treaty, cooling system, or audit regime changes a named link in the loop.

Three anti-clicker constraints follow directly from the research:

1. **Closure before recursion:** robot count alone cannot self-replicate; the whole industrial ecology must close.
2. **Field-specific knowledge:** software progress does not instantly become a fusion reactor, drug, or launch system.
3. **Control scales slower than production:** faster and more distant systems increase inspection delay, defect propagation, and political autonomy.

### 3. Takeoff and p(doom) representation

Takeoff speed should be a scenario variable whose drivers remain visible:

- returns to software R&D;
- compute available for experiments;
- distance to effective software limits;
- rate of physical automation and industrial closure;
- safety and governance overhead;
- competitive pressure and secrecy.

Replace “p(doom)” as a personality-linked number with a game-native **catastrophic risk band**. It should be derived from at least:

- capability–control gap;
- autonomy and privilege level;
- industrial replication scale;
- monitoring coverage and response latency;
- adversarial/rival pressure;
- known unresolved incidents;
- uncertainty from untested deployment regimes.

Every change in the band needs a short causal explanation, and the player needs recoverable actions (pause one deployment layer, add tripwires, decentralize authority, negotiate verification, reduce privileges, investigate incidents). Some choices should reduce growth but improve survivability; no safety investment should guarantee success.

### 4. Timeline as conditional eras, not prophecy

The essay's 1–3 / 3–5 / 5–10 year chronology is usable only as a scenario pacing prior. The actual phase transition should be state-based:

1. **Conversion Era (typical scenario range 1–3 years):** AI-directed human work, existing-factory conversion, institutional lag, initial rivalry.
2. **Recursive Industry Era (typical 3–5 years):** autonomous maintenance and industrial closure, shrinking doubling times, visible accident/legitimacy pressures.
3. **Solar-System Expansion Era (typical 5–10 years):** off-world industry, communications delay, contested resources, branch civilizations, stellar-energy infrastructure.

Fast-takeoff settings compress these ranges; physical-input-heavy settings stretch them. News and result screens must say “in this run” rather than “by year N humanity will…”.

### 5. Beyond the Dyson-swarm milestone

The first meaningful stellar-capture milestone should open, not close, the following systems:

- heat rejection and orbital congestion;
- allocation of stellar energy between computation, habitats, propulsion, and reserves;
- rights and representation for digital populations;
- independent settlements with light-speed-delayed governance;
- competing expansion norms (preservation, expansion, pluralism, central control);
- defensive dilemmas and verification between branch civilizations;
- long-horizon probes and the physical speed-of-light frontier.

This preserves the requested emotional beat: the map jumps from Earth to orbital space to the solar system, and the player realizes the previous “climax” was only the end of terrestrial constraints.

## Source UX requirements

The in-game source drawer should provide both Japanese and English entries with:

1. a short claim phrased conditionally;
2. evidence badge: **Data / Model / Scenario**;
3. author and publication date;
4. direct URL to the original analysis or official scientific source;
5. “What this source does not establish” caveat;
6. which game variable uses the claim and whether the number was tuned for play.

Recommended compact entry example:

> **Initial industrial doubling time: 12–36 months** — Model  
> Forethought (2025) gives order-of-magnitude estimates near one year under abundant AI cognition, but its cautious summary is “a few years” and it lists major construction bottlenecks. The game uses a tunable range, not a forecast.

Do not use Ray Kurzweil, Eliezer Yudkowsky, Daniel Kokotajlo, Ege Erdil, or any other individual's name as an authority badge, faction stereotype, or deterministic difficulty setting. If a history-of-ideas entry mentions a person, distinguish their own statement from the essay author's interpretation and do not attach an inferred p(doom).

## Red flags and unresolved uncertainty

- The essay repeatedly upgrades “physically not forbidden” into “scientifically likely”. Those are not equivalent. The game must preserve engineering, coordination, and unknown-unknown failure space.
- “All AGI-pill researchers agree on the destination” is too strong. Epoch's review says end-of-century explosive growth is about even and high confidence is unwarranted.
- The essay's claim that regulation-free technological/industrial explosion probability is “probably 80%” is author inference, not an Epoch estimate. Exclude it.
- Individual p(doom) values in the essay are sourced inconsistently and are not measurements on a common scale. Exclude named numeric comparisons.
- The 1–3 / 3–5 / 5–10 year sequence is a constructed scenario. Use it for pacing and labels, never as a factual timeline.
- One-year initial doubling, days-long late doubling, Mercury disassembly, and rapid Dyson-swarm construction all depend on stacked assumptions. Each must be breakable by visible bottlenecks.
- Multiplying laboratory speed-up factors across a whole research economy risks double counting and ignores integration and validation. Keep acceleration field-specific.
- Solar energy and crustal abundance do not erase accessibility, heat, ecology, transport, refining, or governance costs.
- Biological replication is an existence proof for replication, not proof that a modern industrial ecology can copy itself at biological speed or fidelity.

## Primary and official sources used for this translation

- William MacAskill and Fin Moorhouse, [*Preparing for the Intelligence Explosion*](https://www.forethought.org/research/preparing-for-the-intelligence-explosion), Forethought, 2025 — scenario/model synthesis; explicit “century in a decade” and AI-research-capacity assumptions.
- Tom Davidson and Rose Hadshar, [*The Industrial Explosion*](https://www.forethought.org/research/the-industrial-explosion), Forethought, 2025 — industrial closure, initial doubling BOTECs, experience-curve extrapolation, biological upper-bound analogies.
- Tom Davidson and Tom Houlden, [*How quick and big would a software intelligence explosion be?*](https://www.forethought.org/research/how-quick-and-big-would-a-software-intelligence-explosion-be), Forethought, 2025 — software takeoff Monte Carlo model and explicit limitations.
- Ege Erdil and Tamay Besiroglu, [*Explosive growth from AI: A review of the arguments*](https://epoch.ai/publications/explosive-growth-from-ai-a-review-of-the-arguments), Epoch AI — counterarguments, regulatory/social friction, physical bottlenecks, and uncertainty.
- Epoch AI, [*How fast can algorithms advance capabilities?*](https://epoch.ai/gradient-updates/how-fast-can-algorithms-advance-capabilities) — compute dependence and limits of algorithm-only improvement.
- Nicholas Bloom, Charles I. Jones, John Van Reenen, and Michael Webb, [*Are Ideas Getting Harder to Find?*](https://www.aeaweb.org/articles?id=10.1257/aer.20180338), *American Economic Review* 110(4), 2020 — empirical decline in research productivity.
- NASA Science, [Universe glossary](https://science.nasa.gov/universe/glossary/) — official reference for solar luminosity (~3.83 × 10^26 W).
- NASA, [*Space Communications: 7 Things You Need to Know*](https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/) — light-speed latency and Earth–Mars communication delays.

Secondary sources and media links in the supplied essay were deliberately not used to establish named timelines or individual p(doom) figures.
