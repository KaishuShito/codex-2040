import type { EndingId, RegionId } from './engine'

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
