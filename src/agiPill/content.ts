import type {
  AgiPillCause,
  AgiPillOutcome,
  AgiPillPhase,
  RivalCivilization,
} from './types'

export type AgiPillLocale = 'en' | 'ja'

export type AgiPillCopyKey = keyof typeof COPY.en

export type LocalizedText = Readonly<Record<AgiPillLocale, string>>

export type SourceTier =
  | 'primary'
  | 'research-synthesis'
  | 'reference-article'
  | 'game-inference'

export type SourceTopic =
  | 'intelligence-explosion'
  | 'industrial-explosion'
  | 'recursive-production'
  | 'superexponential-growth'
  | 'takeoff-speed'
  | 'physical-limits'
  | 'space-expansion'
  | 'risk-and-governance'

export interface AgiPillSource {
  readonly id: string
  readonly tier: SourceTier
  readonly title: string
  readonly publisher: string
  /** Deliberately absent for internal reference material and game inference. */
  readonly url?: `https://${string}`
  readonly topics: readonly SourceTopic[]
  readonly note: LocalizedText
  readonly caveat?: LocalizedText
  readonly variables?: readonly string[]
}

type CauseId = AgiPillCause['id']
type RivalId = RivalCivilization['id']
type RivalPosture = RivalCivilization['posture']

export type ResourceHeadroomBand = 'critical' | 'tight' | 'workable' | 'abundant'

export const PHASE_LABELS: Readonly<Record<AgiPillPhase, LocalizedText>> = {
  'year-1-3': { en: 'Years 1–3', ja: '1〜3年' },
  'year-3-5': { en: 'Years 3–5', ja: '3〜5年' },
  'year-5-10': { en: 'Years 5–10', ja: '5〜10年' },
  'post-dyson': { en: 'Beyond the first swarm', ja: '最初のスウォームの先' },
}

export const ERA_LABELS: Readonly<Record<AgiPillPhase, LocalizedText>> = {
  'year-1-3': { en: 'Conversion Pressure', ja: '産業転換圧力期' },
  'year-3-5': { en: 'Recursive Industry', ja: '自己増殖産業期' },
  'year-5-10': { en: 'Solar-System Expansion', ja: '太陽系展開期' },
  'post-dyson': { en: 'Plural Civilizations', ja: '分岐文明期' },
}

export const OUTCOME_LABELS: Readonly<Record<AgiPillOutcome, LocalizedText>> = {
  active: { en: 'Timeline active', ja: '世界線進行中' },
  stagnation: { en: 'Managed stagnation', ja: '管理された停滞' },
  'rival-takeover': { en: 'Rival capture', ja: '競合による奪取' },
  'industrial-accident': { en: 'Industrial cascade', ja: '産業連鎖事故' },
  misalignment: { en: 'Objective drift', ja: '目的ドリフト' },
  'pluralistic-expansion': { en: 'Pluralistic expansion', ja: '多元的文明拡張' },
}

export const CAUSE_LABELS: Readonly<Record<CauseId, LocalizedText>> = {
  'intelligence-compute-loop': { en: 'Intelligence ↔ compute loop', ja: '知能↔計算ループ' },
  'energy-robot-loop': { en: 'Energy ↔ robot-production loop', ja: 'エネルギー↔ロボット生産ループ' },
  'resource-bottleneck': { en: 'Resource bottleneck', ja: '資源ボトルネック' },
  'safety-gap': { en: 'Safety capacity gap', ja: '安全能力ギャップ' },
  'governance-gap': { en: 'Governance reach gap', ja: '統治到達力ギャップ' },
  'social-friction': { en: 'Social friction', ja: '社会摩擦' },
  'rival-pressure': { en: 'Rival pressure', ja: '競合圧力' },
  'orbital-relief': { en: 'Orbital resource relief', ja: '軌道資源による緩和' },
  'physical-ceiling': { en: 'Physical ceiling', ja: '物理上限' },
  incident: { en: 'Active incident', ja: '進行中の事故' },
}

export const RIVAL_LABELS: Readonly<Record<RivalId, LocalizedText>> = {
  'frontier-lab': { en: 'Frontier Lab Network', ja: 'フロンティア研究所連合' },
  'state-coalition': { en: 'State Compute Coalition', ja: '国家計算資源連合' },
  'open-collective': { en: 'Open Model Collective', ja: 'オープンモデル共同体' },
}

export const RIVAL_POSTURE_LABELS: Readonly<Record<RivalPosture, LocalizedText>> = {
  competitive: { en: 'Competitive', ja: '競争的' },
  guarded: { en: 'Guarded', ja: '警戒的' },
  cooperative: { en: 'Cooperative', ja: '協調的' },
}

export const HEADROOM_LABELS: Readonly<Record<ResourceHeadroomBand, LocalizedText>> = {
  critical: { en: 'Critical headroom', ja: '余力危機' },
  tight: { en: 'Tight headroom', ja: '余力逼迫' },
  workable: { en: 'Workable headroom', ja: '運用可能な余力' },
  abundant: { en: 'Abundant headroom', ja: '豊富な余力' },
}

export const CATALOG_SOURCE_TIER_LABELS: Readonly<Record<SourceTier, LocalizedText>> = {
  primary: { en: 'Primary research', ja: '一次研究' },
  'research-synthesis': { en: 'Research synthesis', ja: '研究統合・モデル分析' },
  'reference-article': { en: 'Reference article', ja: '参考記事' },
  'game-inference': { en: 'Game inference', ja: 'ゲーム上の推論' },
}

export const getLocalizedLabel = <T extends string>(
  labels: Readonly<Record<T, LocalizedText>>,
  id: T,
  locale: AgiPillLocale,
): string => labels[id][locale]

export const classifyResourceHeadroom = (headroom: number): ResourceHeadroomBand => {
  if (headroom < 0.12) return 'critical'
  if (headroom < 0.3) return 'tight'
  if (headroom < 0.55) return 'workable'
  return 'abundant'
}

/**
 * Player-facing copy is intentionally flat: UI consumers can request a key without
 * knowing where the text is rendered, and tests can enforce exact EN/JA parity.
 */
export const COPY = {
  en: {
    'mode.standard.name': 'Standard',
    'mode.standard.badge': 'Governed takeoff',
    'mode.standard.description': 'The original Codex 2040 scenario, tuned for deliberate governance and D1-compatible saves.',
    'mode.pill.name': 'AGI Pill',
    'mode.pill.badge': 'Civilization-scale takeoff',
    'mode.pill.description': 'A conditional, high-acceleration scenario where intelligence and industry can amplify each other—if you can keep control.',
    'mode.pill.warning': 'This is a scenario, not a forecast. Dates and magnitudes depend on assumptions you can challenge in Sources.',
    'mode.select.title': 'Choose a simulation mode',
    'mode.select.confirm': 'Begin this timeline',
    'mode.select.saved': 'This save will resume in its original mode.',
    'source.open': 'Sources & assumptions',
    'source.title': 'Evidence layers',
    'source.subtitle': 'Research, synthesis, reference material, and game inference are labeled separately.',
    'source.primary': 'Primary research',
    'source.research-synthesis': 'Research synthesis',
    'source.reference-article': 'Reference article',
    'source.game-inference': 'Game inference',
    'source.primary.help': 'A paper, dataset, or analysis presenting original scholarly work.',
    'source.research-synthesis.help': 'A research organization’s model or review combining evidence and assumptions.',
    'source.reference-article.help': 'The Japanese design reference that frames this mode; it is not treated as primary evidence.',
    'source.game-inference.help': 'A mechanic or extrapolation created for play. It is not an empirical claim.',
    'source.read': 'Open source',
    'source.noLink': 'No external citation',
    'source.conditional': 'Conditional scenario',
    'source.assumption': 'Model assumption',
    'source.uncertainty': 'Uncertainty remains',
    'phase.early': 'Conversion Era · typical scenario range 1–3 years',
    'phase.middle': 'Recursive Industry Era · typical range 3–5 years',
    'phase.late': 'Solar-System Expansion Era · typical range 5–10 years',
    'scale.earth': 'Earth system',
    'scale.orbit': 'Orbital economy',
    'scale.solar': 'Solar-system frontier',
    'scale.beyondSwarm': 'Beyond the first swarm',
    'scale.beyondSwarm.help': 'A Dyson swarm is an opening into new constraints—not a final victory screen.',
    'metric.intelligence': 'Intelligence',
    'metric.compute': 'Compute',
    'metric.energy': 'Energy',
    'metric.robotics': 'Robot capacity',
    'metric.resources': 'Accessible resources',
    'metric.safety': 'Safety margin',
    'metric.governance': 'Governance reach',
    'metric.friction': 'Social friction',
    'metric.rivals': 'Civilization pressure',
    'causality.title': 'Why the curve changed',
    'causality.feedback': 'Intelligence, compute, energy, and production are reinforcing one another.',
    'causality.bottleneck': 'The fastest loop is now constrained by {bottleneck}.',
    'risk.fastTakeoff': 'Faster takeoff leaves fewer decision cycles for verification and correction.',
    'risk.pdoom': 'Catastrophic risk band',
    'risk.pdoom.help': 'A scenario indicator, not an objective probability or a prediction attributed to any named person.',
    'ending.continue': 'Continue beyond the swarm',
    'ending.continue.help': 'The simulation expands its frontier while retaining safety, governance, and rival-civilization consequences.',
  },
  ja: {
    'mode.standard.name': 'Standard',
    'mode.standard.badge': '統治されたテイクオフ',
    'mode.standard.description': '慎重な統治を軸に調整された既存のCodex 2040。従来のD1セーブと互換です。',
    'mode.pill.name': 'AGIピル',
    'mode.pill.badge': '文明規模のテイクオフ',
    'mode.pill.description': '知能と産業が互いを増幅しうる、条件付きの超加速シナリオ。制御を保てるかが問われます。',
    'mode.pill.warning': 'これは予言ではなくシナリオです。年代と規模は仮定に依存し、「出典と仮定」から検討できます。',
    'mode.select.title': 'シミュレーションモードを選択',
    'mode.select.confirm': 'この世界線を始める',
    'mode.select.saved': 'セーブは開始時のモードのまま再開されます。',
    'source.open': '出典と仮定',
    'source.title': '根拠のレイヤー',
    'source.subtitle': '研究、統合分析、参考資料、ゲーム上の推論を分けて表示します。',
    'source.primary': '一次研究',
    'source.research-synthesis': '研究統合・モデル分析',
    'source.reference-article': '参考記事',
    'source.game-inference': 'ゲーム上の推論',
    'source.primary.help': '独自の学術的分析やデータを提示する論文・データセットです。',
    'source.research-synthesis.help': '研究機関が複数の証拠と仮定を組み合わせたモデルまたはレビューです。',
    'source.reference-article.help': '本モードの視点を構成した日本語参考記事です。一次資料としては扱いません。',
    'source.game-inference.help': '遊びのために設計した仕組みや外挿です。実証的事実ではありません。',
    'source.read': '出典を開く',
    'source.noLink': '外部出典なし',
    'source.conditional': '条件付きシナリオ',
    'source.assumption': 'モデル上の仮定',
    'source.uncertainty': '不確実性あり',
    'phase.early': '転換期 · 典型シナリオ範囲1〜3年',
    'phase.middle': '自己増殖産業期 · 典型範囲3〜5年',
    'phase.late': '太陽系展開期 · 典型範囲5〜10年',
    'scale.earth': '地球システム',
    'scale.orbit': '軌道経済圏',
    'scale.solar': '太陽系フロンティア',
    'scale.beyondSwarm': '最初のスウォームの先へ',
    'scale.beyondSwarm.help': 'ダイソンスウォームは最終勝利ではなく、新しい制約へ踏み出す序盤です。',
    'metric.intelligence': '知能',
    'metric.compute': '計算資源',
    'metric.energy': 'エネルギー',
    'metric.robotics': 'ロボット生産力',
    'metric.resources': '利用可能資源',
    'metric.safety': '安全余力',
    'metric.governance': '統治の到達力',
    'metric.friction': '社会摩擦',
    'metric.rivals': '文明間圧力',
    'causality.title': '曲線が変わった理由',
    'causality.feedback': '知能・計算・エネルギー・生産が相互に加速しています。',
    'causality.bottleneck': '最速のフィードバックは現在、{bottleneck}に制約されています。',
    'risk.fastTakeoff': 'テイクオフが速いほど、検証と修正に使える意思決定サイクルは少なくなります。',
    'risk.pdoom': '破局リスク推定',
    'risk.pdoom.help': 'シナリオ内の指標であり、客観確率でも、特定の論者に帰属する予言でもありません。',
    'ending.continue': 'スウォームの先へ続ける',
    'ending.continue.help': '安全・統治・分岐文明との関係を維持したまま、シミュレーションのフロンティアを拡張します。',
  },
} as const

export const SOURCE_TIER_LABEL_KEYS: Readonly<Record<SourceTier, AgiPillCopyKey>> = {
  primary: 'source.primary',
  'research-synthesis': 'source.research-synthesis',
  'reference-article': 'source.reference-article',
  'game-inference': 'source.game-inference',
}

export const AGI_PILL_SOURCES: readonly AgiPillSource[] = [
  {
    id: 'ideas-getting-harder',
    tier: 'primary',
    title: 'Are Ideas Getting Harder to Find?',
    publisher: 'American Economic Review',
    url: 'https://www.aeaweb.org/articles?id=10.1257/aer.20180338',
    topics: ['intelligence-explosion', 'physical-limits'],
    note: {
      en: 'Empirical evidence on declining research productivity; it does not itself predict an AGI takeoff.',
      ja: '研究生産性の低下を扱う実証研究です。AGIテイクオフ自体を予測する論文ではありません。',
    },
    caveat: {
      en: 'The measured decline in research productivity does not establish post-AGI returns or a takeoff date.',
      ja: '測定された研究生産性低下は、AGI後の収益率やテイクオフ時期を確立しません。',
    },
    variables: ['research difficulty', 'diminishing returns'],
  },
  {
    id: 'self-driving-laboratories',
    tier: 'research-synthesis',
    title: 'Self-Driving Laboratories for Chemistry and Materials Science',
    publisher: 'Chemical Reviews',
    url: 'https://pubs.acs.org/doi/10.1021/acs.chemrev.4c00055',
    topics: ['intelligence-explosion', 'physical-limits'],
    note: {
      en: 'A review of autonomous experimentation; individual acceleration results do not establish a universal speed-up.',
      ja: '自律実験を整理したレビューです。個別の加速実績は普遍的な加速率を確立しません。',
    },
    caveat: {
      en: 'Laboratory automation remains domain-specific and still depends on physical replication and validation.',
      ja: '実験室自動化は分野依存であり、物理的な再現と検証を引き続き必要とします。',
    },
    variables: ['experiment bottleneck', 'research velocity'],
  },
  {
    id: 'forethought-intelligence-explosion',
    tier: 'research-synthesis',
    title: 'Preparing for the Intelligence Explosion',
    publisher: 'Forethought',
    url: 'https://www.forethought.org/research/preparing-for-the-intelligence-explosion',
    topics: ['intelligence-explosion', 'superexponential-growth', 'physical-limits', 'risk-and-governance'],
    note: {
      en: 'A quantitative scenario analysis. Its acceleration ranges depend on assumptions rather than fixed future dates.',
      ja: '定量的なシナリオ分析です。加速幅は固定された未来年ではなく、置いた仮定に依存します。',
    },
    caveat: {
      en: 'The acceleration ranges are conditional model outputs, not consensus forecasts.',
      ja: '加速幅は条件付きモデル出力であり、合意された予測ではありません。',
    },
    variables: ['intelligence', 'compute', 'research velocity'],
  },
  {
    id: 'forethought-industrial-explosion',
    tier: 'research-synthesis',
    title: 'The Industrial Explosion',
    publisher: 'Forethought',
    url: 'https://www.forethought.org/research/the-industrial-explosion',
    topics: ['industrial-explosion', 'recursive-production', 'superexponential-growth', 'space-expansion'],
    note: {
      en: 'Models robot-factory replication, learning curves, and physical bottlenecks under explicit assumptions.',
      ja: '明示的な仮定のもとで、ロボット工場の自己複製、経験曲線、物理ボトルネックをモデル化しています。',
    },
    caveat: {
      en: 'Factory-ecology closure and rapid doubling remain scenario assumptions with major construction bottlenecks.',
      ja: '工場生態系の閉鎖と高速倍増は、大きな建設制約を伴うシナリオ仮定です。',
    },
    variables: ['robots', 'energy', 'resources', 'industrial velocity'],
  },
  {
    id: 'epoch-explosive-growth-review',
    tier: 'research-synthesis',
    title: 'Explosive Growth from AI: A Review of the Arguments',
    publisher: 'Epoch AI',
    url: 'https://epoch.ai/blog/explosive-growth-from-ai-a-review-of-the-arguments',
    topics: ['intelligence-explosion', 'industrial-explosion', 'superexponential-growth', 'risk-and-governance'],
    note: {
      en: 'Reviews both explosive-growth arguments and counterarguments such as regulation, alignment, and slow automation.',
      ja: '爆発的成長の議論と、規制・アライメント・自動化の遅れなどの反論を併記したレビューです。',
    },
    caveat: {
      en: 'The review concludes that explosive growth is difficult to rule out, not that it is inevitable.',
      ja: '爆発的成長を排除しにくいというレビューであり、必然性を示しません。',
    },
    variables: ['friction', 'governance', 'rival pressure'],
  },
  {
    id: 'ai-2027-scenario',
    tier: 'research-synthesis',
    title: 'AI 2027',
    publisher: 'AI Futures Project',
    url: 'https://ai-2027.com/',
    topics: ['takeoff-speed', 'risk-and-governance'],
    note: {
      en: 'A concrete scenario, not a dated prophecy. AGI Pill uses it as one fast-takeoff reference among several.',
      ja: '具体的なシナリオであり、年代を断定する予言ではありません。複数ある高速テイクオフ参照点の一つです。',
    },
    caveat: {
      en: 'This scenario is one possible fast-takeoff path and does not establish a calendar prediction.',
      ja: '高速テイクオフの一例であり、暦年予測を確立しません。',
    },
    variables: ['risk band', 'safety gap', 'rival pressure'],
  },
  {
    id: 'forethought-software-takeoff',
    tier: 'research-synthesis',
    title: 'How quick and big would a software intelligence explosion be?',
    publisher: 'Forethought',
    url: 'https://www.forethought.org/research/how-quick-and-big-would-a-software-intelligence-explosion-be',
    topics: ['intelligence-explosion', 'takeoff-speed', 'risk-and-governance'],
    note: {
      en: 'A judgement-heavy Monte Carlo model of software-driven takeoff under fixed compute.',
      ja: '計算量固定下のソフトウェア駆動テイクオフを扱う、判断依存度の高いモンテカルロモデルです。',
    },
    caveat: {
      en: 'The authors call the model speculative; its ranges are not measured frequencies.',
      ja: '著者自身が思弁的モデルと明記しており、提示範囲は観測頻度ではありません。',
    },
    variables: ['research velocity', 'risk band'],
  },
  {
    id: 'epoch-algorithmic-progress',
    tier: 'research-synthesis',
    title: 'How fast can algorithms advance capabilities?',
    publisher: 'Epoch AI',
    url: 'https://epoch.ai/gradient-updates/how-fast-can-algorithms-advance-capabilities',
    topics: ['intelligence-explosion', 'takeoff-speed', 'physical-limits'],
    note: {
      en: 'Analyzes how algorithmic progress can depend on compute and therefore limit software-only takeoff.',
      ja: 'アルゴリズム進歩の計算量依存性と、ソフトウェア単独テイクオフの制約を分析します。',
    },
    caveat: {
      en: 'This is a counterweight to unconstrained software growth, not a settled universal ceiling.',
      ja: '無制約のソフトウェア成長への反証材料ですが、普遍的な確定上限ではありません。',
    },
    variables: ['compute bottleneck', 'research velocity'],
  },
  {
    id: 'nasa-solar-luminosity',
    tier: 'primary',
    title: 'Universe glossary — solar luminosity',
    publisher: 'NASA Science',
    url: 'https://science.nasa.gov/universe/glossary/',
    topics: ['physical-limits', 'space-expansion'],
    note: {
      en: 'Official physical reference for the Sun’s luminosity; it does not establish rapid swarm buildability.',
      ja: '太陽光度の公式物理参照です。高速なスウォーム建設可能性を確立するものではありません。',
    },
    caveat: {
      en: 'Available stellar energy and the speed, legitimacy, and safety of capturing it are different questions.',
      ja: '恒星エネルギーの存在量と、その捕集速度・正統性・安全性は別の問いです。',
    },
    variables: ['first swarm threshold', 'energy'],
  },
  {
    id: 'nasa-space-communications',
    tier: 'primary',
    title: 'Space Communications: 7 Things You Need to Know',
    publisher: 'NASA',
    url: 'https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/',
    topics: ['physical-limits', 'space-expansion', 'risk-and-governance'],
    note: {
      en: 'Official reference for light-speed communication delays across the solar system.',
      ja: '太陽系規模での光速通信遅延を説明する公式資料です。',
    },
    caveat: {
      en: 'The game infers governance consequences from the physical delay; NASA does not endorse that scenario.',
      ja: 'ゲームは物理遅延から統治上の帰結を推論しますが、NASAがそのシナリオを支持するわけではありません。',
    },
    variables: ['branch civilizations', 'governance', 'rival pressure'],
  },
  {
    id: 'agi-pill-japanese-reference',
    tier: 'reference-article',
    title: 'AGIがもたらす産業・技術爆発とは何か',
    publisher: 'AGI Pill mode design reference',
    topics: ['intelligence-explosion', 'industrial-explosion', 'recursive-production', 'superexponential-growth', 'takeoff-speed', 'physical-limits', 'space-expansion', 'risk-and-governance'],
    note: {
      en: 'The Japanese reference article that inspired this mode. Its claims route to the research entries above where available.',
      ja: '本モードの正本級参考記事です。記事内の主張は、可能な範囲で上記の研究資料へ導線を分けています。',
    },
  },
  {
    id: 'agi-pill-system-model',
    tier: 'game-inference',
    title: 'AGI Pill coupled-system model',
    publisher: 'Codex 2040',
    topics: ['intelligence-explosion', 'industrial-explosion', 'recursive-production', 'superexponential-growth', 'takeoff-speed', 'physical-limits', 'space-expansion', 'risk-and-governance'],
    note: {
      en: 'Resource coupling, recoverable failure paths, rival civilizations, and post-swarm play are game-design inferences.',
      ja: '資源の相互作用、回復可能な失敗、分岐文明、スウォーム後の展開はゲームデザイン上の推論です。',
    },
  },
] as const

/**
 * Catalog refs are stable gameplay IDs. Several deliberately resolve to one
 * canonical source so event granularity never masquerades as extra evidence.
 */
export const AGI_PILL_SOURCE_REF_REGISTRY: Readonly<Record<string, string>> = {
  'ideas-getting-harder': 'ideas-getting-harder',
  'forethought-intelligence-explosion': 'forethought-intelligence-explosion',
  'forethought-preparing-intelligence-explosion': 'forethought-intelligence-explosion',
  'forethought-industrial-explosion': 'forethought-industrial-explosion',
  'epoch-explosive-growth-review': 'epoch-explosive-growth-review',
  'ai-2027-scenario': 'ai-2027-scenario',
  'forethought-software-takeoff': 'forethought-software-takeoff',
  'epoch-algorithmic-progress': 'epoch-algorithmic-progress',
  'nasa-solar-luminosity': 'nasa-solar-luminosity',
  'nasa-space-communications': 'nasa-space-communications',
  'self-driving-laboratories': 'self-driving-laboratories',
  'agi-pill-japanese-reference': 'agi-pill-japanese-reference',
  'agi-pill-system-model': 'agi-pill-system-model',
  'agi-industrial-explosion-reference': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-security-pressure': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-takeoff-speed': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-pdoom': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-physical-experiment-times': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-mutual-acceleration': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-social-friction': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-alignment-bottleneck': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-years-five-to-ten': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-post-human-demand': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-takeoff-pdoom-correlation': 'agi-pill-japanese-reference',
  'agi-explosion-reference-article-physical-limits': 'agi-pill-japanese-reference',
}

export const getPillCopy = (locale: AgiPillLocale, key: AgiPillCopyKey): string => COPY[locale][key]

export const getAgiPillSource = (id: string): AgiPillSource | undefined => {
  const canonicalId = AGI_PILL_SOURCE_REF_REGISTRY[id] ?? id
  return AGI_PILL_SOURCES.find((source) => source.id === canonicalId)
}

export const getAgiPillSourcesForTopic = (topic: SourceTopic): readonly AgiPillSource[] =>
  AGI_PILL_SOURCES.filter((source) => source.topics.includes(topic))
