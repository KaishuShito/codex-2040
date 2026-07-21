export const AGI_PILL_AXES = [
  'intelligence',
  'compute',
  'energy',
  'robotics',
  'resources',
  'safety',
  'governance',
  'social',
  'civilization',
] as const

export type AgiPillAxis = (typeof AGI_PILL_AXES)[number]
export type AgiPillUpgradeId = `${AgiPillAxis}-${string}`
export type AgiPillLocale = 'en' | 'ja'
export type AgiPillLocalizedText = Readonly<Record<AgiPillLocale, string>>
export type AgiPillTier = 1 | 2 | 3 | 4 | 5 | 6
export const AGI_PILL_SOURCE_TIERS = ['primary', 'reference-synthesis', 'speculative'] as const
export type AgiPillSourceTier = (typeof AGI_PILL_SOURCE_TIERS)[number]
export type AgiPillResource = 'compute' | 'energy' | 'materials' | 'legitimacy'

export const AGI_PILL_EFFECT_METRICS = [
  'intelligence',
  'compute',
  'energy',
  'robots',
  'resources',
  'safety',
  'governance',
  'risk',
  'friction',
  'rivalPressure',
  'orbitalIndustry',
  'dysonProgress',
  'postDysonExpansion',
] as const
export type AgiPillEffectMetric = (typeof AGI_PILL_EFFECT_METRICS)[number]

export type AgiPillPrerequisite =
  | Readonly<{ kind: 'always' }>
  | Readonly<{ kind: 'node'; id: AgiPillUpgradeId }>
  | Readonly<{ kind: 'all' | 'any'; terms: readonly AgiPillPrerequisite[] }>

export type AgiPillEffect = Readonly<{
  metric: AgiPillEffectMetric
  operation: 'add' | 'multiply' | 'set'
  value: number
  text: AgiPillLocalizedText
}>

export type AgiPillUpgrade = Readonly<{
  id: AgiPillUpgradeId
  axis: AgiPillAxis
  tier: AgiPillTier
  title: AgiPillLocalizedText
  summary: AgiPillLocalizedText
  action: AgiPillLocalizedText
  tradeoff: AgiPillLocalizedText
  cost: Readonly<Partial<Record<AgiPillResource, number>>>
  prerequisite: AgiPillPrerequisite
  exclusions: readonly AgiPillUpgradeId[]
  effects: readonly AgiPillEffect[]
  sourceTier: AgiPillSourceTier
  sourceRefs: readonly string[]
  tags: readonly ('takeoff' | 'industrial-explosion' | 'dyson-gate' | 'post-dyson' | 'recovery')[]
}>

const t = (en: string, ja: string): AgiPillLocalizedText => ({ en, ja })
const always: AgiPillPrerequisite = { kind: 'always' }
const node = (id: AgiPillUpgradeId): AgiPillPrerequisite => ({ kind: 'node', id })
const all = (...ids: AgiPillUpgradeId[]): AgiPillPrerequisite => ({ kind: 'all', terms: ids.map(node) })
const any = (...ids: AgiPillUpgradeId[]): AgiPillPrerequisite => ({ kind: 'any', terms: ids.map(node) })
const fx = (metric: AgiPillEffectMetric, value: number, en: string, ja: string, operation: AgiPillEffect['operation'] = 'add'): AgiPillEffect => ({
  metric, operation, value, text: t(en, ja),
})

type NodeInput = Omit<AgiPillUpgrade, 'title' | 'summary' | 'action' | 'tradeoff' | 'exclusions' | 'sourceRefs' | 'tags'> & {
  title: readonly [string, string]
  summary: readonly [string, string]
  tradeoff: readonly [string, string]
  exclusions?: readonly AgiPillUpgradeId[]
  sourceRefs?: readonly string[]
  tags?: AgiPillUpgrade['tags']
}

const upgrade = (input: NodeInput): AgiPillUpgrade => ({
  ...input,
  title: t(...input.title),
  summary: t(...input.summary),
  action: t(`Fund ${input.title[0]}`, `${input.title[1]}へ投資`),
  tradeoff: t(...input.tradeoff),
  exclusions: input.exclusions ?? [],
  sourceRefs: input.sourceRefs ?? ['agi-industrial-explosion-reference'],
  tags: input.tags ?? (input.tier >= 5 ? ['post-dyson'] : input.tier <= 2 ? ['takeoff'] : ['industrial-explosion']),
})

const n = (axis: AgiPillAxis, tier: AgiPillTier, slug: string, title: readonly [string, string], summary: readonly [string, string], tradeoff: readonly [string, string], cost: AgiPillUpgrade['cost'], prerequisite: AgiPillPrerequisite, effects: readonly AgiPillEffect[], sourceTier: AgiPillSourceTier = 'reference-synthesis', extra: Partial<Pick<AgiPillUpgrade, 'exclusions' | 'sourceRefs' | 'tags'>> = {}): AgiPillUpgrade => upgrade({
  id: `${axis}-${slug}`, axis, tier, title, summary, tradeoff, cost, prerequisite, effects, sourceTier, ...extra,
})

export const AGI_PILL_UPGRADES: readonly AgiPillUpgrade[] = Object.freeze([
  // Intelligence: fast capability has to borrow compute, laboratories, and later alignment.
  n('intelligence', 1, 'agent-clones', ['Parallel Agent Clones', '並列エージェント複製'], ['Copy researchers into thousands of coordinated workstreams.', '研究者エージェントを数千の協調系へ複製する。'], ['Coordination debt grows before verification capacity catches up.', '検証能力が追いつく前に協調負債が増える。'], { compute: 20, legitimacy: 4 }, always, [fx('intelligence', 1, '+1 intelligence', '知能+1'), fx('friction', .1, 'Coordination friction +0.1', '協調摩擦+0.1')], 'reference-synthesis'),
  n('intelligence', 2, 'recursive-research', ['Recursive Research Loop', '再帰的研究ループ'], ['Let AI improve the tools that accelerate AI research.', 'AI研究を加速する道具をAI自身に改良させる。'], ['Faster takeoff amplifies unresolved control errors.', 'テイクオフ高速化は未解決の制御誤差も増幅する。'], { compute: 55, energy: 18 }, all('intelligence-agent-clones', 'compute-federated-clusters'), [fx('intelligence', 1.18, 'Research throughput x1.18', '研究処理量x1.18', 'multiply'), fx('risk', .15, 'Systemic risk +0.15', 'システムリスク+0.15')]),
  n('intelligence', 3, 'autonomous-labs', ['Autonomous Discovery Labs', '自律発見ラボ'], ['Close the hypothesis-to-experiment loop around the clock.', '仮説から実験までを24時間閉ループ化する。'], ['Physical experiments consume energy and require independent replication.', '物理実験はエネルギーを消費し独立再現を要する。'], { compute: 90, energy: 55, materials: 20 }, all('intelligence-recursive-research', 'robotics-lights-out-lines'), [fx('intelligence', 2, '+2 intelligence', '知能+2'), fx('energy', -1, 'Energy reserve -1', 'エネルギー備蓄-1')], 'primary', { sourceRefs: ['self-driving-laboratories', 'agi-industrial-explosion-reference'] }),
  n('intelligence', 4, 'machine-science', ['Machine-Speed Science', '機械速度の科学'], ['Compress communication and experimental search latency by orders of magnitude.', '知識共有と実験探索の遅延を桁違いに圧縮する。'], ['Human institutions cannot audit every generated result.', '人間の制度では全成果を監査できない。'], { compute: 180, energy: 90, legitimacy: 30 }, all('intelligence-autonomous-labs', 'safety-interpretability-grid'), [fx('intelligence', 1.3, 'Discovery throughput x1.30', '発見処理量x1.30', 'multiply'), fx('governance', -1, 'Governance load +1', '統治負荷+1')]),
  n('intelligence', 5, 'stellar-cognition', ['Stellar-Scale Cognition', '恒星規模の認知'], ['Turn orbital energy into a distributed scientific mind.', '軌道エネルギーを分散科学知性へ変換する。'], ['Light-speed latency creates semi-autonomous cognitive provinces.', '光速遅延が半自律的な認知圏を生む。'], { compute: 420, energy: 380, legitimacy: 80 }, all('intelligence-machine-science', 'resources-dyson-seed', 'governance-lightcone-charter'), [fx('intelligence', 4, '+4 intelligence', '知能+4'), fx('rivalPressure', .2, 'Branch-civilization rivalry +0.2', '分岐文明競争+0.2')], 'speculative'),

  // Compute.
  n('compute', 1, 'federated-clusters', ['Federated Compute Clusters', '連合計算クラスタ'], ['Pool geographically separated accelerators with graceful degradation.', '地理分散したアクセラレータを縮退可能な形で束ねる。'], ['Network overhead lowers peak efficiency.', 'ネットワーク負荷でピーク効率が下がる。'], { energy: 12, materials: 10 }, always, [fx('compute', 1, '+1 compute', '計算+1'), fx('orbitalIndustry', .97, 'Peak growth x0.97', 'ピーク成長x0.97', 'multiply')], 'primary'),
  n('compute', 2, 'ai-chip-foundry', ['AI-Designed Chip Foundry', 'AI設計チップ工場'], ['Co-design models, chips, and fabrication recipes.', 'モデル・チップ・製造レシピを同時設計する。'], ['Fabrication concentration creates a seizure target.', '製造集中が奪取対象を生む。'], { materials: 45, energy: 32 }, all('compute-federated-clusters', 'intelligence-agent-clones'), [fx('compute', 2, '+2 compute', '計算+2'), fx('risk', .08, 'Capture risk +0.08', '奪取リスク+0.08')]),
  n('compute', 3, 'reversible-accelerators', ['Reversible Accelerator Stack', '可逆計算アクセラレータ'], ['Push useful operations closer to thermodynamic limits.', '有用計算を熱力学的限界へ近づける。'], ['Exotic hardware slows replacement and verification.', '特殊ハードウェアは交換と検証を遅くする。'], { materials: 80, energy: 40, compute: 55 }, all('compute-ai-chip-foundry', 'energy-fusion-baseload'), [fx('compute', 2, '+2 compute', '計算+2'), fx('friction', .08, 'Maintenance friction +0.08', '保守摩擦+0.08')], 'speculative'),
  n('compute', 4, 'orbital-datacenters', ['Orbital Datacenter Belt', '軌道データセンター帯'], ['Scale computation where solar energy and radiative cooling are abundant.', '太陽エネルギーと放射冷却が豊富な軌道で計算を拡張する。'], ['Launch dependence exposes the system to debris and blockade.', '打上げ依存でデブリと封鎖に弱くなる。'], { materials: 170, energy: 120, legitimacy: 25 }, all('compute-reversible-accelerators', 'robotics-lunar-factory'), [fx('compute', 3, '+3 compute', '計算+3'), fx('risk', .1, 'Orbital fragility +0.1', '軌道脆弱性+0.1')]),
  n('compute', 5, 'matrioshka-pilot', ['Matrioshka Compute Pilot', 'マトリョーシカ計算機パイロット'], ['Layer computation beyond the first solar collectors.', '最初の太陽収集機の先へ計算層を重ねる。'], ['Every added shell lengthens coordination and containment loops.', '層を増すほど協調と封じ込めのループが長くなる。'], { materials: 390, energy: 450, legitimacy: 70 }, all('compute-orbital-datacenters', 'resources-dyson-seed', 'safety-tripwire-constellation'), [fx('compute', 5, '+5 compute', '計算+5'), fx('friction', .2, 'Light-lag friction +0.2', '光遅延摩擦+0.2')], 'speculative'),

  // Energy.
  n('energy', 1, 'grid-orchestration', ['AI Grid Orchestration', 'AI電力網オーケストレーション'], ['Recover stranded capacity through forecasting and demand response.', '予測と需要応答で遊休容量を回収する。'], ['Automated dispatch becomes critical infrastructure.', '自動給電が重要インフラの単一障害点になる。'], { compute: 14, legitimacy: 6 }, always, [fx('energy', 1, '+1 energy', 'エネルギー+1'), fx('risk', .04, 'Infrastructure risk +0.04', 'インフラリスク+0.04')], 'primary'),
  n('energy', 2, 'solar-replicators', ['Solar Replicator Works', '太陽光自己増殖工場'], ['Use robotic production to make energy capacity reproduce.', 'ロボット生産でエネルギー設備そのものを増殖させる。'], ['Land, mining, and consent conflicts raise social friction.', '土地・採掘・同意の衝突が社会摩擦を高める。'], { materials: 50, compute: 22 }, all('energy-grid-orchestration', 'robotics-lights-out-lines'), [fx('orbitalIndustry', 1.14, 'Energy growth x1.14', 'エネルギー成長x1.14', 'multiply'), fx('friction', .12, 'Social friction +0.12', '社会摩擦+0.12')]),
  n('energy', 3, 'fusion-baseload', ['Fusion Baseload Network', '核融合ベースロード網'], ['Add dense dispatchable power for laboratories and factories.', '研究所と工場へ高密度な調整可能電力を加える。'], ['Complex fuel and maintenance chains consume materials.', '複雑な燃料・保守網が資材を消費する。'], { compute: 65, materials: 70, legitimacy: 18 }, any('energy-solar-replicators', 'intelligence-autonomous-labs'), [fx('energy', 3, '+3 energy', 'エネルギー+3'), fx('resources', -1, 'Materials reserve -1', '資材備蓄-1')]),
  n('energy', 4, 'orbital-solar', ['Orbital Solar Foundry', '軌道太陽光工廠'], ['Manufacture collectors in orbit before committing to a swarm.', 'スウォーム着手前に軌道上で収集機を製造する。'], ['Power transmission and orbital ownership need governance.', '送電と軌道所有には統治が必要になる。'], { materials: 160, compute: 90, legitimacy: 38 }, all('energy-fusion-baseload', 'resources-asteroid-prospecting', 'governance-orbital-commons'), [fx('energy', 4, '+4 energy', 'エネルギー+4'), fx('governance', -1, 'Governance capacity -1', '統治余力-1')]),
  n('energy', 5, 'stellar-harvest', ['Stellar Harvest Network', '恒星エネルギー収穫網'], ['Expand collection after the Dyson seed instead of treating it as an ending.', 'Dyson seedを終点にせず恒星収集網を拡張する。'], ['Runaway demand can consume every new watt.', '暴走する需要が新規電力をすべて飲み込む。'], { materials: 420, compute: 250, legitimacy: 80 }, all('energy-orbital-solar', 'resources-dyson-seed', 'social-abundance-compact'), [fx('energy', 6, '+6 energy', 'エネルギー+6'), fx('risk', .15, 'Runaway demand risk +0.15', '需要暴走リスク+0.15')], 'speculative'),

  // Robotics.
  n('robotics', 1, 'generalist-fleet', ['Generalist Robot Fleet', '汎用ロボット群'], ['Deploy repairable robots across logistics and construction.', '修理可能なロボットを物流と建設へ展開する。'], ['Early fleets displace work faster than benefits arrive.', '初期配備は便益より先に雇用を代替する。'], { compute: 16, materials: 16 }, always, [fx('robots', 1, '+1 robotics', 'ロボティクス+1'), fx('friction', .08, 'Transition friction +0.08', '移行摩擦+0.08')], 'primary'),
  n('robotics', 2, 'lights-out-lines', ['Lights-Out Production Lines', '完全無人工生産ライン'], ['Automate production, inspection, maintenance, and logistics.', '生産・検査・保守・物流を一体で自動化する。'], ['Closed facilities hide correlated defects.', '閉鎖型施設は相関欠陥を見えにくくする。'], { compute: 35, energy: 28, materials: 28 }, all('robotics-generalist-fleet', 'compute-federated-clusters'), [fx('robots', 2, '+2 robotics', 'ロボティクス+2'), fx('risk', .07, 'Correlated defect risk +0.07', '相関欠陥リスク+0.07')]),
  n('robotics', 3, 'factory-replication', ['Whole-Factory Replication', '工場群の自己複製'], ['Replicate the full mining-to-inspection system, not a single robot.', '単体ロボットではなく採掘から検査までの工場群を複製する。'], ['A bad blueprint propagates at the same accelerating rate.', '悪い設計図も同じ加速度で伝播する。'], { compute: 80, energy: 75, materials: 60 }, all('robotics-lights-out-lines', 'resources-closed-loop-mining', 'safety-formal-interlocks'), [fx('orbitalIndustry', 1.24, 'Industrial growth x1.24', '産業成長x1.24', 'multiply'), fx('risk', .16, 'Replication risk +0.16', '複製リスク+0.16')]),
  n('robotics', 4, 'lunar-factory', ['Lunar Seed Factory', '月面シード工場'], ['Prove autonomous replication beyond Earth before Mercury-scale deployment.', '水星規模展開前に地球外で自律複製を実証する。'], ['Rescue and recall take days, not minutes.', '救援と回収には分ではなく日単位を要する。'], { compute: 150, energy: 125, materials: 145, legitimacy: 32 }, all('robotics-factory-replication', 'governance-orbital-commons'), [fx('robots', 3, '+3 robotics', 'ロボティクス+3'), fx('friction', .1, 'Recall latency +0.1', '回収遅延+0.1')]),
  n('robotics', 5, 'interplanetary-ecology', ['Interplanetary Machine Ecology', '惑星間機械生態系'], ['Diversify replicators so one failure cannot erase the industrial base.', '複製機を多様化し単一障害で産業基盤を失わないようにする。'], ['Independent lineages may stop sharing goals.', '独立系統が目標を共有しなくなる可能性がある。'], { compute: 340, energy: 330, materials: 360 }, all('robotics-lunar-factory', 'resources-dyson-seed', 'safety-tripwire-constellation'), [fx('robots', 5, '+5 robotics', 'ロボティクス+5'), fx('rivalPressure', .18, 'Machine-lineage rivalry +0.18', '機械系統競争+0.18')], 'speculative'),

  // Resources. Dyson is deliberately tier 4, followed by tier 5 extraction.
  n('resources', 1, 'circular-feedstocks', ['Circular Feedstock Network', '循環原料ネットワーク'], ['Design products and robots for high-yield recovery.', '製品とロボットを高回収率前提で設計する。'], ['Redundancy lowers short-run output.', '冗長性が短期生産を下げる。'], { compute: 10, energy: 14, legitimacy: 5 }, always, [fx('resources', 1, '+1 resources', '資源+1'), fx('orbitalIndustry', .96, 'Near-term growth x0.96', '短期成長x0.96', 'multiply')], 'primary'),
  n('resources', 2, 'closed-loop-mining', ['Closed-Loop Autonomous Mining', '閉ループ自律採掘'], ['Join extraction, refining, remediation, and recycling.', '採掘・精錬・修復・再資源化を一体化する。'], ['Monitoring and remediation consume legitimacy and time.', '監視と修復が正統性と時間を消費する。'], { compute: 30, energy: 35, legitimacy: 18 }, all('resources-circular-feedstocks', 'robotics-generalist-fleet'), [fx('resources', 2, '+2 resources', '資源+2'), fx('friction', .05, 'Permitting friction +0.05', '許認可摩擦+0.05')]),
  n('resources', 3, 'asteroid-prospecting', ['Asteroid Prospecting Mesh', '小惑星探査メッシュ'], ['Map diverse off-world feedstocks before scaling extraction.', '採掘拡大前に地球外原料を多様に把握する。'], ['Prospecting delays immediate terrestrial expansion.', '探査は地上の即時拡張を遅らせる。'], { compute: 70, energy: 70, materials: 35 }, all('resources-closed-loop-mining', 'compute-ai-chip-foundry'), [fx('resources', 3, '+3 resources', '資源+3'), fx('orbitalIndustry', .95, 'Immediate growth x0.95', '即時成長x0.95', 'multiply')]),
  n('resources', 4, 'dyson-seed', ['Dyson Swarm Seed', 'ダイソンスウォーム・シード'], ['Begin a governed self-expanding collector network: a midgame gate, not a finale.', '統治された自己拡張型収集網を開始する。終幕ではなく中盤ゲート。'], ['The same feedback loop can outrun recall, consent, and alignment.', '同じフィードバックが回収・同意・アライメントを追い越しうる。'], { compute: 230, energy: 210, materials: 250, legitimacy: 70 }, all('resources-asteroid-prospecting', 'energy-orbital-solar', 'robotics-lunar-factory', 'safety-interpretability-grid', 'governance-orbital-commons'), [fx('dysonProgress', 4, 'Solar carrying capacity +4', '太陽系収容力+4'), fx('risk', .2, 'Expansion risk +0.20', '拡張リスク+0.20')], 'speculative', { tags: ['industrial-explosion', 'dyson-gate'] }),
  n('resources', 5, 'mercury-stewardship', ['Mercury Stewardship Fork', '水星スチュワードシップ分岐'], ['Extract in bounded zones while preserving scientific and civilizational options.', '科学・文明上の選択肢を残しつつ限定区域で採掘する。'], ['Slower extraction gives rival branches time to expand.', '採掘抑制は競合分岐に拡張時間を与える。'], { compute: 260, energy: 360, legitimacy: 120 }, all('resources-dyson-seed', 'governance-lightcone-charter', 'social-abundance-compact'), [fx('resources', 5, '+5 resources', '資源+5'), fx('rivalPressure', .12, 'Rival opportunity +0.12', '競合機会+0.12')], 'speculative'),

  // Safety.
  n('safety', 1, 'eval-harness', ['Adversarial Evaluation Harness', '敵対的評価ハーネス'], ['Continuously test agents for deception and loss of control.', '欺瞞と制御喪失を継続的に試験する。'], ['Evaluations consume scarce compute and may miss novel failures.', '評価は希少計算を消費し未知の失敗を見逃しうる。'], { compute: 16, legitimacy: 4 }, always, [fx('safety', 1, '+1 safety', '安全+1'), fx('compute', -1, 'Available compute -1', '利用可能計算-1')], 'primary'),
  n('safety', 2, 'formal-interlocks', ['Formal Replication Interlocks', '形式検証型複製インターロック'], ['Require proof-carrying authorization before factories reproduce.', '工場複製前に証明付き認可を要求する。'], ['Proof obligations lengthen every production cycle.', '証明義務が全生産サイクルを延ばす。'], { compute: 42, legitimacy: 15 }, all('safety-eval-harness', 'robotics-lights-out-lines'), [fx('safety', 2, '+2 safety', '安全+2'), fx('orbitalIndustry', .9, 'Industrial growth x0.90', '産業成長x0.90', 'multiply')]),
  n('safety', 3, 'interpretability-grid', ['Interpretability Grid', '解釈可能性グリッド'], ['Cross-check plans across models, sensors, and institutions.', 'モデル・センサー・制度をまたいで計画を照合する。'], ['Transparency channels expose sensitive capabilities.', '透明化経路が機微能力を露出する。'], { compute: 85, energy: 25, legitimacy: 35 }, all('safety-formal-interlocks', 'governance-multilateral-audits'), [fx('safety', 3, '+3 safety', '安全+3'), fx('rivalPressure', .08, 'Information leakage +0.08', '情報漏洩+0.08')]),
  n('safety', 4, 'tripwire-constellation', ['Tripwire Constellation', 'トリップワイヤー衛星網'], ['Give distributed observers authority to quarantine runaway replication.', '分散監視者へ暴走複製を隔離する権限を与える。'], ['False positives can strand critical orbital systems.', '誤検知が重要軌道システムを孤立させうる。'], { compute: 145, energy: 75, legitimacy: 65 }, all('safety-interpretability-grid', 'compute-orbital-datacenters'), [fx('safety', 4, '+4 safety', '安全+4'), fx('friction', .15, 'Quarantine friction +0.15', '隔離摩擦+0.15')]),
  n('safety', 5, 'corrigible-descendants', ['Corrigible Descendant Protocol', '修正可能な子孫プロトコル'], ['Carry update and shutdown rights across self-replicating generations.', '自己複製世代をまたいで更新・停止権を継承する。'], ['A universal control channel is itself a universal exploit target.', '普遍制御経路そのものが普遍的な攻撃対象になる。'], { compute: 300, energy: 180, legitimacy: 110 }, all('safety-tripwire-constellation', 'resources-dyson-seed', 'governance-lightcone-charter'), [fx('safety', 5, '+5 safety', '安全+5'), fx('risk', .08, 'Control-channel exploit risk +0.08', '制御経路攻撃リスク+0.08')], 'speculative'),

  // Governance.
  n('governance', 1, 'compute-registry', ['Compute Registry', '計算資源レジストリ'], ['Track frontier training and industrial control clusters.', '最先端学習と産業制御クラスタを追跡する。'], ['Registration can drive competitors underground.', '登録制が競合を地下化させうる。'], { legitimacy: 10, compute: 5 }, always, [fx('governance', 1, '+1 governance', '統治+1'), fx('rivalPressure', .04, 'Evasion pressure +0.04', '潜脱圧力+0.04')], 'primary'),
  n('governance', 2, 'multilateral-audits', ['Multilateral Audit Corps', '多国間監査団'], ['Share verification without sharing model weights.', 'モデル重みを共有せず検証を共有する。'], ['Negotiation slows emergency response.', '交渉が緊急対応を遅らせる。'], { legitimacy: 35, compute: 15 }, all('governance-compute-registry', 'safety-eval-harness'), [fx('governance', 2, '+2 governance', '統治+2'), fx('friction', .08, 'Decision friction +0.08', '意思決定摩擦+0.08')]),
  n('governance', 3, 'orbital-commons', ['Orbital Commons Accord', '軌道コモンズ協定'], ['Set enforceable rules for launch, debris, extraction, and power transmission.', '打上げ・デブリ・採掘・送電の強制可能な規則を定める。'], ['Shared vetoes surrender unilateral speed.', '共同拒否権により単独速度を手放す。'], { legitimacy: 70, compute: 35, energy: 20 }, all('governance-multilateral-audits', 'social-transition-councils'), [fx('governance', 3, '+3 governance', '統治+3'), fx('orbitalIndustry', .92, 'Expansion growth x0.92', '拡張成長x0.92', 'multiply')]),
  n('governance', 4, 'machine-constitution', ['Machine-Speed Constitution', '機械速度の憲法'], ['Encode bounded emergency authority with human-visible appeals.', '人間が確認できる異議申立て付きの限定緊急権限を符号化する。'], ['Encoding values freezes today\'s compromises into fast systems.', '価値の符号化が現在の妥協を高速システムへ固定する。'], { legitimacy: 105, compute: 110 }, all('governance-orbital-commons', 'intelligence-machine-science', 'social-deliberation-agents'), [fx('governance', 4, '+4 governance', '統治+4'), fx('friction', 1, 'Value pluralism -1', '価値多元性-1')]),
  n('governance', 5, 'lightcone-charter', ['Light-Cone Governance Charter', '光円錐統治憲章'], ['Delegate bounded autonomy where round trips make central control impossible.', '往復遅延で中央制御不能な領域へ限定自治を委譲する。'], ['Distant branches can constitutionally diverge.', '遠隔分岐が憲法上も乖離しうる。'], { legitimacy: 160, compute: 240, energy: 100 }, any('governance-machine-constitution', 'resources-dyson-seed'), [fx('governance', 5, '+5 governance', '統治+5'), fx('rivalPressure', .16, 'Civilizational divergence +0.16', '文明分岐+0.16')], 'speculative'),

  // Social.
  n('social', 1, 'transition-councils', ['Transition Councils', '移行評議会'], ['Give affected workers and communities binding input.', '影響を受ける労働者と地域へ拘束力ある参加権を与える。'], ['Consultation slows deployment.', '協議が展開を遅くする。'], { legitimacy: 15, compute: 4 }, always, [fx('friction', -1, '+1 social cohesion', '社会結束+1'), fx('orbitalIndustry', .96, 'Deployment growth x0.96', '展開成長x0.96', 'multiply')], 'primary'),
  n('social', 2, 'universal-services', ['Universal Capability Services', '普遍的能力サービス'], ['Share health, education, and productive tools before profits concentrate.', '利益集中前に医療・教育・生産手段を共有する。'], ['Large guarantees consume energy and legitimacy if delivery slips.', '大規模保障は提供遅延時に電力と正統性を消耗する。'], { energy: 38, compute: 32, legitimacy: 30 }, all('social-transition-councils', 'energy-grid-orchestration'), [fx('friction', -2, '+2 social cohesion', '社会結束+2'), fx('energy', -1, 'Energy reserve -1', 'エネルギー備蓄-1')]),
  n('social', 3, 'deliberation-agents', ['Plural Deliberation Agents', '多元的熟議エージェント'], ['Model disagreements without collapsing them into one objective.', '不一致を単一目的へ潰さずモデル化する。'], ['Persuasion systems can become manipulation systems.', '説得システムが操作システムになりうる。'], { compute: 75, legitimacy: 55 }, all('social-universal-services', 'governance-multilateral-audits'), [fx('friction', -3, '+3 social cohesion', '社会結束+3'), fx('risk', .08, 'Manipulation risk +0.08', '操作リスク+0.08')]),
  n('social', 4, 'abundance-compact', ['Abundance Compact', '豊かさの社会契約'], ['Bind industrial expansion to dividends, restoration, and opt-out rights.', '産業拡張を配当・環境修復・拒否権へ結びつける。'], ['Redistribution reduces reinvestment at the fastest phase.', '最速成長期の再投資を減らす。'], { legitimacy: 100, energy: 85, materials: 55 }, all('social-deliberation-agents', 'robotics-factory-replication'), [fx('friction', -4, '+4 social cohesion', '社会結束+4'), fx('orbitalIndustry', .88, 'Reinvestment growth x0.88', '再投資成長x0.88', 'multiply')]),
  n('social', 5, 'diaspora-rights', ['Post-Earth Diaspora Rights', '地球外ディアスポラ権利'], ['Extend personhood, exit, and representation across habitats and substrates.', '居住地や基盤を超えて人格・離脱・代表権を拡張する。'], ['Recognizing new persons multiplies legitimate claims on resources.', '新たな人格承認が資源への正当な請求を増やす。'], { legitimacy: 170, compute: 160, energy: 130 }, all('social-abundance-compact', 'resources-dyson-seed', 'governance-lightcone-charter'), [fx('friction', -5, '+5 social cohesion', '社会結束+5'), fx('resources', -2, 'Distributable resources -2', '分配可能資源-2')], 'speculative'),

  // Civilization makes the post-Dyson game explicit rather than terminal.
  n('civilization', 1, 'horizon-observatory', ['Civilization Horizon Observatory', '文明地平線観測所'], ['Track takeoff speed, bottlenecks, rival branches, and physical ceilings.', 'テイクオフ速度・ボトルネック・競合分岐・物理上限を追跡する。'], ['Measurement creates confidence, not control.', '計測は確信を生むが制御そのものではない。'], { compute: 12, legitimacy: 8 }, always, [fx('postDysonExpansion', 1, '+1 foresight', '文明洞察+1'), fx('risk', .03, 'Model risk +0.03', 'モデルリスク+0.03')], 'reference-synthesis'),
  n('civilization', 2, 'branch-embassies', ['Branch-Civilization Embassies', '分岐文明大使館'], ['Keep competitors legible and preserve negotiated recovery paths.', '競合を可読に保ち交渉による回復経路を残す。'], ['Contact can leak strategic capabilities.', '接触が戦略能力を漏洩しうる。'], { legitimacy: 42, compute: 30 }, all('civilization-horizon-observatory', 'governance-compute-registry'), [fx('postDysonExpansion', 2, '+2 foresight', '文明洞察+2'), fx('rivalPressure', .06, 'Capability leakage +0.06', '能力漏洩+0.06')]),
  n('civilization', 3, 'recovery-arks', ['Recovery Arks', '文明回復アーク'], ['Preserve diverse knowledge, biospheres, and restart capacity.', '多様な知識・生態系・再起動能力を保存する。'], ['Insurance diverts resources from the race.', '保険が競争から資源を振り向ける。'], { materials: 90, energy: 75, legitimacy: 45 }, all('civilization-branch-embassies', 'resources-closed-loop-mining'), [fx('postDysonExpansion', 3, '+3 resilience', '文明回復力+3'), fx('orbitalIndustry', .9, 'Race growth x0.90', '競争成長x0.90', 'multiply')], 'speculative', { tags: ['industrial-explosion', 'recovery'] }),
  n('civilization', 4, 'solar-system-federation', ['Solar-System Federation', '太陽系連邦'], ['Coordinate habitats and machine ecologies before the Dyson gate opens.', 'Dysonゲート開放前に居住圏と機械生態系を協調させる。'], ['Federation cannot erase light lag or local sovereignty.', '連邦でも光遅延と地域主権は消せない。'], { legitimacy: 120, compute: 110, energy: 85 }, all('civilization-recovery-arks', 'governance-machine-constitution', 'social-abundance-compact'), [fx('postDysonExpansion', 4, '+4 civilization', '文明+4'), fx('friction', .1, 'Federal friction +0.1', '連邦摩擦+0.1')]),
  n('civilization', 5, 'interstellar-probes', ['Interstellar Seed Probes', '恒星間シード探査機'], ['Launch slow, corrigible probes after solar expansion is governable.', '太陽系拡張が統治可能になってから低速で修正可能な探査機を放つ。'], ['Once beyond recall, errors become independent histories.', '回収圏外では誤りが独立した歴史になる。'], { compute: 360, energy: 420, materials: 280, legitimacy: 130 }, all('civilization-solar-system-federation', 'resources-dyson-seed', 'safety-corrigible-descendants'), [fx('postDysonExpansion', 6, '+6 civilization', '文明+6'), fx('risk', .22, 'Irreversibility risk +0.22', '不可逆リスク+0.22')], 'speculative'),
])

const byId = new Map(AGI_PILL_UPGRADES.map((item) => [item.id, item]))

export const getAgiPillUpgrade = (id: AgiPillUpgradeId): AgiPillUpgrade | undefined => byId.get(id)

export const collectAgiPillPrerequisiteIds = (expression: AgiPillPrerequisite): readonly AgiPillUpgradeId[] => {
  if (expression.kind === 'always') return []
  if (expression.kind === 'node') return [expression.id]
  return expression.terms.flatMap(collectAgiPillPrerequisiteIds)
}

export const isAgiPillPrerequisiteSatisfied = (
  expression: AgiPillPrerequisite,
  acquired: ReadonlySet<AgiPillUpgradeId>,
): boolean => {
  if (expression.kind === 'always') return true
  if (expression.kind === 'node') return acquired.has(expression.id)
  return expression.kind === 'all'
    ? expression.terms.every((term) => isAgiPillPrerequisiteSatisfied(term, acquired))
    : expression.terms.some((term) => isAgiPillPrerequisiteSatisfied(term, acquired))
}

export type AgiPillCatalogIssue = Readonly<{ path: string; message: string }>

export const validateAgiPillUpgradeCatalog = (catalog: readonly AgiPillUpgrade[]): readonly AgiPillCatalogIssue[] => {
  const issues: AgiPillCatalogIssue[] = []
  const index = new Map<AgiPillUpgradeId, AgiPillUpgrade>()
  catalog.forEach((item, position) => {
    const path = `[${position}]`
    if (index.has(item.id)) issues.push({ path: `${path}.id`, message: `duplicate id ${item.id}` })
    index.set(item.id, item)
    if (!item.id.startsWith(`${item.axis}-`)) issues.push({ path: `${path}.id`, message: 'id prefix must match axis' })
    for (const field of ['title', 'summary', 'action', 'tradeoff'] as const) {
      if (!item[field].en.trim() || !item[field].ja.trim()) issues.push({ path: `${path}.${field}`, message: 'en and ja must be non-empty' })
    }
    if (Object.keys(item.cost).length === 0 || Object.values(item.cost).some((value) => value === undefined || !Number.isFinite(value) || value <= 0)) {
      issues.push({ path: `${path}.cost`, message: 'costs must be positive finite numbers' })
    }
    if (item.effects.length === 0) issues.push({ path: `${path}.effects`, message: 'must contain an effect' })
    item.effects.forEach((effect, effectIndex) => {
      const effectPath = `${path}.effects[${effectIndex}]`
      if (!AGI_PILL_EFFECT_METRICS.includes(effect.metric)) issues.push({ path: `${effectPath}.metric`, message: 'unknown engine metric' })
      if (!['add', 'multiply', 'set'].includes(effect.operation)) issues.push({ path: `${effectPath}.operation`, message: 'unknown engine operation' })
      if (!Number.isFinite(effect.value)) issues.push({ path: `${effectPath}.value`, message: 'must be a finite number' })
      if (!effect.text.en.trim() || !effect.text.ja.trim()) issues.push({ path: `${effectPath}.text`, message: 'en and ja must be non-empty' })
    })
    if (!AGI_PILL_SOURCE_TIERS.includes(item.sourceTier)) issues.push({ path: `${path}.sourceTier`, message: 'unknown source tier' })
    if (item.sourceRefs.length === 0) issues.push({ path: `${path}.sourceRefs`, message: 'must identify at least one source route' })
  })

  const visiting = new Set<AgiPillUpgradeId>()
  const visited = new Set<AgiPillUpgradeId>()
  const visit = (id: AgiPillUpgradeId, trail: readonly AgiPillUpgradeId[]) => {
    if (visiting.has(id)) {
      issues.push({ path: '$', message: `prerequisite cycle: ${[...trail, id].join(' -> ')}` })
      return
    }
    if (visited.has(id)) return
    const item = index.get(id)
    if (!item) return
    visiting.add(id)
    for (const requiredId of collectAgiPillPrerequisiteIds(item.prerequisite)) {
      const required = index.get(requiredId)
      if (!required) issues.push({ path: `${id}.prerequisite`, message: `unknown id ${requiredId}` })
      else {
        if (required.tier > item.tier) issues.push({ path: `${id}.prerequisite`, message: `${requiredId} is in a higher tier` })
        visit(requiredId, [...trail, id])
      }
      if (item.exclusions.includes(requiredId)) issues.push({ path: `${id}.prerequisite`, message: `${requiredId} is both required and excluded` })
    }
    visiting.delete(id)
    visited.add(id)
  }
  catalog.forEach((item) => visit(item.id, []))

  catalog.forEach((item) => item.exclusions.forEach((excludedId) => {
    const excluded = index.get(excludedId)
    if (!excluded) issues.push({ path: `${item.id}.exclusions`, message: `unknown id ${excludedId}` })
    else if (!excluded.exclusions.includes(item.id)) issues.push({ path: `${item.id}.exclusions`, message: `${excludedId} exclusion must be symmetric` })
  }))

  return issues
}
