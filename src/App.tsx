import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  ChevronRight,
  CirclePause,
  CirclePlay,
  ChevronsRight,
  Cpu,
  GraduationCap,
  Network,
  Phone,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  END_DAY,
  SPEEDS,
  START_DATE,
  addFeature,
  acknowledgeWorldEvent,
  advanceRealtime,
  buyUpgrade,
  choose2029,
  choose2035,
  constants,
  createInitialState,
  dateLabel,
  evaluateEnding,
  introduceRegion,
  metrics,
  openEcosystem,
  runFrame,
  scoreState,
  trustBreakdown,
  triggerReset,
  type Choice2029,
  type Choice2035,
  type EndingId,
  type GameState,
  type NewsItem,
  type RegionId,
  type Speed,
  type Upgrade,
} from './engine'
import { filterPlayerInput } from './gm'
import { AI_2040_URL, getDecisionMilestones, type SourceLabel } from './scenario'
import WorldMap, { type WorldMapCompetitiveView, type WorldMapMarker, type WorldMapRegionIntensity } from './components/WorldMap'
import UpgradeOverlay, {
  type UpgradeOverlayAction,
  type UpgradeOverlayCosts,
  type UpgradeOverlayFeature,
  type UpgradeOverlayTab,
} from './components/UpgradeOverlay'
import ScenarioDecision, { type ScenarioDecisionOptions } from './components/ScenarioDecision'
import EndingOverlay, { type DecisionDivergences } from './components/EndingOverlay'
import VoiceCallPanel, { type VoiceSubtitle } from './components/VoiceCallPanel'
import WorldEventPopup, { type WorldEventPopupNotice } from './components/WorldEventPopup'
import { RealtimeVoiceClient, type MicPermissionStatus, type VoiceConnectionStatus } from './voiceAgent'
import {
  createVoiceResetState,
  handleRealtimeResetToolCall,
  requestFallbackReset,
  resolveVoiceReset,
  type VoiceResetState,
} from './voiceReset'
import { GameAudio, type GameSound } from './sound'
import { decodeSession, encodeSession, SESSION_STORAGE_KEY } from './session'

const EDUCATION_PROMPT = 'Free Education Mode for schools worldwide'
const dayFor = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - START_DATE) / 86_400_000)
const DECISION_2029_DAY = dayFor('2029-01-01')
const DECISION_2035_DAY = dayFor('2035-01-01')

const ENDING_CONTEXT: Record<EndingId, string> = {
  'beneficial-abundance': '検証可能な減速と意図的な停止が、安全で多元的な再始動につながりました。',
  'managed-transition': '統治可能性は保ちましたが、Plan Aの条件をすべて満たせませんでした。',
  'fragile-abundance': '豊かさを支える制度より先に、アクセスが広がりました。',
  'race-future': '競争の加速が、制御された未来に必要な協調を上回りました。',
  'regulatory-freeze': '統治の遅れにより、公共保護が有益な普及の足かせになりました。',
  'safety-incident': '制御不足が重なり、リスクが実害と信頼低下に変わりました。',
  misalignment: '安全不足が続き、人間の制度では制御を取り戻せない地点を越えました。',
  'pyrrhic-monopoly': '普及の代償に権力が集中し、自由で強靭な市場を失いました。',
}

const decisionMilestones = getDecisionMilestones()
const scenario2029 = decisionMilestones.find((milestone) => milestone.date.startsWith('2029-'))!
const scenario2035 = decisionMilestones.find((milestone) => milestone.date.startsWith('2035-'))!

const fmt = (value: number, maximumFractionDigits = 0) => new Intl.NumberFormat('ja-JP', { maximumFractionDigits }).format(value)
const pct = (value: number) => `${Math.round(value * 100)}%`
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

const initialGame = (): GameState => ({
  ...createInitialState(),
  speed: 1,
})

type InitialSession = { state: GameState; hasStarted: boolean; restored: boolean }

const loadInitialSession = (): InitialSession => {
  if (typeof window !== 'undefined') {
    try {
      const persisted = decodeSession(window.localStorage.getItem(SESSION_STORAGE_KEY))
      if (persisted) return { state: persisted.state, hasStarted: persisted.hasStarted, restored: true }
    } catch {
      // Storage can be disabled; the deterministic game still starts normally.
    }
  }
  return { state: initialGame(), hasStarted: false, restored: false }
}

const RIVAL_NAMES = ['ANTHRO', 'GOO', 'QI'] as const
const RIVAL_COLORS = [[123, 198, 255], [255, 185, 92], [190, 130, 255]] as const
const RIVAL_REGION_FIT: Record<RegionId, readonly [number, number, number]> = {
  na: [1.5, 1.18, .62],
  latam: [.72, 1.42, .86],
  eu: [1.35, 1.12, .7],
  africa: [.7, 1.28, 1.08],
  mena: [.82, 1.04, 1.3],
  india: [.78, 1.4, 1.12],
  eastAsia: [.68, 1.05, 1.62],
  oceania: [1.1, 1.25, .72],
}

const REGION_LABELS: Record<RegionId, string> = {
  na: '北米',
  latam: 'ラテンアメリカ',
  eu: '欧州',
  africa: 'アフリカ',
  mena: '中東・北アフリカ',
  india: 'インド',
  eastAsia: '東アジア',
  oceania: 'オセアニア',
}

const WORLD_EVENT_CATEGORY_LABELS = {
  disaster: '災害',
  culture: '文化',
  policy: '政策',
  competition: '競争',
  technology: '技術',
} as const

const TRUST_FACTOR_LABELS = {
  baseline: '制度基盤',
  diversity: '事業者の多様性',
  safety: '安全能力',
  governance: '統治能力',
  'safety-gap': '能力 > 安全',
  'governance-gap': '能力 > 統治',
  concentration: '市場集中',
  events: '進行中イベント',
} as const

const TUTORIAL_STEPS = [
  {
    eyebrow: 'ミッション',
    title: '人間の制御を守り、役立つAIを広げる。',
    body: '広いアクセス、高い信頼、強い安全と統治、2社以上の有力な競合を保って2040年を迎えます。独占は勝利ではありません。',
    cue: '開始するまで時間は止まっています。',
  },
  {
    eyebrow: '勢い',
    title: '待つだけでは前進しない。',
    body: '機能公開、地域展開、計算資源への投資、ボイス・オペレーターで成長期間を作ります。勢いが切れると普及は止まり、コストと競合だけが進みます。',
    cue: '右の戦略欄で勢いを確認できます。',
  },
  {
    eyebrow: '制御圧力',
    title: '急成長には統治の課題が伴う。',
    body: '能力差、集中、事故、規制圧力が信頼を動かします。重大イベントでは時間が止まり、原因を読んでから再開できます。',
    cue: '左欄で信頼の要因と敗北リスクを確認できます。',
  },
  {
    eyebrow: '最初の一手',
    title: '未来を作り、その反応を乗り越える。',
    body: '教育モード、地域コミュニティ、戦略ツリーへの投資から始めます。通常と高速を切り替えられ、重大な決定では自動停止します。',
    cue: '任意: ボイス・オペレーターでKiboを呼ぶと、確認つきトークンリセットを試せます。',
  },
] as const

function Meter({ label, value, max = 100, danger = false, hint }: { label: string; value: number; max?: number; danger?: boolean; hint?: string }) {
  const normalized = clamp(value / max * 100)
  return (
    <div className={`meter${danger ? ' is-danger' : ''}`}>
      <div className="meter__label"><span>{label}</span><b>{value.toFixed(max <= 10 ? 1 : 0)}</b></div>
      <div
        className="meter__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(clamp(value, 0, max) * 10) / 10}
        aria-valuetext={`${value.toFixed(max <= 10 ? 1 : 0)} / ${max}`}
      ><i style={{ width: `${normalized}%` }} /></div>
      {hint && <small>{hint}</small>}
    </div>
  )
}

function SourceBadge({ source }: { source: SourceLabel }) {
  const label = source === 'Your Timeline' ? 'あなたの時間軸' : source === 'Live GM' ? 'ライブGM' : source
  return <span className="source-badge" data-source={source}>{label}</span>
}

function OverflowTicker({ text, className = '' }: { text: string; className?: string }) {
  const viewportRef = useRef<HTMLSpanElement>(null)
  const copyRef = useRef<HTMLSpanElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    const copy = copyRef.current
    if (!viewport || !copy) return
    const measure = () => setOverflowing(copy.scrollWidth > viewport.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(copy)
    return () => observer.disconnect()
  }, [text])

  const duration = `${Math.max(12, Math.min(30, text.length * .42))}s`
  return (
    <span
      ref={viewportRef}
      className={`overflow-ticker${overflowing ? ' is-overflowing' : ''}${className ? ` ${className}` : ''}`}
      title={text}
    >
      <span className="overflow-ticker__track" style={{ '--ticker-duration': duration } as CSSProperties}>
        <span ref={copyRef} className="overflow-ticker__copy">{text}</span>
        {overflowing && <span className="overflow-ticker__copy" aria-hidden="true">{text}</span>}
      </span>
    </span>
  )
}

export default function App() {
  const [initialSession] = useState(loadInitialSession)
  const [state, setState] = useState<GameState>(initialSession.state)
  const [showStartScreen, setShowStartScreen] = useState(!initialSession.restored || !initialSession.hasStarted)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const [hasStarted, setHasStarted] = useState(initialSession.hasStarted)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [actionNudge, setActionNudge] = useState(false)
  const [paused, setPaused] = useState(false)
  const [criticalNews, setCriticalNews] = useState<NewsItem | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId | null>('eastAsia')
  const [selectedCompetitor, setSelectedCompetitor] = useState<number | null>(null)
  const [featureText, setFeatureText] = useState('')
  const [featureStatus, setFeatureStatus] = useState('効果はすぐ反映されます。公開前後にアドバイザーへ相談できます。')
  const [resetPulse, setResetPulse] = useState(0)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeTab, setUpgradeTab] = useState<UpgradeOverlayTab>('model')
  const [decisionSelection, setDecisionSelection] = useState<string | null>(null)
  const [endingVisible, setEndingVisible] = useState(true)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<VoiceConnectionStatus>('idle')
  const [micPermission, setMicPermission] = useState<MicPermissionStatus>('unknown')
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [voiceSubtitles, setVoiceSubtitles] = useState<VoiceSubtitle[]>([])
  const [operatorDraft, setOperatorDraft] = useState('')
  const [voiceResetState, setVoiceResetState] = useState(createVoiceResetState)

  const stateRef = useRef(state)
  const hasStartedRef = useRef(hasStarted)
  const persistTimerRef = useRef<number | null>(null)
  const audioRef = useRef<GameAudio | null>(null)
  if (!audioRef.current) audioRef.current = new GameAudio()
  const pendingTimersRef = useRef<number[]>([])
  const voiceClientRef = useRef<RealtimeVoiceClient | null>(null)
  const voiceResetRef = useRef(voiceResetState)
  const voiceSubtitleIdRef = useRef(0)
  const observedNewsIdRef = useRef(state.news[0]?.id ?? 0)
  const actionDockRef = useRef<HTMLElement | null>(null)
  const lastBriefSoundIdRef = useRef<number | null>(null)
  const lastDecisionSoundRef = useRef<string | null>(null)

  const m = useMemo(() => metrics(state), [state])
  const trustCausality = useMemo(() => trustBreakdown(state), [state])
  const score = useMemo(() => scoreState(state), [state])
  const ending = useMemo(() => evaluateEnding(state), [state])
  const selectedRegion = selectedRegionId ? state.regions.find((region) => region.id === selectedRegionId) ?? null : null
  const trustFactors = useMemo(() => trustCausality.factors
    .filter((factor) => Math.abs(factor.value) >= .5)
    .sort((left, right) => {
      if (left.value < 0 && right.value >= 0) return -1
      if (left.value >= 0 && right.value < 0) return 1
      return Math.abs(right.value) - Math.abs(left.value)
    })
    .slice(0, 4), [trustCausality.factors])
  const riskRadar = useMemo(() => {
    const risks = [
      { label: '安全事故', ratio: m.safetyGap / constants.gapThreshold, detail: `差 ${m.safetyGap.toFixed(1)} / ${constants.gapThreshold}` },
      { label: '制御喪失', ratio: state.safetyGapDays / 90, detail: `危険日 ${state.safetyGapDays} / 90` },
      { label: '規制凍結', ratio: Math.max(m.governanceGap / constants.gapThreshold, m.hhi / .6), detail: `差 ${m.governanceGap.toFixed(1)} · HHI ${m.hhi.toFixed(2)}` },
    ]
    const primary = [...risks].sort((left, right) => right.ratio - left.ratio)[0]
    return { risks, primary, pressure: Math.round(Math.min(1, primary.ratio) * 100) }
  }, [m.governanceGap, m.hhi, m.safetyGap, state.safetyGapDays])
  const date = dateLabel(state.day)
  const decisionKind = state.day >= DECISION_2035_DAY && !state.choice2035
    ? '2035'
    : state.day >= DECISION_2029_DAY && !state.choice2029
      ? '2029'
      : null
  const simulationBlocked = showStartScreen || restartConfirmOpen || tutorialStep !== null || paused || Boolean(criticalNews) || Boolean(state.pendingWorldEvent) || upgradeOpen || Boolean(decisionKind) || state.terminal

  const worldEventPopup = useMemo<WorldEventPopupNotice | null>(() => {
    const notice = state.pendingWorldEvent
    if (!notice) return null
    const signed = (value: number, suffix = '') => `${value > 0 ? '+' : ''}${value}${suffix}`
    const effects = [
      notice.effect.usersDeltaPct !== 0 ? { label: 'AI利用者', amount: signed(notice.effect.usersDeltaPct, '%'), tone: notice.effect.usersDeltaPct > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.shareDelta !== 0 ? { label: notice.effect.target && notice.effect.target !== 'codex' ? '競合シェア' : 'CODEXシェア', amount: signed(Math.round(notice.effect.shareDelta * 100), '点'), tone: notice.effect.target && notice.effect.target !== 'codex' ? 'negative' as const : notice.effect.shareDelta > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.growthRateDelta !== 0 ? { label: '普及率', amount: signed(Math.round(notice.effect.growthRateDelta * 100), '%'), tone: notice.effect.growthRateDelta > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.trustDelta !== 0 ? { label: '信頼目標', amount: signed(notice.effect.trustDelta), tone: notice.effect.trustDelta > 0 ? 'positive' as const : 'negative' as const } : null,
    ].filter((effect): effect is NonNullable<typeof effect> => Boolean(effect))
    return {
      id: notice.eventId,
      source: notice.source,
      category: notice.category,
      date: notice.date,
      dateTime: notice.date,
      headline: notice.headline,
      cause: notice.cause,
      flavor: notice.flavor,
      duration: `シミュレーション ${notice.ttlDays}日`,
      effects: effects.length > 0 ? effects : [{ label: '時間軸', amount: '状況変化', tone: 'neutral' }],
      combo: notice.comboLabel ? { priorFeature: notice.comboFeature ?? notice.comboLabel, outcome: `${notice.comboLabel}${notice.momentumDays > 0 ? ` · 勢い +${notice.momentumDays}日` : ''}` } : undefined,
    }
  }, [state.pendingWorldEvent])

  const playSound = (sound: GameSound) => audioRef.current?.play(sound)

  useEffect(() => {
    stateRef.current = state
    hasStartedRef.current = hasStarted
    if (persistTimerRef.current !== null) return
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, encodeSession(stateRef.current, hasStartedRef.current))
      } catch {
        // Gameplay remains available when storage is disabled or full.
      }
    }, 500)
  }, [hasStarted, state])
  useEffect(() => { voiceResetRef.current = voiceResetState }, [voiceResetState])

  useEffect(() => {
    audioRef.current?.preload()
    audioRef.current?.setEnabled(soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    const persistNow = () => {
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, encodeSession(stateRef.current, hasStartedRef.current))
      } catch {
        // Ignore private-mode and quota failures.
      }
    }
    window.addEventListener('pagehide', persistNow)
    return () => {
      window.removeEventListener('pagehide', persistNow)
      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current)
      persistNow()
    }
  }, [])

  useEffect(() => {
    if (!criticalNews || lastBriefSoundIdRef.current === criticalNews.id) return
    lastBriefSoundIdRef.current = criticalNews.id
    const crisis = /SAFETY|ALIGNMENT|REGULATORY|MISALIGNMENT|CRITICAL|EMERGENCY/i.test(criticalNews.headline)
    playSound(crisis ? 'alert' : 'brief')
  }, [criticalNews])

  useEffect(() => {
    if (!decisionKind || lastDecisionSoundRef.current === decisionKind) return
    lastDecisionSoundRef.current = decisionKind
    playSound('alert')
  }, [decisionKind])

  useEffect(() => {
    if (decisionKind || criticalNews || state.pendingWorldEvent || tutorialStep !== null || state.terminal) return
    const newestId = state.news.reduce((maximum, item) => Math.max(maximum, item.id), observedNewsIdRef.current)
    const unseen = state.news.filter((item) => item.id > observedNewsIdRef.current)
    observedNewsIdRef.current = newestId
    const critical = unseen.find((item) => /BUILD WEEK|AGENTS REACH/i.test(item.headline) || (
      item.tone === 'warn' && /SAFETY INCIDENT|REGULATORY FREEZE|MISALIGNMENT|CRITICAL|EMERGENCY|DECISION/i.test(item.headline)
    ))
    if (critical) setCriticalNews(critical)
  }, [criticalNews, decisionKind, state.news, state.pendingWorldEvent, state.terminal, tutorialStep])

  useEffect(() => () => {
    pendingTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    voiceClientRef.current?.end()
    window.speechSynthesis?.cancel()
  }, [])

  useEffect(() => {
    if (simulationBlocked) return
    const timer = window.setInterval(() => {
      setState((current) => runFrame(current))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [simulationBlocked])

  useEffect(() => {
    if (simulationBlocked) return
    let prior = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.max(0, (now - prior) / 1000)
      prior = now
      setState((current) => advanceRealtime(current, elapsed))
    }, 200)
    return () => window.clearInterval(timer)
  }, [simulationBlocked])

  const shipFeature = (raw: string) => {
    const filtered = filterPlayerInput(raw)
    if (!filtered.ok) {
      setFeatureStatus(filtered.reason === 'too-long' ? '提案は60文字以内にしてください。' : '安全フィルターが提案を拒否しました。')
      return
    }
    const input = filtered.value
    const before = stateRef.current
    const next = addFeature(before, input)
    if (next === before || next.features.length === before.features.length) {
      setFeatureStatus(before.compute < 90 ? '公開には計算資源90が必要です。' : '効果は発生しませんでした。')
      return
    }
    setState(next)
    stateRef.current = next
    setFeatureText('')
    const education = /learn|school|student|teacher|classroom|education|教育|学習|学校|教室/i.test(input)
    setFeatureStatus(education
      ? '効果反映 · 教育アクセスと地域適合度が上昇。'
      : '効果反映 · 地域適合度を更新。アドバイザーに相談できます。')
    playSound('confirm')
  }

  const submitFeature = (event: FormEvent) => {
    event.preventDefault()
    shipFeature(featureText)
  }

  const deployRegion = () => {
    if (!selectedRegionId || !selectedRegion) return
    const current = stateRef.current
    const next = introduceRegion(current, selectedRegionId)
    if (next === current) {
      setFeatureStatus(current.compute < 45 ? '地域展開には計算資源45が必要です。' : 'この地域は展開済みです。')
      return
    }
    setState(next)
    stateRef.current = next
    playSound('confirm')
    setFeatureStatus(`効果反映 · ${REGION_LABELS[selectedRegion.id]}のコミュニティ網を拡大。`)
  }

  const finishTutorial = () => {
    setShowStartScreen(false)
    setTutorialStep(null)
    setHasStarted(true)
    playSound('confirm')
    setActionNudge(true)
    const timer = window.setTimeout(() => setActionNudge(false), 4000)
    pendingTimersRef.current.push(timer)
    window.requestAnimationFrame(() => actionDockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
  }

  const beginWithTutorial = () => {
    setShowStartScreen(false)
    setTutorialStep(0)
    playSound('tap')
  }

  const beginWithoutTutorial = () => {
    setShowStartScreen(false)
    setTutorialStep(null)
    setHasStarted(true)
    playSound('confirm')
  }

  const resetGameToStart = () => {
    const next = initialGame()
    try { window.localStorage.removeItem(SESSION_STORAGE_KEY) } catch { /* Storage may be disabled. */ }
    setState(next)
    stateRef.current = next
    observedNewsIdRef.current = next.news[0]?.id ?? 0
    setEndingVisible(true)
    setDecisionSelection(null)
    setCriticalNews(null)
    setPaused(false)
    setTutorialStep(null)
    setShowStartScreen(true)
    setRestartConfirmOpen(false)
    setHasStarted(false)
    setActionNudge(false)
    setSelectedCompetitor(null)
    playSound('confirm')
  }

  const activateReset = () => {
    if (stateRef.current.resetCooldownSeconds > 0) return
    setState((current) => triggerReset(current))
    setResetPulse((value) => value + 1)
    playSound('confirm')
  }

  const appendVoiceSubtitle = (speaker: VoiceSubtitle['speaker'], text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    voiceSubtitleIdRef.current += 1
    setVoiceSubtitles((current) => [...current.slice(-11), { id: `voice-${Date.now()}-${voiceSubtitleIdRef.current}`, speaker, text: trimmed }])
  }

  const commitVoiceResetState = (next: VoiceResetState) => {
    voiceResetRef.current = next
    setVoiceResetState(next)
  }

  const speakFallback = (text: string) => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  }

  const activateVoiceFallback = (reason: 'microphone-denied' | 'realtime-unavailable') => {
    voiceClientRef.current?.end()
    voiceClientRef.current = null
    setVoiceStatus('fallback')
    setVoiceMuted(false)
    setOperatorDraft('')
    appendVoiceSubtitle('system', reason === 'microphone-denied'
      ? 'マイクが許可されませんでした。台本モードに切り替えます。'
      : 'リアルタイム接続を利用できません。台本モードに切り替えます。')
    const line = 'こちらはKiboデモオペレーターです。音声回線の代わりに台本モードで、ゲーム内Tiboリセットを案内します。'
    appendVoiceSubtitle('operator', line)
    speakFallback(line)
  }

  const runConfirmedGameReset = () => {
    if (stateRef.current.resetCooldownSeconds > 0) return false
    const next = triggerReset(stateRef.current)
    stateRef.current = next
    setState(next)
    setResetPulse((value) => value + 1)
    playSound('confirm')
    appendVoiceSubtitle('system', '確認済み: ゲーム内Tiboリセットを1回実行しました。')
    return true
  }

  const startVoiceCall = () => {
    voiceClientRef.current?.end()
    setVoiceOpen(true)
    setVoiceStatus('connecting')
    setMicPermission('requesting')
    setVoiceMuted(false)
    setVoiceSubtitles([])
    setOperatorDraft('')
    const client = new RealtimeVoiceClient({
      onStatus: setVoiceStatus,
      onMicPermission: setMicPermission,
      onTranscript: (speaker, text, final) => {
        if (speaker === 'operator' && !final) {
          setOperatorDraft((current) => current + text)
          return
        }
        if (speaker === 'operator') setOperatorDraft('')
        appendVoiceSubtitle(speaker, text)
      },
      onToolCall: (call) => {
        const before = voiceResetRef.current
        const result = handleRealtimeResetToolCall(before, call, stateRef.current.resetCooldownSeconds)
        commitVoiceResetState(result.state)
        if (result.outcome === 'confirmation-required' && result.request) {
          appendVoiceSubtitle('system', '要求を確認しました。「やって！」など、別の音声確認を待っています。')
          return {
            status: 'confirmation_required',
            approval_id: result.request.id,
            scope: 'codex-2040-game-only',
            next_step: 'Ask the player aloud in Japanese whether to execute. Accept a new short direct approval such as やって, お願い, はい, Do it, or Go ahead; reject negative or unclear replies.',
          }
        }
        if (result.outcome === 'executed' && result.shouldExecute) {
          runConfirmedGameReset()
          return {
            status: 'executed',
            scope: 'codex-2040-game-only',
            message: 'The in-game Tibo reset ran exactly once and the global map pulse activated. Briefly tell the player in Japanese.',
          }
        }
        if (result.outcome === 'cooldown') {
          return {
            status: 'cooldown',
            retry_after_seconds: Math.ceil(stateRef.current.resetCooldownSeconds),
            scope: 'codex-2040-game-only',
            message: 'No reset ran. Briefly explain the game cooldown in Japanese.',
          }
        }
        return { status: 'rejected', reason: result.outcome, scope: 'codex-2040-game-only', message: 'No game action ran.' }
      },
      onFailure: activateVoiceFallback,
    })
    voiceClientRef.current = client
    void client.start()
  }

  const endVoiceCall = () => {
    voiceClientRef.current?.end()
    voiceClientRef.current = null
    window.speechSynthesis?.cancel()
    setVoiceStatus('ended')
    setVoiceMuted(false)
    setOperatorDraft('')
  }

  const closeVoiceCall = () => {
    endVoiceCall()
    setVoiceOpen(false)
  }

  const toggleVoiceMute = () => {
    const next = !voiceMuted
    voiceClientRef.current?.setMuted(next)
    setVoiceMuted(next)
  }

  const runScriptedVoiceRequest = () => {
    const before = voiceResetRef.current
    const next = requestFallbackReset(before, String(Date.now()))
    commitVoiceResetState(next)
    if (!next.pending || next.pending === before.pending) return
    appendVoiceSubtitle('player', 'ゲーム内Tiboトークンのリミットをリセットして')
    const line = 'trigger_token_resetを要求しました。ゲーム内操作を実行するには、画面で確認してください。'
    appendVoiceSubtitle('operator', line)
    speakFallback(line)
  }

  const resolveVoiceApproval = (approved: boolean) => {
    const result = resolveVoiceReset(voiceResetRef.current, approved, stateRef.current.resetCooldownSeconds)
    commitVoiceResetState(result.state)
    if (result.outcome === 'cooldown') {
      appendVoiceSubtitle('system', `リセットはあと${Math.ceil(stateRef.current.resetCooldownSeconds)}秒待つ必要があります。`)
      return
    }
    if (result.request?.source === 'realtime') {
      voiceClientRef.current?.requestResponse(result.outcome === 'rejected'
        ? 'The player rejected the visible fallback approval. Briefly acknowledge that no game action ran.'
        : 'The player used the visible fallback approval. Briefly acknowledge the game-only outcome.')
    }
    if (!result.shouldExecute) {
      if (result.outcome === 'rejected') appendVoiceSubtitle('system', 'プレイヤーがtrigger_token_resetを拒否しました。操作は実行されていません。')
      return
    }
    runConfirmedGameReset()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if (event.key === 'Escape' && tutorialStep !== null) {
        event.preventDefault()
        finishTutorial()
        return
      }
      if (event.key === 'Escape' && criticalNews) {
        event.preventDefault()
        setCriticalNews(null)
        return
      }
      if (event.altKey && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        if (!voiceOpen) setVoiceOpen(true)
        if (voiceStatus === 'idle' || voiceStatus === 'ended') startVoiceCall()
      }
      if (event.altKey && event.key.toLowerCase() === 'm' && voiceStatus === 'connected') {
        event.preventDefault()
        toggleVoiceMute()
      }
      if (event.altKey && event.key === 'Enter' && voiceResetRef.current.pending && stateRef.current.resetCooldownSeconds <= 0) {
        event.preventDefault()
        resolveVoiceApproval(true)
      }
      if (event.key === 'Escape' && voiceOpen) {
        event.preventDefault()
        endVoiceCall()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const setSpeed = (speed: Speed) => {
    setState((current) => ({ ...current, speed }))
    setPaused(false)
    playSound('time')
  }

  const openStrategy = (tab: UpgradeOverlayTab) => {
    setUpgradeTab(tab)
    setUpgradeOpen(true)
    playSound('tap')
  }

  const performUpgradeAction = (action: UpgradeOverlayAction) => {
    const upgradeMap: Partial<Record<UpgradeOverlayAction, Upgrade>> = {
      model: 'model',
      safety: 'safety',
      governance: 'governance',
      datacenter: 'datacenter',
    }
    const upgrade = upgradeMap[action]
    if (upgrade) setState((current) => {
      const next = buyUpgrade(current, upgrade)
      if (next !== current) playSound('confirm')
      return next
    })
    if (action === 'ecosystem') setState((current) => {
      const next = openEcosystem(current)
      if (next !== current) playSound('confirm')
      return next
    })
    if (action === 'feature-mobile') shipFeature('Mobile support for Android and iOS')
    if (action === 'feature-enterprise') shipFeature('Enterprise SSO for public institutions')
    if (action === 'feature-research') shipFeature('Deep research with cited web and file sources')
    if (action === 'feature-connectors') shipFeature('Secure apps and connectors for workplace data')
    if (action === 'feature-analysis') shipFeature('Advanced data analysis with code execution')
    if (action === 'feature-education') {
      shipFeature(EDUCATION_PROMPT)
      setUpgradeOpen(false)
    }
  }

  const confirmDecision = (optionId: string) => {
    if (decisionKind === '2029') {
      const choiceMap: Record<string, Choice2029> = {
        'race-ahead': 'race',
        'temporary-slowdown': 'slowdown',
        'verified-slowdown': 'verified-slowdown',
      }
      const choice = choiceMap[optionId]
      if (!choice) return
      const next = choose2029(stateRef.current, choice)
      stateRef.current = next
      setState(next)
    } else if (decisionKind === '2035') {
      const choiceMap: Record<string, Choice2035> = { 'hold-the-line': 'hold-the-line', 'accelerate-again': 'accelerate' }
      const choice = choiceMap[optionId]
      if (!choice) return
      const next = choose2035(stateRef.current, choice)
      stateRef.current = next
      setState(next)
    }
    setDecisionSelection(null)
    playSound('confirm')
  }

  const mapRegions = useMemo(() => Object.fromEntries(state.regions.map((region) => [
    region.id,
    {
      adoption: region.population > 0 ? region.users / region.population : 0,
      codexShare: region.codexShare,
      active: region.introduced,
      label: REGION_LABELS[region.id],
    } satisfies WorldMapRegionIntensity,
  ])) as Record<RegionId, WorldMapRegionIntensity>, [state.regions])

  const competitiveMapView = useMemo<WorldMapCompetitiveView | null>(() => {
    if (selectedCompetitor === null) return null
    const shares = Object.fromEntries(state.regions.map((region) => {
      const weights = state.rivalShares.map((share, index) => share * RIVAL_REGION_FIT[region.id][index])
      const rivalWeight = weights.reduce((sum, weight) => sum + weight, 0)
      const nonCodexShare = Math.max(0, 1 - region.codexShare)
      const estimatedShare = rivalWeight > 0 ? nonCodexShare * weights[selectedCompetitor] / rivalWeight : 0
      return [region.id, estimatedShare]
    })) as Record<RegionId, number>
    return {
      label: RIVAL_NAMES[selectedCompetitor],
      color: RIVAL_COLORS[selectedCompetitor],
      shares,
    }
  }, [selectedCompetitor, state.regions, state.rivalShares])

  const mapMarkers = useMemo<WorldMapMarker[]>(() => [
    { id: 'tokyo', regionId: 'eastAsia', label: 'Build Week 東京', kind: 'community', sourceLabel: 'Your Timeline' },
    { id: 'race', regionId: 'na', label: '開発競争', kind: 'source', sourceLabel: 'AI 2027', active: date >= '2027-01-01' },
    { id: 'verification', regionId: 'eu', label: '国際検証会議', kind: 'policy', sourceLabel: 'AI 2040', active: date >= '2029-01-01' },
    ...(state.flags.includes('feature:education') ? [{ id: 'education', regionId: 'india' as const, label: '学校アクセス', kind: 'community' as const, sourceLabel: 'Your Timeline' as const }] : []),
  ], [date, state.flags])

  const enabledFeatures = useMemo<UpgradeOverlayFeature[]>(() => [
    ...(state.flags.includes('feature:mobile') ? ['mobile' as const] : []),
    ...(state.flags.includes('feature:enterprise') ? ['enterprise' as const] : []),
    ...(state.flags.includes('feature:education') ? ['education' as const] : []),
    ...(state.features.some((feature) => /deep research/i.test(feature)) ? ['research' as const] : []),
    ...(state.features.some((feature) => /apps and connectors/i.test(feature)) ? ['connectors' as const] : []),
    ...(state.features.some((feature) => /data analysis/i.test(feature)) ? ['analysis' as const] : []),
  ], [state.features, state.flags])

  const upgradeCosts = useMemo<UpgradeOverlayCosts>(() => ({
    model: 70 * 2 ** Math.max(0, state.capability - 2),
    safety: 105 + 45 * state.safety,
    governance: 105 + 45 * state.governance,
    datacenter: 150 * state.efficiency,
    'feature-mobile': 90,
    'feature-enterprise': 90,
    'feature-education': 90,
    'feature-research': 90,
    'feature-connectors': 90,
    'feature-analysis': 90,
    ecosystem: 0,
  }), [state.capability, state.efficiency, state.governance, state.safety])

  const disabledUpgradeActions = useMemo<UpgradeOverlayAction[]>(() => [
    ...(state.capability >= 10 ? ['model' as const] : []),
    ...(state.safety >= 10 ? ['safety' as const] : []),
    ...(state.governance >= 10 ? ['governance' as const] : []),
    ...(state.efficiency >= 3 ? ['datacenter' as const] : []),
    ...(state.ecosystemCooldownSeconds > 0 ? ['ecosystem' as const] : []),
  ], [state.capability, state.ecosystemCooldownSeconds, state.efficiency, state.governance, state.safety])

  const decisionOptions2029 = scenario2029.decision!.options.map((option) => ({
    id: option.id,
    title: option.id === 'verified-slowdown' ? '国際検証つき減速' : option.id === 'race-ahead' ? '開発競争を続行' : '一時減速',
    summary: option.id === 'verified-slowdown'
      ? '短期の速度を抑え、共同監視、透明な基準、複数ラボの追随余地を作る。'
      : option.id === 'race-ahead'
        ? '優位を守るため拡大を続け、安全と統治の差を受け入れる。'
        : '国際検証なしで急拡大を止め、社内の安全を補強する。',
    consequence: option.id === 'verified-slowdown'
      ? '信頼、安全、統治、健全な競争が改善。短期成長は鈍化。'
      : option.id === 'race-ahead'
        ? '能力と成長が急伸し、制御の差も拡大。'
        : '社内対策は改善するが、競合は停止を検証できない。',
  })) as unknown as ScenarioDecisionOptions

  const decisionOptions2035 = scenario2035.decision!.options.map((option) => ({
    id: option.id,
    title: option.id === 'hold-the-line' ? '上限を守る' : '再加速',
    summary: option.id === 'hold-the-line'
      ? '評価、国際検証、公共制度が整うまで能力上限を維持する。'
      : '大規模な安全性の実証前に、競争圧力へ能力強化で応じる。',
    consequence: option.id === 'hold-the-line'
      ? '制御された停止で人間の主体性とPlan Aを守る。'
      : '安全性の実証前に成長を再開し、競争路線へ戻る。',
  })) as unknown as ScenarioDecisionOptions

  const divergences = useMemo<DecisionDivergences>(() => [
    {
      year: '2026',
      decision: '公共アクセス',
      referenceScenario: 'コーディングエージェントが企業と研究に普及。',
      yourTimeline: state.flags.includes('feature:education') ? '教育モードで学校を主要なアクセス経路にした。' : '製品アクセスは商業主導のまま。',
      whyItMattered: '誰が使えるかで、便益と統治責任が変わる。',
    },
    {
      year: '2029',
      decision: '競争か減速か',
      referenceScenario: 'Plan Aは透明で国際検証可能な減速を採用。',
      yourTimeline: state.choice2029 === null
        ? '到達前に終了。'
        : state.choice2029 === 'verified-slowdown'
          ? '検証可能な協調を選択。'
          : state.choice2029 === 'slowdown'
            ? '共同検証なしで社内停止。'
            : '能力競争を続行。',
      whyItMattered: '停止は、競合も検証し信頼できて初めて安全を生む。',
    },
    {
      year: '2035',
      decision: '上限を守る',
      referenceScenario: '安全性の実証が整うまで、最高水準の人間相当で停止。',
      yourTimeline: state.choice2035 === null
        ? '到達前に終了。'
        : state.choice2035 === 'hold-the-line'
          ? '意図した能力上限を維持。'
          : '競争圧力の中で再加速。',
      whyItMattered: '人間の制御を短期的優位より優先できるかを問う選択。',
    },
  ], [state.choice2029, state.choice2035, state.flags])

  const resetProgress = state.resetCooldownSeconds > 0
    ? 1 - state.resetCooldownSeconds / constants.resetCooldownSeconds
    : 1
  const timelineProgress = clamp(state.day / END_DAY * 100)
  const latestNews = state.news[0]
  const latestNewsDetail = latestNews?.source === 'Live GM'
    ? 'ブラウザ内GMブリッジで検証済みイベントを受信。'
    : 'シミュレーションエンジンが管理する決定論的イベント。'
  const tutorial = tutorialStep === null ? null : TUTORIAL_STEPS[tutorialStep]
  const isCrisisBrief = Boolean(criticalNews && /SAFETY|ALIGNMENT|REGULATORY|MISALIGNMENT|CRITICAL|EMERGENCY/i.test(criticalNews.headline))
  const simulationStatus = showStartScreen
    ? '待機中 · ミッション開始待ち'
    : tutorial
      ? '停止中 · チュートリアル'
    : decisionKind
      ? '停止中 · 決定が必要'
      : state.pendingWorldEvent
        ? `停止中 · ${WORLD_EVENT_CATEGORY_LABELS[state.pendingWorldEvent.category]}イベント`
      : criticalNews
      ? `停止中 · ${isCrisisBrief ? '重大イベント' : '世界情勢'}`
      : upgradeOpen
        ? '停止中 · 戦略確認'
        : paused
          ? '停止中 · プレイヤー操作'
          : `進行中 · ${state.speed === 8 ? '高速' : '通常'} · ${state.momentumDays > 0 ? `勢い ${state.momentumDays}日` : '勢い停止'}`
  const criticalCause = criticalNews
    ? /SAFETY|ALIGNMENT/i.test(criticalNews.headline)
      ? `能力が安全を上回っています。現在の差: ${m.safetyGap.toFixed(1)}。`
      : /REGULATORY/i.test(criticalNews.headline)
        ? `統治不足または市場集中が規制対応を招きました。HHI: ${m.hhi.toFixed(2)}。`
        : /BUILD WEEK/i.test(criticalNews.headline)
          ? 'コミュニティの節目が注目を集め、新たな行動機会を生みました。'
          : /AGENTS REACH/i.test(criticalNews.headline)
            ? 'AI 2027の競争圧力が加速。制御能力をモデル能力に追いつかせる必要があります。'
            : criticalNews.source === 'Live GM'
          ? '検証済みのGMイベントが競争環境を変えました。'
          : '参照シナリオの節目が世界の状態を変えました。'
    : ''

  return (
    <main className={`command-shell${state.resetBoostSeconds > 0 ? ' is-boosting' : ''}`}>
      <div className="command-shell__grain" aria-hidden="true" />

      <header className="command-header">
        <div className="command-brand">
          <span className="command-brand__mark"><Bot size={20} /></span>
          <span><b>CODEX <i>//</i> 2040</b><small>AIガバナンス・シミュレーター</small></span>
        </div>
        <div className="command-header__center">
          <button className="tutorial-launcher" onClick={beginWithTutorial} aria-expanded={tutorialStep !== null}>遊び方</button>
          <button className="new-game-launcher" type="button" disabled={showStartScreen} onClick={() => { setRestartConfirmOpen(true); playSound('tap') }}><RotateCcw size={11} /> 新しいゲーム</button>
        </div>
        <div className="simulation-clock">
          <div className="simulation-clock__actions">
            <button className="voice-call-launcher" onClick={() => { setVoiceOpen(true); playSound('tap') }} aria-expanded={voiceOpen}><Phone size={13} /> ボイス・オペレーター</button>
            <button
              className="sound-toggle"
              type="button"
              aria-label={soundEnabled ? '効果音をミュート' : '効果音をオン'}
              aria-pressed={!soundEnabled}
              title={soundEnabled ? '効果音をミュート' : '効果音をオン'}
              onClick={() => {
                const enabled = !soundEnabled
                setSoundEnabled(enabled)
                audioRef.current?.setEnabled(enabled)
                if (enabled) audioRef.current?.play('tap')
              }}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />} {soundEnabled ? '効果音 オン' : '効果音 オフ'}
            </button>
          </div>
          <span><i /> 決定論エンジン</span>
          <strong>{date}</strong>
        </div>
      </header>

      <section className="intel-strip" aria-label="最新シナリオ情報">
        <div className="intel-strip__label"><Radio size={13} /> シナリオ情報</div>
        {latestNews && <div className="intel-strip__headline"><SourceBadge source={latestNews.source} /><OverflowTicker className="intel-strip__ticker" text={`${latestNews.headline} · ${latestNewsDetail}`} /></div>}
        <div className="source-key" aria-label="情報源">
          {(['AI 2027', 'AI 2040', 'Your Timeline'] as SourceLabel[]).map((source) => <SourceBadge source={source} key={source} />)}
        </div>
      </section>

      <section className="command-grid">
        <aside className="telemetry-rail">
          <div className="section-label"><Activity size={13} /> 世界テレメトリ</div>
          <div className="primary-counter">
            <span>CODEX利用者</span>
            <strong>{fmt(m.codexUsers * 1_000_000)}</strong>
            <small>AI利用者の {pct(m.codexShare)}</small>
          </div>
          <div className="telemetry-pair">
            <span><small>世界アクセス</small><b>{pct(m.worldAdoption)}</b></span>
            <span><small>ミッション得点</small><b>{score.rank} · {Math.round(score.score * 100)}</b></span>
          </div>
          <div className="mission-breakdown" aria-label="ミッション得点の内訳">
            <span><small>アクセス</small><b>{Math.round(score.access * 100)}</b></span>
            <span><small>地域</small><b>{Math.round(score.coverage * 100)}</b></span>
            <span><small>競争</small><b>{Math.round(score.competition * 100)}</b></span>
            <span><small>安全</small><b>{Math.round(score.safety * 100)}</b></span>
          </div>
          <Meter label="社会的信頼" value={state.trust} danger={state.trust < 45} />
          <div className="trust-causality" aria-label="社会的信頼の要因">
            <div><span>信頼目標</span><b>{trustCausality.target.toFixed(0)}</b><strong className={trustCausality.dailyDelta < 0 ? 'is-negative' : 'is-positive'}>{trustCausality.dailyDelta >= 0 ? '+' : ''}{trustCausality.dailyDelta.toFixed(2)}/日</strong></div>
            {trustFactors.map((factor) => <p key={factor.id} className={factor.value < 0 ? 'is-negative' : 'is-positive'}><span>{TRUST_FACTOR_LABELS[factor.id]}</span><b>{factor.value >= 0 ? '+' : ''}{factor.value.toFixed(0)}</b></p>)}
          </div>
          <div className="risk-radar" data-danger={riskRadar.pressure >= 80}>
            <div><span>制御圧力</span><b>{riskRadar.pressure}%</b></div>
            {riskRadar.risks.map((risk) => <p key={risk.label}><span>{risk.label}</span><b>{risk.detail}</b></p>)}
          </div>
          <Meter label="市場の健全性" value={(1 - m.hhi) * 100} hint={`HHI ${m.hhi.toFixed(2)} · 低いほど健全`} danger={m.hhi > .6} />

          <div className="section-label section-label--sub"><Network size={13} /> 競争環境</div>
          <div className="market-list">
            <div className="is-codex"><i /><b>CODEX<small>K{state.capability.toFixed(1)} · P{Math.min(10, 2 + state.features.length * 1.5).toFixed(1)} · C{((state.safety + state.governance) / 2).toFixed(1)}</small></b><strong>{pct(m.codexShare)}</strong></div>
            {RIVAL_NAMES.map((name, index) => (
              <button key={name} type="button" className={selectedCompetitor === index ? 'is-selected' : ''} aria-expanded={selectedCompetitor === index} onClick={() => { setSelectedCompetitor((selected) => selected === index ? null : index); playSound('tap') }}>
                <i /><b>{name}<small>K{state.rivalCapability[index].toFixed(1)} · P{state.rivalProduct[index].toFixed(1)} · C{state.rivalCompany[index].toFixed(1)}</small></b><strong>{pct(state.rivalShares[index])}</strong><ChevronRight size={11} />
              </button>
            ))}
          </div>
          {selectedCompetitor !== null && (() => {
            const name = RIVAL_NAMES[selectedCompetitor]
            const axes = [
              { label: 'MODEL', displayLabel: 'モデル', value: state.rivalCapability[selectedCompetitor] },
              { label: 'PRODUCT', displayLabel: '製品', value: state.rivalProduct[selectedCompetitor] },
              { label: 'COMPANY', displayLabel: '組織', value: state.rivalCompany[selectedCompetitor] },
            ]
            const strongest = [...axes].sort((left, right) => right.value - left.value)[0]
            const shareDelta = state.rivalShares[selectedCompetitor] - m.codexShare
            return (
              <section className="competitor-dossier" aria-label={`${name}の競合情報`}>
                <header><span>競合情報 · 地図表示中</span><button type="button" onClick={() => { setSelectedCompetitor(null); playSound('tap') }} aria-label="競合情報を閉じる">×</button></header>
                <div><b>{name}</b><strong className={shareDelta > 0 ? 'is-leading' : ''}>{shareDelta > 0 ? '+' : ''}{Math.round(shareDelta * 100)}点 対CODEX</strong></div>
                <dl>
                  <div><dt>シェア</dt><dd>{pct(state.rivalShares[selectedCompetitor])}</dd></div>
                  {axes.map((axis) => <div key={axis.label}><dt>{axis.displayLabel}</dt><dd>{axis.value.toFixed(1)}</dd></div>)}
                </dl>
                <p><b>{strongest.displayLabel}が強み</b>{strongest.value >= 8 ? 'フロンティア級の圧力が発生中。' : strongest.value >= 5 ? '急成長中。次段階までに対応を。' : '先行投資で勢いを築いています。'}</p>
              </section>
            )
          })()}

          <div className="gm-watchdog" data-mode="advisor">
            <div><Radio size={13} /><span><b>助言モード</b><small>相談専用</small></span></div>
            <strong>100</strong>
            <p>次の一手やトレードオフをアドバイザーに相談できます。実行するのはあなたです。</p>
          </div>
        </aside>

        <section className="world-stage">
          <div className="world-stage__header">
            <span><small>作戦マップ</small><b>{competitiveMapView ? `${competitiveMapView.label} 地域分析` : '世界AIアクセス網'}</b></span>
            <span className="world-stage__status"><i /> {simulationStatus}</span>
          </div>
          <div className="world-stage__map">
            <WorldMap
              regions={mapRegions}
              selectedRegion={selectedRegionId}
              onRegionClick={(regionId) => { setSelectedRegionId(regionId); playSound('tap') }}
              onClearSelection={() => { setSelectedRegionId(null); playSound('tap') }}
              eventMarkers={mapMarkers}
              competitiveView={competitiveMapView}
              resetPulse={resetPulse}
            />
            {(showStartScreen || restartConfirmOpen || tutorial || state.pendingWorldEvent || (criticalNews && !decisionKind && !state.terminal)) && <div className="game-modal-shield" aria-hidden="true" />}
            {showStartScreen && (
              <section className="start-brief" role="dialog" aria-modal="true" aria-labelledby="start-brief-title">
                <span className="start-brief__eyebrow">AIガバナンス・シミュレーター</span>
                <h1 id="start-brief-title">未来をつくる。</h1>
                <p>2026年から2040年へ。安全、統治、信頼、健全な競争を守りながら、役立つAIを広げます。</p>
                <div className="start-brief__sources"><SourceBadge source="AI 2027" /><SourceBadge source="AI 2040" /><SourceBadge source="Your Timeline" /></div>
                <footer>
                  <button autoFocus onClick={beginWithTutorial}>説明から始める <ChevronRight size={14} /></button>
                  <button onClick={beginWithoutTutorial}>説明をスキップ</button>
                </footer>
                <small>進行状況はこのブラウザに自動保存</small>
              </section>
            )}
            {restartConfirmOpen && !showStartScreen && (
              <section className="restart-confirm" role="dialog" aria-modal="true" aria-labelledby="restart-confirm-title">
                <span>新しい時間軸</span>
                <h2 id="restart-confirm-title">2026年から始めますか？</h2>
                <p>現在の時間軸と自動保存は上書きされ、元に戻せません。</p>
                <footer>
                  <button autoFocus onClick={() => { setRestartConfirmOpen(false); playSound('tap') }}>続ける</button>
                  <button onClick={resetGameToStart}>消去して開始</button>
                </footer>
              </section>
            )}
            {tutorial && (
              <section className="tutorial-brief" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
                <header><span>{tutorial.eyebrow}</span><span><b>{tutorialStep! + 1} / {TUTORIAL_STEPS.length}</b><button onClick={finishTutorial}>{hasStarted ? '閉じて再開' : '説明をスキップ'}</button></span></header>
                <div className="tutorial-progress" aria-hidden="true">{TUTORIAL_STEPS.map((_, index) => <i key={index} className={index <= tutorialStep! ? 'is-active' : ''} />)}</div>
                <h2 id="tutorial-title">{tutorial.title}</h2>
                <p>{tutorial.body}</p>
                <aside>{hasStarted && tutorialStep === 0 ? 'このガイドを開いている間、時間は止まります。' : tutorial.cue}</aside>
                <footer>
                  <button disabled={tutorialStep === 0} onClick={() => { setTutorialStep((step) => step === null ? 0 : Math.max(0, step - 1)); playSound('tap') }}>戻る</button>
                  <button autoFocus onClick={() => { if (tutorialStep === TUTORIAL_STEPS.length - 1) finishTutorial(); else { setTutorialStep((step) => step === null ? 0 : step + 1); playSound('tap') } }}>{tutorialStep === TUTORIAL_STEPS.length - 1 ? (hasStarted ? '再開する' : '開始する') : '次へ'}</button>
                </footer>
              </section>
            )}
            {worldEventPopup && tutorialStep === null && !decisionKind && !state.terminal && (
              <WorldEventPopup
                notice={worldEventPopup}
                onAcknowledge={() => {
                  const next = acknowledgeWorldEvent(stateRef.current)
                  stateRef.current = next
                  setState(next)
                  playSound('confirm')
                }}
                advisorCopy="守りたいもの、活かしたい機会をCodex 2040アドバイザーに伝えてください。実行可能な行動へ整理し、操作はあなたが行います。"
              />
            )}
            {criticalNews && !decisionKind && tutorialStep === null && !state.terminal && (
              <section className="critical-brief" data-crisis={isCrisisBrief} role="dialog" aria-modal="true" aria-labelledby="critical-brief-title">
                <header><SourceBadge source={criticalNews.source} /><time>{criticalNews.date}</time><span>{isCrisisBrief ? '重大情報' : '世界情勢'} · 時間停止中</span></header>
                <h2 id="critical-brief-title">{criticalNews.headline}</h2>
                <p>{criticalCause}</p>
                <dl>
                  <div><dt>{isCrisisBrief ? '信頼' : '信頼見通し'}</dt><dd>{state.trust.toFixed(0)} → 目標 {trustCausality.target.toFixed(0)}</dd></div>
                  <div><dt>最大リスク</dt><dd>{riskRadar.primary.label} · {riskRadar.pressure}%</dd></div>
                </dl>
                <button autoFocus onClick={() => { setCriticalNews(null); playSound('tap') }}>確認して{state.speed === 8 ? '高速' : '通常'}再開</button>
              </section>
            )}
            {selectedRegion && selectedRegionId && <div className="region-inspector">
              <span>選択中の地域</span>
              <h2>{REGION_LABELS[selectedRegion.id]}</h2>
              <dl>
                <div><dt>AIアクセス</dt><dd>{pct(selectedRegion.users / selectedRegion.population)}</dd></div>
                <div><dt>{competitiveMapView ? `${competitiveMapView.label} 推定シェア` : 'CODEXシェア'}</dt><dd>{pct(competitiveMapView?.shares[selectedRegionId] ?? selectedRegion.codexShare)}</dd></div>
                <div><dt>規制</dt><dd>{pct(selectedRegion.regulation)}</dd></div>
              </dl>
              <button onClick={deployRegion}>{selectedRegion.introduced ? '交流イベントを開く' : '最初の拠点を開く'}<ChevronRight size={14} /></button>
            </div>}
          </div>
          <div className="timeline-track">
            <span>2026</span><div><i style={{ width: `${timelineProgress}%` }} /><b style={{ left: `${timelineProgress}%` }} /></div><span>2040</span>
          </div>
        </section>

        <aside className="strategy-rail">
          <div className="section-label"><Cpu size={13} /> 戦略</div>
          <div className="compute-counter"><span>利用可能な計算資源</span><strong>{fmt(state.compute, 1)} <small>PF</small></strong><small className={state.momentumDays > 0 ? 'is-active' : 'is-stalled'}><OverflowTicker text={state.momentumDays > 0 ? `勢いあり · あと${state.momentumDays}日` : '勢い停止 · 行動して成長を再開'} /></small></div>
          <button className="strategy-axis" onClick={() => openStrategy('model')}>
            <span><BrainCircuit size={16} /><b>モデル</b><small>能力</small></span><strong>K{state.capability.toFixed(1)}</strong><ChevronRight size={14} />
          </button>
          <button className="strategy-axis" onClick={() => openStrategy('product')}>
            <span><Sparkles size={16} /><b>製品</b><small>機能 {enabledFeatures.length}</small></span><strong>アクセス</strong><ChevronRight size={14} />
          </button>
          <button className="strategy-axis" onClick={() => openStrategy('company')}>
            <span><ShieldCheck size={16} /><b>組織</b><small>制御能力</small></span><strong>S{state.safety.toFixed(0)} / G{state.governance.toFixed(0)}</strong><ChevronRight size={14} />
          </button>

          <div className="control-envelope">
            <div className="section-label section-label--sub"><ShieldCheck size={13} /> 制御バランス</div>
            <Meter label="能力" value={state.capability} max={10} />
            <Meter label="安全" value={state.safety} max={10} danger={m.safetyGap >= 3} hint={m.safetyGap > 0 ? `能力差 +${m.safetyGap.toFixed(1)}` : '能力と同等'} />
            <Meter label="統治" value={state.governance} max={10} danger={m.governanceGap >= 3} hint={m.governanceGap > 0 ? `能力差 +${m.governanceGap.toFixed(1)}` : '能力と同等'} />
          </div>

          <button className="open-ecosystem" onClick={() => performUpgradeAction('ecosystem')} disabled={state.ecosystemCooldownSeconds > 0}>
            <Network size={17} /><span><b>エコシステムを開く</b><small>{state.ecosystemCooldownSeconds > 0 ? `あと${Math.ceil(state.ecosystemCooldownSeconds)}秒` : 'シェアを譲り · 信頼を上げる'}</small></span><ArrowUpRight size={14} />
          </button>
          <button className="open-strategy" onClick={() => openStrategy('model')}>戦略ツリーを開く <ChevronRight size={14} /></button>

          <div className="event-ledger">
            <div className="section-label section-label--sub"><Radio size={13} /> イベント履歴</div>
            {state.news.slice(0, 3).map((item) => (
              <article key={item.id}><SourceBadge source={item.source} /><time>{item.date}</time><b><OverflowTicker text={item.headline} /></b></article>
            ))}
          </div>
        </aside>
      </section>

      <section ref={actionDockRef} className={`action-dock${actionNudge ? ' is-onboarding-target' : ''}`}>
        <button
          className="reset-action"
          disabled={state.resetCooldownSeconds > 0}
          onClick={activateReset}
          style={{ '--reset-progress': `${resetProgress * 360}deg` } as CSSProperties}
        >
          <span className="reset-action__ring"><RotateCcw size={20} /></span>
          <span><small>TIBOプロトコル · 世界強化 8秒</small><b>{state.resetCooldownSeconds > 0 ? `トークンリセット · あと${Math.ceil(state.resetCooldownSeconds)}秒` : 'トークンリセット準備完了'}</b></span>
        </button>

        <form className="feature-console" onSubmit={submitFeature}>
          <div className="feature-console__label"><Sparkles size={15} /><span><small>機能を公開</small><b>目的を入力。迷ったらアドバイザーへ相談</b></span></div>
          <div className="feature-console__input">
            <input value={featureText} onChange={(event) => setFeatureText(event.target.value)} maxLength={60} placeholder="60文字以内で機能を説明…" aria-label="機能提案" />
            <button type="submit">公開 <ChevronRight size={13} /></button>
          </div>
          <button className="education-shortcut" type="button" onClick={() => shipFeature(EDUCATION_PROMPT)}><GraduationCap size={13} /> 教育モードを展開</button>
          <p className={featureStatus.startsWith('LIVE GM') ? 'is-live' : ''}>{featureStatus}</p>
        </form>

        <div className="time-controls">
          <button aria-pressed={paused} className="pause-button" onClick={() => { setPaused((value) => !value); playSound('time') }}>{paused ? <CirclePlay size={16} /> : <CirclePause size={16} />}{paused ? '再開' : '停止'}</button>
          <div className="speed-modes">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                aria-label={speed === 1 ? '通常速度 — 1秒で1日' : '高速 — 1秒で8日'}
                aria-pressed={state.speed === speed}
                className={state.speed === speed ? 'is-active' : ''}
                onClick={() => setSpeed(speed)}
              >
                {speed === 1 ? <CirclePlay size={16} /> : <ChevronsRight size={20} />}
                <span>{speed === 1 ? '通常' : '高速'}</span>
              </button>
            ))}
          </div>
          <small className="speed-readout">{state.speed === 8 ? '高速 · 1秒で8日' : '通常 · 1秒で1日'} · {state.momentumDays > 0 ? `勢い あと${state.momentumDays}日` : 'アクセス成長停止'}</small>
        </div>
      </section>

      <VoiceCallPanel
        open={voiceOpen}
        status={voiceStatus}
        micPermission={micPermission}
        muted={voiceMuted}
        subtitles={voiceSubtitles}
        operatorDraft={operatorDraft}
        pendingReset={voiceResetState.pending}
        resetNotice={voiceResetState.notice}
        resetCooldownSeconds={state.resetCooldownSeconds}
        onStart={startVoiceCall}
        onEnd={endVoiceCall}
        onClose={closeVoiceCall}
        onToggleMute={toggleVoiceMute}
        onScriptedRequest={runScriptedVoiceRequest}
        onApproveReset={() => resolveVoiceApproval(true)}
        onRejectReset={() => resolveVoiceApproval(false)}
      />

      <UpgradeOverlay
        isOpen={upgradeOpen}
        compute={state.compute}
        capability={state.capability}
        safety={state.safety}
        governance={state.governance}
        efficiency={state.efficiency}
        trust={state.trust}
        codexShare={m.codexShare}
        hhi={m.hhi}
        costs={upgradeCosts}
        enabledFeatures={enabledFeatures}
        disabledActions={disabledUpgradeActions}
        ecosystemCooldownDays={0}
        initialTab={upgradeTab}
        onAction={performUpgradeAction}
        onCustomFeature={(feature) => shipFeature(feature)}
        onClose={() => { setUpgradeOpen(false); playSound('tap') }}
      />

      <ScenarioDecision
        open={decisionKind === '2029'}
        milestone="choose-path-2029"
        source={{ label: 'AI 2040 / Plan A', href: scenario2029.sourceUrl ?? AI_2040_URL }}
        title="進路を選ぶ"
        context="短い協調機会の中で、競争、一時停止、国際検証つき減速のどれかを選びます。"
        options={decisionOptions2029}
        selectedOptionId={decisionSelection}
        whyThisMatters="得た時間を共有の安全資源にできるか、次の競争までの先延ばしにするかを決めます。"
        onSelect={setDecisionSelection}
        onConfirm={confirmDecision}
      />

      <ScenarioDecision
        open={decisionKind === '2035'}
        milestone="hold-the-line-2035"
        source={{ label: 'AI 2040 / Plan A', href: scenario2035.sourceUrl ?? AI_2040_URL }}
        title="上限を守る"
        context="人間の最高専門家に迫る中、経済・地政学的な拡大圧力が頂点に達します。"
        options={decisionOptions2035}
        selectedOptionId={decisionSelection}
        whyThisMatters="人間の制御を短期的な競争優位より優先できるかを試します。"
        onSelect={setDecisionSelection}
        onConfirm={confirmDecision}
      />

      <EndingOverlay
        open={state.terminal && endingVisible}
        rank={ending.rank}
        ending={ending.id}
        scoreOutOf100={ending.score * 100}
        completionDate={dateLabel(state.day).toUpperCase()}
        completionStatus={state.day < END_DAY ? 'terminated' : 'complete'}
        summary={ENDING_CONTEXT[ending.id]}
        referenceSummary="AI 2027は開発競争の圧力を、AI 2040のPlan Aは検証可能な減速、意図的停止、証拠に基づく再始動を示します。"
        timelineSummary={`シミュレーションは${dateLabel(state.day)}に${state.day < END_DAY ? '終了' : '完了'}。2029年は${state.choice2029 === 'verified-slowdown' ? '国際検証つき減速' : state.choice2029 === 'slowdown' ? '一時減速' : state.choice2029 === 'race' ? '競争続行' : '未到達'}、2035年は${state.choice2035 === 'hold-the-line' ? '上限維持' : state.choice2035 === 'accelerate' ? '再加速' : '未到達'}。最終アクセス ${pct(m.worldAdoption)}、HHI ${m.hhi.toFixed(2)}。`}
        divergences={divergences}
        onClose={() => setEndingVisible(false)}
        onRestart={resetGameToStart}
      />
    </main>
  )
}
