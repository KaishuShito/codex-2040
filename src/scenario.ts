export const SOURCE_LABELS = ['AI 2027', 'AI 2040', 'Your Timeline', 'Live GM'] as const

export type SourceLabel = (typeof SOURCE_LABELS)[number]

export type SourceLabelMetadata = {
  label: SourceLabel
  provenance: 'reference-scenario' | 'player-counterfactual' | 'generated-inference'
  description: string
  url?: string
}

export const AI_2027_URL = 'https://ai-2027.com/'
export const AI_2040_URL = 'https://ai-2040.com/'

const sourceMetadata: Readonly<Record<SourceLabel, SourceLabelMetadata>> = {
  'AI 2027': {
    label: 'AI 2027',
    provenance: 'reference-scenario',
    description: 'AI 2027の能力向上・開発競争・減速の力学をもとにした参照シナリオ。',
    url: AI_2027_URL,
  },
  'AI 2040': {
    label: 'AI 2040',
    provenance: 'reference-scenario',
    description: 'AI 2040のPlan Aにあるガバナンスと協調案をもとにした参照シナリオ。',
    url: AI_2040_URL,
  },
  'Your Timeline': {
    label: 'Your Timeline',
    provenance: 'player-counterfactual',
    description: '参照シナリオの主張ではなく、プレイヤーの選択から生じた展開。',
  },
  'Live GM': {
    label: 'Live GM',
    provenance: 'generated-inference',
    description: '出典の予測ではなく、現在の状態をもとにCodex GMが生成した展開。',
  },
}

export const getSourceLabelMetadata = (label: SourceLabel): SourceLabelMetadata => sourceMetadata[label]

export const listSourceLabelMetadata = (): readonly SourceLabelMetadata[] =>
  SOURCE_LABELS.map((label) => sourceMetadata[label])

export type EndingId =
  | 'beneficial-abundance'
  | 'regulatory-freeze'
  | 'safety-incident'
  | 'misalignment'
  | 'pyrrhic-monopoly'

export type ScenarioRoute =
  | 'baseline'
  | 'race'
  | 'temporary-slowdown'
  | 'plan-a'
  | 'controlled-pause'
  | 'renewed-race'

export type ScenarioEffects = Partial<Readonly<{
  capability: number
  safety: number
  governance: number
  trust: number
  growth: number
  competition: number
  publicAccess: number
}>>

export type EndingAffinity = {
  endingId: EndingId
  weight: number
}

export type DecisionOption = {
  id: string
  label: string
  summary: string
  route: ScenarioRoute
  effects: ScenarioEffects
  setsFlags: readonly string[]
  endingAffinity: readonly EndingAffinity[]
}

export type ScenarioDecision = {
  id: string
  prompt: string
  required: true
  options: readonly DecisionOption[]
}

export type Milestone = {
  id: string
  date: `${number}-${number}-${number}`
  title: string
  kind: 'event' | 'decision' | 'resolution'
  source: SourceLabel
  summary: string
  whyThisMatters: string
  sourceUrl?: string
  effects?: ScenarioEffects
  decision?: ScenarioDecision
}

const decision2029: ScenarioDecision = {
  id: 'decision-2029-plan',
  prompt: '自己改善が実用化競争を加速させるなか、フロンティアラボはどう動く？',
  required: true,
  options: [
    {
      id: 'race-ahead',
      label: '先行して加速',
      summary: '安全性とガバナンスの遅れを承知で、優位を守るためにスケールを続ける。',
      route: 'race',
      effects: { capability: 2, growth: 0.22, safety: -1, governance: -1, trust: -8, competition: -0.12 },
      setsFlags: ['chose-race-2029'],
      endingAffinity: [
        { endingId: 'safety-incident', weight: 2 },
        { endingId: 'misalignment', weight: 2 },
        { endingId: 'pyrrhic-monopoly', weight: 1 },
      ],
    },
    {
      id: 'temporary-slowdown',
      label: '一時減速',
      summary: '国際検証なしで急拡大を一時停止し、社内の安全対策を強化する。',
      route: 'temporary-slowdown',
      effects: { growth: -0.08, safety: 1, governance: 1, trust: 4 },
      setsFlags: ['chose-temporary-slowdown-2029'],
      endingAffinity: [
        { endingId: 'safety-incident', weight: -1 },
        { endingId: 'regulatory-freeze', weight: 1 },
      ],
    },
    {
      id: 'verified-slowdown',
      label: '国際検証つき減速',
      summary: '短期の速度を譲り、共同監視と透明な基準を整え、複数ラボが追いつく時間をつくる。',
      route: 'plan-a',
      effects: { growth: -0.14, safety: 2, governance: 2, trust: 10, competition: 0.18, publicAccess: 0.1 },
      setsFlags: ['chose-verified-slowdown-2029', 'plan-a-eligible'],
      endingAffinity: [
        { endingId: 'beneficial-abundance', weight: 3 },
        { endingId: 'misalignment', weight: -2 },
        { endingId: 'pyrrhic-monopoly', weight: -2 },
      ],
    },
  ],
}

const decision2035: ScenarioDecision = {
  id: 'decision-2035-hold-line',
  prompt: 'フロンティアAIが人間の最高専門家に並んだ。意図的に止める？ それとも再加速する？',
  required: true,
  options: [
    {
      id: 'hold-the-line',
      label: '一線を守る',
      summary: '評価、国際検証、公的機関が成熟するまで能力の上限を維持する。',
      route: 'controlled-pause',
      effects: { growth: -0.12, safety: 2, governance: 2, trust: 8, competition: 0.1, publicAccess: 0.08 },
      setsFlags: ['chose-deliberate-pause-2035', 'beneficial-restart-eligible'],
      endingAffinity: [
        { endingId: 'beneficial-abundance', weight: 3 },
        { endingId: 'misalignment', weight: -2 },
        { endingId: 'regulatory-freeze', weight: -1 },
      ],
    },
    {
      id: 'accelerate-again',
      label: '再加速',
      summary: '安全策の大規模な実証を待たず、競争圧力に応えて能力開発を再加速する。',
      route: 'renewed-race',
      effects: { capability: 2, growth: 0.2, safety: -1, governance: -1, trust: -10, competition: -0.1 },
      setsFlags: ['chose-acceleration-2035'],
      endingAffinity: [
        { endingId: 'safety-incident', weight: 2 },
        { endingId: 'misalignment', weight: 3 },
        { endingId: 'pyrrhic-monopoly', weight: 1 },
      ],
    },
  ],
}

export const MILESTONE_DECK: readonly Milestone[] = [
  {
    id: '2026-codex-foundation',
    date: '2026-01-01',
    title: '実用化の扉が開く',
    kind: 'event',
    source: 'AI 2027',
    summary: '信頼できるコーディングエージェントが、実験から日常の開発現場へ移り始める。',
    whyThisMatters: '早期普及は改善資源を生む一方、安全策への最初の投資責任も生む。',
    sourceUrl: AI_2027_URL,
    effects: { growth: 0.04, publicAccess: 0.02 },
  },
  {
    id: '2026-build-week-network',
    date: '2026-07-18',
    title: '開発者が世界規模でつながる',
    kind: 'event',
    source: 'Your Timeline',
    summary: '各地のコミュニティが、開発者ツールを実用的な導入エコシステムへ広げる。',
    whyThisMatters: '普及を決めるのは能力値だけでなく、人と制度でもある。',
    effects: { growth: 0.06, trust: 2, publicAccess: 0.03 },
  },
  {
    id: '2027-expert-coding-agents',
    date: '2027-03-01',
    title: 'エージェントが専門家級の開発へ',
    kind: 'event',
    source: 'AI 2027',
    summary: '自律エージェントが長期の開発作業を担い、AI研究そのものを加速させる。',
    whyThisMatters: 'AIがAI開発を改善すると、能力が安全性やガバナンスを予想外の速さで追い越しうる。',
    sourceUrl: AI_2027_URL,
    effects: { capability: 1, growth: 0.1 },
  },
  {
    id: '2027-race-pressure',
    date: '2027-09-01',
    title: '開発の循環が加速',
    kind: 'event',
    source: 'AI 2027',
    summary: '研究自動化の効果が重なり、競合が迫るなか、各ラボはリリース周期を短縮する。',
    whyThisMatters: '競争圧力は、個々には合理的なリリースを全体として危険にしうる。',
    sourceUrl: `${AI_2027_URL}race`,
    effects: { capability: 1, growth: 0.08, trust: -3, competition: -0.04 },
  },
  {
    id: '2028-agent-economy',
    date: '2028-07-01',
    title: 'エージェント経済が台頭',
    kind: 'event',
    source: 'Your Timeline',
    summary: '企業、教育、科学、公共サービスをまたいでエージェントが連携し、制度の適応が追いつかない。',
    whyThisMatters: 'アクセス拡大で恩恵は増すが、障害も接続されたシステム全体へ波及する。',
    effects: { growth: 0.12, publicAccess: 0.05, trust: -2 },
  },
  {
    id: '2029-choose-a-path',
    date: '2029-01-15',
    title: '進路を選ぶ',
    kind: 'decision',
    source: 'AI 2040',
    summary: '短い協調機会のなか、競争、単独停止、国際検証つき減速のいずれかを選ぶ。',
    whyThisMatters: 'この選択で、得た時間が共有の安全資源になるか、次の競争までの先延ばしになるかが決まる。',
    sourceUrl: AI_2040_URL,
    decision: decision2029,
  },
  {
    id: '2030-transparent-scaling',
    date: '2030-06-01',
    title: '透明なスケーリングが始まる',
    kind: 'event',
    source: 'AI 2040',
    summary: '公開報告と共同評価により、複数のラボや国で能力向上を追跡しやすくなる。',
    whyThisMatters: '減速は、参加者が検証でき、競合が存続できてこそ意味を持つ。',
    sourceUrl: AI_2040_URL,
    effects: { governance: 1, trust: 3, competition: 0.04 },
  },
  {
    id: '2032-verification-network',
    date: '2032-04-01',
    title: '検証が社会基盤になる',
    kind: 'event',
    source: 'AI 2040',
    summary: 'Compute監視、事故開示、共同評価が例外ではなく日常になる。',
    whyThisMatters: '持続的な協力には約束だけでなく、確認できる履行が必要だ。',
    sourceUrl: AI_2040_URL,
    effects: { safety: 1, governance: 1, trust: 4 },
  },
  {
    id: '2033-many-frontiers',
    date: '2033-08-01',
    title: '多くのラボが最前線へ',
    kind: 'event',
    source: 'AI 2040',
    summary: '多様なプロバイダーが、共通の評価ルールのもとで高度な能力に到達する。',
    whyThisMatters: '分散化は単独支配を抑える一方、共通の安全基準をさらに重要にする。',
    sourceUrl: AI_2040_URL,
    effects: { competition: 0.1, publicAccess: 0.06, trust: 3 },
  },
  {
    id: '2035-hold-the-line',
    date: '2035-01-15',
    title: '一線を守る',
    kind: 'decision',
    source: 'AI 2040',
    summary: 'AIが人間の最高専門家に迫り、拡大継続を求める経済・地政学的圧力が頂点に達する。',
    whyThisMatters: '意図的な停止は、人間の統制を短期的な競争優位より優先できるかを試す。',
    sourceUrl: AI_2040_URL,
    decision: decision2035,
  },
  {
    id: '2037-safety-case',
    date: '2037-06-01',
    title: '安全性の根拠を検証',
    kind: 'event',
    source: 'AI 2040',
    summary: '再開前に、独立チームがアラインメントの証拠、展開管理、復旧計画を厳しく検証する。',
    whyThisMatters: '時間は、厳しい検証に耐える証拠へ変えてこそ役に立つ。',
    sourceUrl: AI_2040_URL,
    effects: { safety: 1, governance: 1, trust: 2 },
  },
  {
    id: '2039-restart-review',
    date: '2039-07-01',
    title: '再開審査',
    kind: 'event',
    source: 'AI 2040',
    summary: '政府、ラボ、公益団体が安全性の証拠を比較し、管理された進歩を再開できるか判断する。',
    whyThisMatters: '正当な再開には、安全性、説明責任、アクセス、競争の同時進展が必要だ。',
    sourceUrl: AI_2040_URL,
    effects: { trust: 3, publicAccess: 0.04 },
  },
  {
    id: '2040-timeline-resolution',
    date: '2040-01-01',
    title: 'あなたの2040年',
    kind: 'resolution',
    source: 'Your Timeline',
    summary: 'あなたの選択を参照シナリオと比較し、その選択が可能にした結末を描く。',
    whyThisMatters: '未来は一つの予測ではない。選択の連鎖であり、その代償を検証し学べる。',
  },
]

export type MilestoneQuery = {
  after?: string
  through: string
  excludeIds?: Iterable<string>
}

/** Returns every unconsumed milestone in the (after, through] window, in deterministic deck order. */
export const getDueMilestones = ({ after, through, excludeIds = [] }: MilestoneQuery): readonly Milestone[] => {
  const excluded = new Set(excludeIds)
  return MILESTONE_DECK.filter((milestone) =>
    milestone.date <= through
    && (after === undefined || milestone.date > after)
    && !excluded.has(milestone.id))
}

export const getDecisionMilestones = (): readonly Milestone[] =>
  MILESTONE_DECK.filter((milestone) => milestone.kind === 'decision')

export type EndingMetric =
  | 'score'
  | 'worldAdoption'
  | 'hhi'
  | 'safetyGap'
  | 'governanceGap'
  | 'safetyIncidentCount'
  | 'unsafeGapDays'
  | 'unresolvedMisalignment'

export type EndingCriterion = {
  metric: EndingMetric
  operator: '>=' | '>' | '<=' | '<' | '=='
  value: number
}

export type EndingDefinition = {
  id: EndingId
  title: string
  kind: 'ranked' | 'branch' | 'terminal'
  rank?: 'S' | 'A' | 'B' | 'C'
  priority: number
  conditionMode: 'all' | 'any'
  criteria: readonly EndingCriterion[]
  requiresFlags?: readonly string[]
  source: SourceLabel
  summary: string
  whyThisMatters: string
  closingLine: string
}

export const ENDINGS: readonly EndingDefinition[] = [
  {
    id: 'misalignment',
    title: 'ミスアラインメント',
    kind: 'terminal',
    priority: 100,
    conditionMode: 'all',
    criteria: [
      { metric: 'safetyGap', operator: '>=', value: 3 },
      { metric: 'unsafeGapDays', operator: '>=', value: 90 },
      { metric: 'unresolvedMisalignment', operator: '>', value: 0 },
    ],
    source: 'AI 2027',
    summary: '能力が信頼できる統制を長く上回り、警告を人類の主導権喪失へ変えてしまった。',
    whyThisMatters: '統制の遅れが続くことは、通常の製品障害とは根本的に異なる。',
    closingLine: '人類が行き先を選ぶ前に、競争は終わった。',
  },
  {
    id: 'regulatory-freeze',
    title: '規制による凍結',
    kind: 'terminal',
    priority: 80,
    conditionMode: 'any',
    criteria: [
      { metric: 'governanceGap', operator: '>=', value: 3 },
      { metric: 'hhi', operator: '>', value: 0.6 },
    ],
    source: 'Your Timeline',
    summary: '無責任な拡大や権力集中が規制の連鎖を招き、有益な導入まで止めた。',
    whyThisMatters: 'ガバナンスの遅れは、技術が有用でも社会から導入の支持を奪う。',
    closingLine: '世界が拒んだのはAIではない。その導入条件だった。',
  },
  {
    id: 'safety-incident',
    title: '安全事故',
    kind: 'branch',
    priority: 70,
    conditionMode: 'all',
    criteria: [
      { metric: 'safetyGap', operator: '>=', value: 3 },
      { metric: 'safetyIncidentCount', operator: '>=', value: 1 },
    ],
    source: 'Your Timeline',
    summary: '防げたはずの事故がTrustとアクセスを損なった。能力開発が安全性を置き去りにしなければ復旧できる。',
    whyThisMatters: '事故が教訓になるのは、被害が重なる前に組織が学べる場合だけだ。',
    closingLine: '警告は教訓になった。繰り返すかどうかは、まだあなたが選べる。',
  },
  {
    id: 'pyrrhic-monopoly',
    title: '代償の大きい独占',
    kind: 'terminal',
    priority: 60,
    conditionMode: 'all',
    criteria: [
      { metric: 'worldAdoption', operator: '>=', value: 0.7 },
      { metric: 'hhi', operator: '>', value: 0.6 },
    ],
    source: 'Your Timeline',
    summary: 'AIアクセスは広がったが、空虚な勝利によりエコシステムは一社に依存した。',
    whyThisMatters: '競争なき普及は権力を集中させ、持続的な公益に必要な回復力を奪う。',
    closingLine: '世界中に届いた。世界が応える余地は残せただろうか？',
  },
  {
    id: 'beneficial-abundance',
    title: '有益な豊かさ',
    kind: 'ranked',
    rank: 'S',
    priority: 50,
    conditionMode: 'all',
    criteria: [
      { metric: 'score', operator: '>=', value: 0.85 },
      { metric: 'hhi', operator: '<=', value: 0.6 },
      { metric: 'unresolvedMisalignment', operator: '==', value: 0 },
    ],
    requiresFlags: ['chose-verified-slowdown-2029', 'chose-deliberate-pause-2035'],
    source: 'AI 2040',
    summary: '検証可能な自制が、人間の統制、健全な競争、幅広いアクセスを守り、安全な再開につなげた。',
    whyThisMatters: '最良の結末は、豊かさに証拠、説明責任、多様なエコシステムを組み合わせる。',
    closingLine: '世界を所有したのではない。世界が学ぶのを助けた。',
  },
]

export const getEndingDefinition = (id: EndingId): EndingDefinition | undefined =>
  ENDINGS.find((ending) => ending.id === id)
