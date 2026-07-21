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
    'phase.early': 'Years 1–3 · Conversion pressure',
    'phase.middle': 'Years 3–5 · Recursive industry',
    'phase.late': 'Years 5–10 · Solar-system expansion',
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
    'risk.pdoom': 'Catastrophic-risk estimate',
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
    'phase.early': '1〜3年 · 産業転換圧力',
    'phase.middle': '3〜5年 · 自己増殖する産業',
    'phase.late': '5〜10年 · 太陽系への展開',
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

export const getPillCopy = (locale: AgiPillLocale, key: AgiPillCopyKey): string => COPY[locale][key]

export const getAgiPillSource = (id: string): AgiPillSource | undefined =>
  AGI_PILL_SOURCES.find((source) => source.id === id)

export const getAgiPillSourcesForTopic = (topic: SourceTopic): readonly AgiPillSource[] =>
  AGI_PILL_SOURCES.filter((source) => source.topics.includes(topic))
