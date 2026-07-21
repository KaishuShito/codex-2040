import type { EndingId, NewsItem, RegionId } from './engine'
import { RIVAL_NAMES } from './rivalStrategy'
import { STRATEGY_CATALOG } from './strategyNodes/catalog'
import { WORLD_EVENTS } from './worldEvents/catalog'
import type { WorldEventCombo, WorldEventDefinition } from './worldEvents/types'

export type StandardLocale = 'ja' | 'en'
export type StandardLocalizedText = Readonly<Record<StandardLocale, string>>

const pair = (ja: string, en: string): StandardLocalizedText => ({ ja, en })

export const STANDARD_COPY = {
  simulator: pair('AIガバナンス・シミュレーター', 'AI governance simulator'),
  howToPlay: pair('遊び方', 'How to play'),
  newGame: pair('新しいゲーム', 'New game'),
  voiceOperator: pair('ボイス・オペレーター', 'Voice operator'),
  soundOn: pair('効果音 オン', 'Sound on'),
  soundOff: pair('効果音 オフ', 'Sound off'),
  soundPlay: pair('効果音の再生', 'Sound playback'),
  soundMute: pair('効果音をミュート', 'Mute sound'),
  soundEnable: pair('効果音をオン', 'Enable sound'),
  bgmOn: pair('オン', 'on'),
  bgmStandby: pair('待機', 'standby'),
  bgmOff: pair('オフ', 'off'),
  deterministicEngine: pair('決定論エンジン', 'Deterministic engine'),
  scenarioIntel: pair('シナリオ情報', 'Scenario intel'),
  latestScenarioIntel: pair('最新シナリオ情報', 'Latest scenario intelligence'),
  sources: pair('情報源', 'Sources'),
  operationsMap: pair('作戦マップ', 'Operations map'),
  worldAccessNetwork: pair('世界AIアクセス網', 'Global AI access network'),
  rotateTitle: pair('端末を横向きにしてください', 'Rotate your device'),
  rotateBody: pair('Codex 2040は横向きの画面でプレーできます。', 'Codex 2040 is playable in landscape orientation.'),
  startTitle: pair('あなたはOpenAIのCEOです。', 'You are the CEO of OpenAI.'),
  startBody: pair('Codexの能力、製品、組織、公開戦略を決めてください。安全、統治、信頼、健全な競争を守りながら、2040年まで役立つAIを世界へ広げます。', 'Choose Codex capabilities, products, organization, and release strategy. Expand useful AI worldwide through 2040 while protecting safety, governance, trust, and healthy competition.'),
  startTutorial: pair('説明から始める', 'Start with tutorial'),
  skipTutorial: pair('説明をスキップ', 'Skip tutorial'),
  autoSave: pair('進行状況はこのブラウザに自動保存', 'Progress is saved automatically in this browser'),
  newTimeline: pair('新しい時間軸', 'New timeline'),
  restartTitle: pair('2026年から始めますか？', 'Start again from 2026?'),
  restartBody: pair('現在の時間軸と自動保存は上書きされ、元に戻せません。', 'Your current timeline and autosave will be overwritten and cannot be restored.'),
  continue: pair('続ける', 'Continue'),
  eraseStart: pair('消去して開始', 'Erase and start'),
  closeResume: pair('閉じて再開', 'Close and resume'),
  pausedGuide: pair('このガイドを開いている間、時間は止まります。', 'Time remains paused while this guide is open.'),
  back: pair('戻る', 'Back'),
  next: pair('次へ', 'Next'),
  start: pair('開始する', 'Start'),
  resume: pair('再開する', 'Resume'),
  strategy: pair('戦略', 'Strategy'),
  computeBudget: pair('計算予算', 'Compute budget'),
  computeCurrency: pair('PF · 投資に使う唯一の資源', 'PF · the single resource used for investment'),
  income: pair('収入', 'Income'),
  runningCost: pair('運用費', 'Running cost'),
  net: pair('純増減', 'Net'),
  model: pair('モデル', 'Model'),
  product: pair('製品', 'Product'),
  company: pair('組織', 'Company'),
  capability: pair('能力', 'Capability'),
  features: pair('機能', 'Features'),
  access: pair('アクセス', 'Access'),
  controlCapacity: pair('制御能力', 'Control capacity'),
  controlBalance: pair('制御バランス', 'Control balance'),
  safety: pair('安全', 'Safety'),
  governance: pair('統治', 'Governance'),
  ecosystemStrategy: pair('エコシステム戦略', 'Ecosystem strategy'),
  ecosystemHelp: pair('開放と協調の選択肢を見る', 'Explore openness and cooperation'),
  openStrategy: pair('戦略ツリーを開く', 'Open strategy tree'),
  eventHistory: pair('イベント履歴', 'Event history'),
  major: pair('主要', 'Major'),
  rivals: pair('競合', 'Rivals'),
  all: pair('すべて', 'All'),
  noNews: pair('まだ該当するニュースはありません', 'No matching news yet'),
  worldTelemetry: pair('世界テレメトリ', 'World telemetry'),
  telemetrySummary: pair('作戦マップ因果サマリー', 'Operations-map causal summary'),
  codexUsers: pair('CODEX利用者', 'CODEX users'),
  reach: pair('リーチ', 'Reach'),
  aiUserShare: pair('AI利用者シェア', 'AI user share'),
  worldAccess: pair('世界アクセス', 'Global access'),
  abundanceScore: pair('アバンダンススコア', 'Abundance score'),
  total: pair('総合', 'Overall'),
  regions: pair('地域', 'Regions'),
  competition: pair('競争', 'Competition'),
  socialTrust: pair('社会的信頼', 'Social trust'),
  trustTarget: pair('信頼目標', 'Trust target'),
  extinctionRisk: pair('人類絶滅リスク', 'Human extinction risk'),
  instantGameOver: pair('100% = 即時ゲームオーバー', '100% = immediate game over'),
  dangerDays: pair('危険日', 'Danger days'),
  marketHealth: pair('市場の健全性', 'Market health'),
  competitionEnvironment: pair('競争環境', 'Competitive environment'),
  pause: pair('停止', 'Pause'),
  normal: pair('通常', 'Normal'),
  fast: pair('高速', 'Fast'),
  selectedRegion: pair('選択中の地域', 'Selected region'),
  regulation: pair('規制', 'Regulation'),
  requiredResources: pair('必要資源', 'Required resources'),
  startCommunity: pair('交流イベントを開く', 'Open community event'),
  startOutpost: pair('最初の拠点を開く', 'Open first outpost'),
  sourceOpen: pair('の該当セクションを開く', ' — open cited section'),
} as const

export type StandardCopyKey = keyof typeof STANDARD_COPY
export const getStandardCopy = (locale: StandardLocale, key: StandardCopyKey): string => STANDARD_COPY[key][locale]
export const localizeStandard = (locale: StandardLocale, value: StandardLocalizedText): string => value[locale]

const JAPANESE_TEXT = /[ぁ-んァ-ヶ一-龠]/u

const eventWord = (word: string) => ({
  ai: 'AI', na: 'North American', qi: 'QI', goo: 'Goo', anthro: 'Anthro', codex: 'Codex',
  sdk: 'SDK', sso: 'SSO', zero: 'zero', day: 'day', multiyear: 'multi-year',
}[word] ?? word)

/** Stable authored IDs double as translation keys, keeping saves and the engine locale-neutral. */
export const standardEnglishLabelFromKey = (key: string): string => {
  const words = key
    .replace(/^(?:disaster|culture|policy|competition|technology)-(?:combo-)?/, '')
    .split('-')
    .filter(Boolean)
    .map(eventWord)
  const label = words.join(' ')
  return label ? `${label[0].toUpperCase()}${label.slice(1)}` : 'World update'
}

const WORLD_EVENT_HEADLINE_OVERRIDES: Readonly<Record<string, string>> = {
  'competition-anthro-frontier-launch': 'Anthro launches a high-trust frontier model',
  'competition-goo-multimodal-launch': 'Goo unifies search, video, and agents in a new model',
  'competition-qi-reasoning-launch': 'QI releases an efficient reasoning model',
  'technology-advanced-packaging-shortage': 'Advanced chip-packaging slowdown constrains AI supply',
  'technology-inference-compiler-breakthrough': 'New inference compiler cuts serving costs',
  'policy-public-algorithm-audits': 'Public agencies mandate audits for high-impact AI',
  'culture-valentines-connection-surge': 'Valentine advice surges across AI chat services',
  'disaster-amazon-flooded-backbone': 'Amazon flooding disrupts regional network backbones',
}

const englishWorldEventHeadline = (definition: WorldEventDefinition, combo?: WorldEventCombo): string => {
  if (combo?.headline) return standardEnglishLabelFromKey(combo.id)
  return WORLD_EVENT_HEADLINE_OVERRIDES[definition.id] ?? standardEnglishLabelFromKey(definition.id)
}

const WORLD_EVENT_CAUSE_COPY: Readonly<Record<WorldEventDefinition['category'], string>> = {
  disaster: 'Physical infrastructure and emergency conditions disrupted access across the affected region.',
  culture: 'A rapid change in public behavior shifted how and why people use AI services.',
  policy: 'Institutions responded to a gap between AI deployment and public rules or accountability.',
  competition: 'A competitor converted its capabilities, distribution, or operating model into market pressure.',
  technology: 'A change in hardware, software, or deployment methods altered the cost and capability frontier.',
}

const worldEventFlavor = (definition: WorldEventDefinition, combo?: WorldEventCombo): string => {
  const effect = combo?.effect ?? definition.effect
  const changes = [
    effect.usersDeltaPct !== 0 ? 'access' : null,
    effect.shareDelta !== 0 ? 'competitive share' : null,
    effect.growthRateDelta !== 0 ? 'adoption momentum' : null,
    effect.trustDelta !== 0 ? 'social trust' : null,
  ].filter((value): value is string => value !== null)
  return changes.length > 0
    ? `The event changes ${changes.join(', ')} for the stated duration; the dashboard shows the signed effects.`
    : 'The event changes the strategic context without an immediate numerical shock.'
}

export type StandardWorldEventCopy = Readonly<{
  headline: string
  cause: string
  flavor: string
  comboLabel?: string
  comboHeadline?: string
}>

export const getStandardWorldEventCopy = (
  locale: StandardLocale,
  definition: WorldEventDefinition,
  combo?: WorldEventCombo,
): StandardWorldEventCopy => locale === 'ja'
  ? {
      headline: combo?.headline ?? definition.headline,
      cause: definition.cause,
      flavor: definition.flavor,
      comboLabel: combo?.label,
      comboHeadline: combo?.headline,
    }
  : {
      headline: englishWorldEventHeadline(definition, combo),
      cause: WORLD_EVENT_CAUSE_COPY[definition.category],
      flavor: worldEventFlavor(definition, combo),
      comboLabel: combo ? standardEnglishLabelFromKey(combo.id) : undefined,
      comboHeadline: combo?.headline ? englishWorldEventHeadline(definition, combo) : undefined,
    }

const STATIC_NEWS_EN: Readonly<Record<string, string>> = {
  'CODEX拡大プロトコルが始動': 'CODEX expansion protocol begins',
  '開発エージェントが新たな信頼性水準へ': 'Development agents reach a new reliability threshold',
  'BUILD WEEK TOKYOからネットワークが広がる': 'The network expands from BUILD WEEK TOKYO',
  'エージェントがトップ開発者級の能力に到達': 'Agents reach top-developer capability',
  '進路を選べ：競争か、検証つき減速か': 'Choose a path: race or verified slowdown',
  '人間の専門家級で一線を守れ': 'Hold the line at expert-human capability',
  '安全事故 // Trustとシェアが急落': 'SAFETY INCIDENT // Trust and share fall sharply',
  '規制による凍結 // 普及拡大に上限': 'REGULATORY FREEZE // Adoption growth capped',
  'ミスアラインメント // 人間の統制を喪失': 'MISALIGNMENT // Human control lost',
  '検証済み改革により規制凍結を解除': 'Verified reforms lift the regulatory freeze',
  'TOKEN RESETで世界の開発力を解放': 'TOKEN RESET releases development capacity worldwide',
  'OPEN ECOSYSTEM宣言でAI市場全体が拡大': 'OPEN ECOSYSTEM declaration expands the overall AI market',
  'ローカル安全フィルターが機能リクエストを拒否': 'Local safety filter rejects the feature request',
  'EXTINCTION RISK 50% // 人類絶滅リスク上昇、安全投資で能力差を縮めよ': 'EXTINCTION RISK 50% // Close the capability gap with safety investment',
  'EXTINCTION RISK 80% // 人類絶滅リスク危険域、統制喪失が目前': 'EXTINCTION RISK 80% // Control loss is imminent',
}

const WORLD_EVENT_NEWS_EN = new Map<string, string>(WORLD_EVENTS.flatMap((definition) => [
  [definition.headline, englishWorldEventHeadline(definition)],
  ...(definition.combos ?? []).filter((combo) => combo.headline).map((combo) => [combo.headline!, englishWorldEventHeadline(definition, combo)] as const),
] as const))

const STRATEGY_TITLE_EN = new Map(STRATEGY_CATALOG.map((node) => [node.title.ja, node] as const))

const dynamicStandardNewsEnglish = (headline: string): string | null => {
  const region = Object.entries(STANDARD_REGION_LABELS).find(([, label]) => headline.startsWith(`${label.ja}でコミュニティ導入を開始`))
  if (region) return `Community launch begins in ${region[1].en}`
  const upgrade = headline.match(/^(モデル|安全性|ガバナンス|データセンター)計画が次の段階へ$/u)
  if (upgrade) return `${({ モデル: 'Model', 安全性: 'Safety', ガバナンス: 'Governance', データセンター: 'Data center' } as const)[upgrade[1] as 'モデル' | '安全性' | 'ガバナンス' | 'データセンター']} program advances to the next stage`
  const choice2029 = headline.match(/^2029年の進路：(競争を加速|一時減速|検証つき減速)$/u)
  if (choice2029) return `2029 path: ${{ 競争を加速: 'Accelerate the race', 一時減速: 'Temporary slowdown', 検証つき減速: 'Verified slowdown' }[choice2029[1]]}`
  const choice2035 = headline.match(/^2035年の決断：(一線を守る|再加速)$/u)
  if (choice2035) return `2035 decision: ${{ 一線を守る: 'Hold the line', 再加速: 'Accelerate again' }[choice2035[1]]}`
  const lifeline = headline.match(/^緊急計算協定 \/\/ (\d+) PFを確保、信頼とシェアを譲歩$/u)
  if (lifeline) return `EMERGENCY COMPUTE COMPACT // Secure ${lifeline[1]} PF at the cost of trust and share`
  const strategy = headline.match(/^(モデル|プロダクト|組織|オープン)戦略を導入 \/\/ (.+)$/u)
  if (strategy) {
    const node = STRATEGY_TITLE_EN.get(strategy[2])
    return `${({ モデル: 'MODEL', プロダクト: 'PRODUCT', 組織: 'COMPANY', オープン: 'OPEN' } as const)[strategy[1] as 'モデル' | 'プロダクト' | '組織' | 'オープン']} STRATEGY ADOPTED // ${node?.title.en ?? 'Authored strategy node'}`
  }
  const rival = headline.match(/^(ANTHRO|GOO|QI)が「(.+)」を導入/u)
  if (rival && RIVAL_NAMES.includes(rival[1] as (typeof RIVAL_NAMES)[number])) {
    const node = STRATEGY_TITLE_EN.get(rival[2])
    return `${rival[1]} adopts “${node?.title.en ?? 'an authored strategy'}” // Competitive pressure increases`
  }
  const feature = headline.match(/^(モバイル優先|教育アクセス＋児童データ審査|法人向け|コミュニティ設計)機能を公開：(.+)$/u)
  if (feature) return `${({ モバイル優先: 'Mobile-first', '教育アクセス＋児童データ審査': 'Education access with child-data review', 法人向け: 'Enterprise', コミュニティ設計: 'Community-designed' } as const)[feature[1] as 'モバイル優先' | '教育アクセス＋児童データ審査' | '法人向け' | 'コミュニティ設計']} feature released: ${JAPANESE_TEXT.test(feature[2]) ? '[player-authored source-language name]' : feature[2]}`
  return null
}

export const localizeStandardNewsHeadline = (
  locale: StandardLocale,
  item: Pick<NewsItem, 'headline' | 'source' | 'kind'>,
): string => {
  if (locale === 'ja') return item.headline
  const known = STATIC_NEWS_EN[item.headline] ?? WORLD_EVENT_NEWS_EN.get(item.headline) ?? dynamicStandardNewsEnglish(item.headline)
  if (known) return known
  if (!JAPANESE_TEXT.test(item.headline)) return item.headline
  if (item.source === 'Live GM') return 'LIVE GM // External briefing is available only in its source language'
  return item.kind === 'rival-strategy'
    ? 'RIVAL STRATEGY // Authored update is unavailable in English'
    : 'YOUR TIMELINE // Source-language update is unavailable in English'
}

export const STANDARD_REGION_LABELS: Readonly<Record<RegionId, StandardLocalizedText>> = {
  na: pair('北米', 'North America'), latam: pair('ラテンアメリカ', 'Latin America'), eu: pair('欧州', 'Europe'),
  africa: pair('アフリカ', 'Africa'), mena: pair('中東・北アフリカ', 'Middle East & North Africa'), india: pair('インド', 'India'),
  eastAsia: pair('東アジア', 'East Asia'), oceania: pair('オセアニア', 'Oceania'),
}

export const STANDARD_EVENT_CATEGORY_LABELS = {
  disaster: pair('災害', 'Disaster'), culture: pair('文化', 'Culture'), policy: pair('政策', 'Policy'),
  competition: pair('競争', 'Competition'), technology: pair('技術', 'Technology'),
} as const

export const STANDARD_TRUST_FACTOR_LABELS = {
  baseline: pair('制度基盤', 'Institutional baseline'), diversity: pair('事業者の多様性', 'Provider diversity'),
  safety: pair('安全能力', 'Safety capacity'), governance: pair('統治能力', 'Governance capacity'),
  'safety-gap': pair('能力 > 安全', 'Capability > safety'), 'governance-gap': pair('能力 > 統治', 'Capability > governance'),
  concentration: pair('市場集中', 'Market concentration'), events: pair('進行中イベント', 'Active events'),
} as const

export const STANDARD_TUTORIAL_STEPS = [
  { eyebrow: pair('あなたの役割', 'Your role'), title: pair('あなたはOpenAIのCEOです。', 'You are the CEO of OpenAI.'), body: pair('Codexの能力、製品、組織、公開戦略を決めます。人間の制御を守りながら役立つAIを広げ、2040年まで会社と社会の未来を導いてください。', 'Choose Codex capabilities, products, organization, and release strategy. Guide the company and society through 2040 while preserving human control.'), cue: pair('すべての決定はあなたが行います。開始するまで時間は止まっています。', 'You make every decision. Time is paused until you begin.') },
  { eyebrow: pair('ミッション', 'Mission'), title: pair('人間の制御を守り、役立つAIを広げる。', 'Protect human control and spread useful AI.'), body: pair('広いアクセス、高い信頼、強い安全と統治、2社以上の有力な競合を保って2040年を迎えます。独占は勝利ではありません。', 'Reach 2040 with broad access, high trust, strong safety and governance, and at least two capable rivals. Monopoly is not victory.'), cue: pair('能力だけでなく、安全・統治・競争の健全性も評価されます。', 'Safety, governance, and competitive health matter alongside capability.') },
  { eyebrow: pair('勢い', 'Momentum'), title: pair('待つだけでは前進しない。', 'Waiting alone does not create progress.'), body: pair('機能公開、地域展開、計算資源への投資、ボイス・オペレーターで成長期間を作ります。勢いが切れると普及は止まり、コストと競合だけが進みます。', 'Create growth windows through feature releases, regional expansion, compute investment, and the voice operator. Without momentum, adoption stalls while costs and rivals advance.'), cue: pair('右の戦略欄で勢いを確認できます。', 'Track momentum in the strategy panel.') },
  { eyebrow: pair('制御圧力', 'Control pressure'), title: pair('急成長には統治の課題が伴う。', 'Rapid growth creates governance challenges.'), body: pair('能力差、集中、事故、規制圧力が信頼を動かします。重大イベントでは時間が止まり、原因を読んでから再開できます。', 'Capability gaps, concentration, incidents, and regulation move trust. Critical events pause time so you can read the cause before resuming.'), cue: pair('左欄で信頼の要因と敗北リスクを確認できます。', 'Review trust causes and loss risks in the left panel.') },
  { eyebrow: pair('最初の一手', 'First move'), title: pair('未来を作り、その反応を乗り越える。', 'Build the future, then navigate its response.'), body: pair('教育モード、地域コミュニティ、戦略ツリーへの投資から始めます。通常と高速を切り替えられ、重大な決定では自動停止します。', 'Begin with Education Mode, regional communities, or the strategy tree. Switch between normal and fast time; critical decisions pause automatically.'), cue: pair('任意: ボイス・オペレーターでTIBOを呼ぶと、確認つきトークンリセットを試せます。', 'Optional: call TIBO through the voice operator to try a confirmed token reset.') },
] as const

export const STANDARD_ENDING_CONTEXT: Readonly<Record<EndingId, StandardLocalizedText>> = {
  'beneficial-abundance': pair('検証可能な減速と意図的な停止が、安全で多元的な再始動につながりました。', 'Verifiable slowdown and deliberate pauses enabled a safe, pluralistic restart.'),
  'managed-transition': pair('統治可能性は保ちましたが、Plan Aの条件をすべて満たせませんでした。', 'Governability survived, but not every condition of Plan A was met.'),
  'fragile-abundance': pair('豊かさを支える制度より先に、アクセスが広がりました。', 'Access expanded ahead of the institutions needed to sustain abundance.'),
  'race-future': pair('競争の加速が、制御された未来に必要な協調を上回りました。', 'Competitive acceleration outran the coordination needed for a controlled future.'),
  'regulatory-freeze': pair('統治の遅れにより、公共保護が有益な普及の足かせになりました。', 'Late governance turned public protection into a barrier to beneficial adoption.'),
  'safety-incident': pair('制御不足が重なり、リスクが実害と信頼低下に変わりました。', 'Accumulated control failures turned risk into harm and lost trust.'),
  misalignment: pair('安全不足が続き、人間の制度では制御を取り戻せない地点を越えました。', 'Persistent safety gaps crossed the point where human institutions could recover control.'),
  'pyrrhic-monopoly': pair('普及の代償に権力が集中し、自由で強靭な市場を失いました。', 'Adoption concentrated power and erased a free, resilient market.'),
}
