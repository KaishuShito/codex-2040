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
  'beneficial-abundance': 'The verified slowdown and deliberate pause converted restraint into a safe, plural restart.',
  'managed-transition': 'The system remained governable, but the full conditions for Plan A were not secured.',
  'fragile-abundance': 'Access grew faster than the institutional foundations needed to make abundance durable.',
  'race-future': 'Competitive acceleration overruled the coordinated restraint needed for a controlled future.',
  'regulatory-freeze': 'Governance debt turned public protection into a brake on beneficial access.',
  'safety-incident': 'Repeated control gaps converted abstract risk into visible harm and lost trust.',
  misalignment: 'The persistent safety gap crossed the point where human institutions could recover control.',
  'pyrrhic-monopoly': 'Reach was achieved by concentrating power, leaving the ecosystem less resilient and less free.',
}

const decisionMilestones = getDecisionMilestones()
const scenario2029 = decisionMilestones.find((milestone) => milestone.date.startsWith('2029-'))!
const scenario2035 = decisionMilestones.find((milestone) => milestone.date.startsWith('2035-'))!

const fmt = (value: number, maximumFractionDigits = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
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

const TUTORIAL_STEPS = [
  {
    eyebrow: 'MISSION',
    title: 'Grow useful AI without losing human control.',
    body: 'Reach 2040 with broad access, high Trust, strong Safety and Governance, and at least two viable competitors. Market domination is not victory.',
    cue: 'The simulation stays paused until you begin.',
  },
  {
    eyebrow: 'MOMENTUM',
    title: 'Waiting does not create progress.',
    body: 'Ship a feature, open a region, invest Compute, or call the Voice Operator to create a limited growth window. When Momentum expires, access stalls while costs and rivals continue.',
    cue: 'Watch MOMENTUM ACTIVE in the Strategy rail.',
  },
  {
    eyebrow: 'CONTROL PRESSURE',
    title: 'Every burst creates a governance problem.',
    body: 'Capability gaps, concentration, incidents, and policy pressure move Social Trust. Critical events stop time so you can read the cause before continuing.',
    cue: 'Trust causes and every game-over route are visible on the left.',
  },
  {
    eyebrow: 'YOUR FIRST MOVE',
    title: 'Create the future, then survive its reaction.',
    body: 'Start by deploying Education Mode, opening a community, or investing in the strategy tree. Switch between Normal and Fast Forward; major decisions always pause automatically.',
    cue: 'Optional: call Kibo in Voice Operator for a spoken, approval-gated Token Reset.',
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
        aria-valuetext={`${value.toFixed(max <= 10 ? 1 : 0)} of ${max}`}
      ><i style={{ width: `${normalized}%` }} /></div>
      {hint && <small>{hint}</small>}
    </div>
  )
}

function SourceBadge({ source }: { source: SourceLabel }) {
  return <span className="source-badge" data-source={source}>{source}</span>
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
  const [featureStatus, setFeatureStatus] = useState('Local effects apply instantly. Ask the Advisor to review the tradeoff before or after shipping.')
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
      { label: 'SAFETY INCIDENT', ratio: m.safetyGap / constants.gapThreshold, detail: `GAP ${m.safetyGap.toFixed(1)} / ${constants.gapThreshold}` },
      { label: 'ALIGNMENT LOSS', ratio: state.safetyGapDays / 90, detail: `${state.safetyGapDays} / 90 UNSAFE DAYS` },
      { label: 'REGULATORY FREEZE', ratio: Math.max(m.governanceGap / constants.gapThreshold, m.hhi / .6), detail: `GAP ${m.governanceGap.toFixed(1)} · HHI ${m.hhi.toFixed(2)}` },
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
      notice.effect.usersDeltaPct !== 0 ? { label: 'AI USERS', amount: signed(notice.effect.usersDeltaPct, '%'), tone: notice.effect.usersDeltaPct > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.shareDelta !== 0 ? { label: notice.effect.target && notice.effect.target !== 'codex' ? 'RIVAL SHARE' : 'CODEX SHARE', amount: signed(Math.round(notice.effect.shareDelta * 100), ' pts'), tone: notice.effect.target && notice.effect.target !== 'codex' ? 'negative' as const : notice.effect.shareDelta > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.growthRateDelta !== 0 ? { label: 'ADOPTION RATE', amount: signed(Math.round(notice.effect.growthRateDelta * 100), '%'), tone: notice.effect.growthRateDelta > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.trustDelta !== 0 ? { label: 'TRUST TARGET', amount: signed(notice.effect.trustDelta), tone: notice.effect.trustDelta > 0 ? 'positive' as const : 'negative' as const } : null,
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
      duration: `${notice.ttlDays} SIMULATION DAYS`,
      effects: effects.length > 0 ? effects : [{ label: 'TIMELINE', amount: 'CONTEXT SHIFT', tone: 'neutral' }],
      combo: notice.comboLabel ? { priorFeature: notice.comboFeature ?? notice.comboLabel, outcome: `${notice.comboLabel}${notice.momentumDays > 0 ? ` · MOMENTUM +${notice.momentumDays}D` : ''}` } : undefined,
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
      setFeatureStatus(filtered.reason === 'too-long' ? 'Keep feature proposals to 60 characters.' : 'Local safety filter rejected that proposal.')
      return
    }
    const input = filtered.value
    const before = stateRef.current
    const next = addFeature(before, input)
    if (next === before || next.features.length === before.features.length) {
      setFeatureStatus(before.compute < 90 ? '90 compute required to ship this feature.' : 'No local effect was applied.')
      return
    }
    setState(next)
    stateRef.current = next
    setFeatureText('')
    const education = /learn|school|student|teacher|classroom|education|教育|学習|学校|教室/i.test(input)
    setFeatureStatus(education
      ? 'LOCAL EFFECT APPLIED · education access and regional fit increased immediately.'
      : 'LOCAL EFFECT APPLIED · regional fit updated. Ask the Advisor to review the tradeoff.')
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
      setFeatureStatus(current.compute < 45 ? '45 compute required for a community deployment.' : 'Region is already active.')
      return
    }
    setState(next)
    stateRef.current = next
    playSound('confirm')
    setFeatureStatus(`LOCAL EFFECT APPLIED · ${selectedRegion.name} community network expanded.`)
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
      ? 'Microphone permission was denied. Scripted voice fallback is active.'
      : 'Realtime is unavailable. Scripted voice fallback is active.')
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
    appendVoiceSubtitle('system', 'Confirmed: the in-game Tibo reset ran once. Global map pulse activated.')
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
          appendVoiceSubtitle('system', 'Tool request validated. Waiting for a separate spoken confirmation, e.g. 「やって！」 or “Do it!”')
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
      appendVoiceSubtitle('system', `Reset cooldown is active for ${Math.ceil(stateRef.current.resetCooldownSeconds)} seconds.`)
      return
    }
    if (result.request?.source === 'realtime') {
      voiceClientRef.current?.requestResponse(result.outcome === 'rejected'
        ? 'The player rejected the visible fallback approval. Briefly acknowledge that no game action ran.'
        : 'The player used the visible fallback approval. Briefly acknowledge the game-only outcome.')
    }
    if (!result.shouldExecute) {
      if (result.outcome === 'rejected') appendVoiceSubtitle('system', 'Player rejected trigger_token_reset. No game action ran.')
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
      label: region.name,
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
    { id: 'tokyo', regionId: 'eastAsia', label: 'Build Week Tokyo', kind: 'community', sourceLabel: 'Your Timeline' },
    { id: 'race', regionId: 'na', label: 'Race pressure', kind: 'source', sourceLabel: 'AI 2027', active: date >= '2027-01-01' },
    { id: 'verification', regionId: 'eu', label: 'Verification forum', kind: 'policy', sourceLabel: 'AI 2040', active: date >= '2029-01-01' },
    ...(state.flags.includes('feature:education') ? [{ id: 'education', regionId: 'india' as const, label: 'School access', kind: 'community' as const, sourceLabel: 'Your Timeline' as const }] : []),
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
    title: option.label,
    summary: option.summary,
    consequence: option.id === 'verified-slowdown'
      ? 'Trust, safety, governance, and healthy competition rise; near-term growth slows.'
      : option.id === 'race-ahead'
        ? 'Capability and growth surge while both control gaps widen.'
        : 'Internal safeguards improve, but competitors cannot verify the pause.',
  })) as unknown as ScenarioDecisionOptions

  const decisionOptions2035 = scenario2035.decision!.options.map((option) => ({
    id: option.id,
    title: option.label,
    summary: option.summary,
    consequence: option.id === 'hold-the-line'
      ? 'A controlled pause preserves human agency and keeps Plan A available.'
      : 'Growth resumes before the safety case is complete, reopening the race route.',
  })) as unknown as ScenarioDecisionOptions

  const divergences = useMemo<DecisionDivergences>(() => [
    {
      year: '2026',
      decision: 'Public access',
      referenceScenario: 'Coding agents diffuse through firms and research loops.',
      yourTimeline: state.flags.includes('feature:education') ? 'Education Mode made schools a first-class access route.' : 'Product access remained commercially led.',
      whyItMattered: 'Who gets access changes both the benefits and the governance obligations.',
    },
    {
      year: '2029',
      decision: 'Race or slowdown',
      referenceScenario: 'Plan A uses a transparent, internationally verified slowdown.',
      yourTimeline: state.choice2029 === null
        ? 'Not reached before termination.'
        : state.choice2029 === 'verified-slowdown'
          ? 'You chose verifiable coordination.'
          : state.choice2029 === 'slowdown'
            ? 'You paused internally without shared verification.'
            : 'You continued the capability race.',
      whyItMattered: 'A pause creates safety only when rivals can see and trust it.',
    },
    {
      year: '2035',
      decision: 'Hold the line',
      referenceScenario: 'Frontier systems stop at top-human expert capability while safety evidence matures.',
      yourTimeline: state.choice2035 === null
        ? 'Not reached before termination.'
        : state.choice2035 === 'hold-the-line'
          ? 'You kept the deliberate capability ceiling.'
          : 'You accelerated again under competitive pressure.',
      whyItMattered: 'This choice tested whether human control could outrank short-term advantage.',
    },
  ], [state.choice2029, state.choice2035, state.flags])

  const resetProgress = state.resetCooldownSeconds > 0
    ? 1 - state.resetCooldownSeconds / constants.resetCooldownSeconds
    : 1
  const timelineProgress = clamp(state.day / END_DAY * 100)
  const latestNews = state.news[0]
  const latestNewsDetail = latestNews?.source === 'Live GM'
    ? 'Validated event received through the browser-local GM bridge.'
    : 'A deterministic scenario event with provenance owned by the simulation engine.'
  const tutorial = tutorialStep === null ? null : TUTORIAL_STEPS[tutorialStep]
  const isCrisisBrief = Boolean(criticalNews && /SAFETY|ALIGNMENT|REGULATORY|MISALIGNMENT|CRITICAL|EMERGENCY/i.test(criticalNews.headline))
  const simulationStatus = showStartScreen
    ? 'STANDBY · AWAITING MISSION START'
    : tutorial
      ? 'PAUSED · TUTORIAL'
    : decisionKind
      ? 'PAUSED · DECISION REQUIRED'
      : state.pendingWorldEvent
        ? `PAUSED · ${state.pendingWorldEvent.category.toUpperCase()} EVENT`
      : criticalNews
      ? `PAUSED · ${isCrisisBrief ? 'CRITICAL EVENT' : 'WORLD BRIEF'}`
      : upgradeOpen
        ? 'PAUSED · STRATEGY REVIEW'
        : paused
          ? 'PAUSED · PLAYER CONTROL'
          : `RUNNING · ${state.speed === 8 ? 'FAST FORWARD' : 'NORMAL'} · ${state.momentumDays > 0 ? `MOMENTUM ${state.momentumDays}D` : 'MOMENTUM STALLED'}`
  const criticalCause = criticalNews
    ? /SAFETY|ALIGNMENT/i.test(criticalNews.headline)
      ? `Capability is outrunning safety. Current safety gap: ${m.safetyGap.toFixed(1)}.`
      : /REGULATORY/i.test(criticalNews.headline)
        ? `Governance debt or market concentration triggered policy action. HHI: ${m.hhi.toFixed(2)}.`
        : /BUILD WEEK/i.test(criticalNews.headline)
          ? 'A community milestone expands attention and creates a new window for action.'
          : /AGENTS REACH/i.test(criticalNews.headline)
            ? 'AI 2027 race pressure is accelerating. Control capacity must keep pace with capability.'
            : criticalNews.source === 'Live GM'
          ? 'A validated Game Master event changed the competitive field.'
          : 'A reference-scenario milestone changed the world state.'
    : ''

  return (
    <main className={`command-shell${state.resetBoostSeconds > 0 ? ' is-boosting' : ''}`}>
      <div className="command-shell__grain" aria-hidden="true" />

      <header className="command-header">
        <div className="command-brand">
          <span className="command-brand__mark"><Bot size={20} /></span>
          <span><b>CODEX <i>//</i> 2040</b><small>AI GOVERNANCE SCENARIO SIMULATOR</small></span>
        </div>
        <div className="command-header__center">
          <button className="tutorial-launcher" onClick={beginWithTutorial} aria-expanded={tutorialStep !== null}>HOW TO PLAY</button>
          <button className="new-game-launcher" type="button" disabled={showStartScreen} onClick={() => { setRestartConfirmOpen(true); playSound('tap') }}><RotateCcw size={11} /> NEW GAME</button>
        </div>
        <div className="simulation-clock">
          <div className="simulation-clock__actions">
            <button className="voice-call-launcher" onClick={() => { setVoiceOpen(true); playSound('tap') }} aria-expanded={voiceOpen}><Phone size={13} /> VOICE OPERATOR</button>
            <button
              className="sound-toggle"
              type="button"
              aria-label={soundEnabled ? 'Mute game sound effects' : 'Enable game sound effects'}
              aria-pressed={!soundEnabled}
              title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              onClick={() => {
                const enabled = !soundEnabled
                setSoundEnabled(enabled)
                audioRef.current?.setEnabled(enabled)
                if (enabled) audioRef.current?.play('tap')
              }}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />} {soundEnabled ? 'SFX ON' : 'SFX OFF'}
            </button>
          </div>
          <span><i /> DETERMINISTIC ENGINE</span>
          <strong>{date}</strong>
        </div>
      </header>

      <section className="intel-strip" aria-label="Latest scenario intelligence">
        <div className="intel-strip__label"><Radio size={13} /> SCENARIO INTELLIGENCE</div>
        {latestNews && <div className="intel-strip__headline"><SourceBadge source={latestNews.source} /><OverflowTicker className="intel-strip__ticker" text={`${latestNews.headline} · ${latestNewsDetail}`} /></div>}
        <div className="source-key" aria-label="Source label key">
          {(['AI 2027', 'AI 2040', 'Your Timeline'] as SourceLabel[]).map((source) => <SourceBadge source={source} key={source} />)}
        </div>
      </section>

      <section className="command-grid">
        <aside className="telemetry-rail">
          <div className="section-label"><Activity size={13} /> GLOBAL TELEMETRY</div>
          <div className="primary-counter">
            <span>CODEX USERS</span>
            <strong>{fmt(m.codexUsers * 1_000_000)}</strong>
            <small>{pct(m.codexShare)} OF ACTIVE AI USERS</small>
          </div>
          <div className="telemetry-pair">
            <span><small>WORLD ACCESS</small><b>{pct(m.worldAdoption)}</b></span>
            <span><small>MISSION SCORE</small><b>{score.rank} · {Math.round(score.score * 100)}</b></span>
          </div>
          <div className="mission-breakdown" aria-label="Mission score breakdown">
            <span><small>ACCESS</small><b>{Math.round(score.access * 100)}</b></span>
            <span><small>COVERAGE</small><b>{Math.round(score.coverage * 100)}</b></span>
            <span><small>COMPETITION</small><b>{Math.round(score.competition * 100)}</b></span>
            <span><small>SAFETY</small><b>{Math.round(score.safety * 100)}</b></span>
          </div>
          <Meter label="SOCIAL TRUST" value={state.trust} danger={state.trust < 45} />
          <div className="trust-causality" aria-label="Social Trust explanation">
            <div><span>TRUST TARGET</span><b>{trustCausality.target.toFixed(0)}</b><strong className={trustCausality.dailyDelta < 0 ? 'is-negative' : 'is-positive'}>{trustCausality.dailyDelta >= 0 ? '+' : ''}{trustCausality.dailyDelta.toFixed(2)}/DAY</strong></div>
            {trustFactors.map((factor) => <p key={factor.id} className={factor.value < 0 ? 'is-negative' : 'is-positive'}><span>{factor.label}</span><b>{factor.value >= 0 ? '+' : ''}{factor.value.toFixed(0)}</b></p>)}
          </div>
          <div className="risk-radar" data-danger={riskRadar.pressure >= 80}>
            <div><span>CONTROL PRESSURE</span><b>{riskRadar.pressure}%</b></div>
            {riskRadar.risks.map((risk) => <p key={risk.label}><span>{risk.label}</span><b>{risk.detail}</b></p>)}
          </div>
          <Meter label="MARKET HEALTH" value={(1 - m.hhi) * 100} hint={`HHI ${m.hhi.toFixed(2)} · lower concentration is healthier`} danger={m.hhi > .6} />

          <div className="section-label section-label--sub"><Network size={13} /> COMPETITIVE FIELD</div>
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
              { label: 'MODEL', value: state.rivalCapability[selectedCompetitor] },
              { label: 'PRODUCT', value: state.rivalProduct[selectedCompetitor] },
              { label: 'COMPANY', value: state.rivalCompany[selectedCompetitor] },
            ]
            const strongest = [...axes].sort((left, right) => right.value - left.value)[0]
            const shareDelta = state.rivalShares[selectedCompetitor] - m.codexShare
            return (
              <section className="competitor-dossier" aria-label={`${name} competitive details`}>
                <header><span>COMPETITOR DOSSIER · MAP VIEW ACTIVE</span><button type="button" onClick={() => { setSelectedCompetitor(null); playSound('tap') }} aria-label="Close competitor details">×</button></header>
                <div><b>{name}</b><strong className={shareDelta > 0 ? 'is-leading' : ''}>{shareDelta > 0 ? '+' : ''}{Math.round(shareDelta * 100)} pts vs CODEX</strong></div>
                <dl>
                  <div><dt>SHARE</dt><dd>{pct(state.rivalShares[selectedCompetitor])}</dd></div>
                  {axes.map((axis) => <div key={axis.label}><dt>{axis.label}</dt><dd>{axis.value.toFixed(1)}</dd></div>)}
                </dl>
                <p><b>{strongest.label} LEAD</b>{strongest.value >= 8 ? 'Frontier-grade pressure is active.' : strongest.value >= 5 ? 'Scaling rapidly; respond before the next stage.' : 'Early investment is building momentum.'}</p>
              </section>
            )
          })()}

          <div className="gm-watchdog" data-mode="advisor">
            <div><Radio size={13} /><span><b>ADVISOR MODE</b><small>CONSULTATION ONLY</small></span></div>
            <strong>100</strong>
            <p>Ask the Advisor for a move or tradeoff. It translates your intent into an available action; the deterministic engine and your choices remain in control.</p>
          </div>
        </aside>

        <section className="world-stage">
          <div className="world-stage__header">
            <span><small>OPERATIONS MAP</small><b>{competitiveMapView ? `${competitiveMapView.label} TERRITORY ANALYSIS` : 'GLOBAL AI ACCESS NETWORK'}</b></span>
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
                <span className="start-brief__eyebrow">AI GOVERNANCE SCENARIO SIMULATOR</span>
                <h1 id="start-brief-title">BUILD THE FUTURE.</h1>
                <p>Expand useful AI from 2026 to 2040 while keeping safety, governance, public trust, and healthy competition alive.</p>
                <div className="start-brief__sources"><SourceBadge source="AI 2027" /><SourceBadge source="AI 2040" /><SourceBadge source="Your Timeline" /></div>
                <footer>
                  <button autoFocus onClick={beginWithTutorial}>START WITH BRIEFING <ChevronRight size={14} /></button>
                  <button onClick={beginWithoutTutorial}>SKIP BRIEFING</button>
                </footer>
                <small>PROGRESS AUTOSAVES IN THIS BROWSER</small>
              </section>
            )}
            {restartConfirmOpen && !showStartScreen && (
              <section className="restart-confirm" role="dialog" aria-modal="true" aria-labelledby="restart-confirm-title">
                <span>NEW TIMELINE</span>
                <h2 id="restart-confirm-title">START FROM 2026?</h2>
                <p>Your current timeline and browser autosave will be replaced. This cannot be undone.</p>
                <footer>
                  <button autoFocus onClick={() => { setRestartConfirmOpen(false); playSound('tap') }}>KEEP PLAYING</button>
                  <button onClick={resetGameToStart}>ERASE · NEW GAME</button>
                </footer>
              </section>
            )}
            {tutorial && (
              <section className="tutorial-brief" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
                <header><span>{tutorial.eyebrow}</span><span><b>{tutorialStep! + 1} / {TUTORIAL_STEPS.length}</b><button onClick={finishTutorial}>{hasStarted ? 'CLOSE · RESUME' : 'SKIP TUTORIAL'}</button></span></header>
                <div className="tutorial-progress" aria-hidden="true">{TUTORIAL_STEPS.map((_, index) => <i key={index} className={index <= tutorialStep! ? 'is-active' : ''} />)}</div>
                <h2 id="tutorial-title">{tutorial.title}</h2>
                <p>{tutorial.body}</p>
                <aside>{hasStarted && tutorialStep === 0 ? 'The simulation is paused while this guide is open.' : tutorial.cue}</aside>
                <footer>
                  <button disabled={tutorialStep === 0} onClick={() => { setTutorialStep((step) => step === null ? 0 : Math.max(0, step - 1)); playSound('tap') }}>BACK</button>
                  <button autoFocus onClick={() => { if (tutorialStep === TUTORIAL_STEPS.length - 1) finishTutorial(); else { setTutorialStep((step) => step === null ? 0 : step + 1); playSound('tap') } }}>{tutorialStep === TUTORIAL_STEPS.length - 1 ? (hasStarted ? 'RESUME SIMULATION' : 'BEGIN SIMULATION') : 'NEXT'}</button>
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
                advisorCopy="Tell the Codex 2040 Advisor what you want to protect or exploit. It will translate that intent into an available action; you execute it."
              />
            )}
            {criticalNews && !decisionKind && tutorialStep === null && !state.terminal && (
              <section className="critical-brief" data-crisis={isCrisisBrief} role="dialog" aria-modal="true" aria-labelledby="critical-brief-title">
                <header><SourceBadge source={criticalNews.source} /><time>{criticalNews.date}</time><span>{isCrisisBrief ? 'CRITICAL BRIEF' : 'WORLD BRIEF'} · SIMULATION PAUSED</span></header>
                <h2 id="critical-brief-title">{criticalNews.headline}</h2>
                <p>{criticalCause}</p>
                <dl>
                  <div><dt>{isCrisisBrief ? 'TRUST' : 'TRUST OUTLOOK'}</dt><dd>{state.trust.toFixed(0)} → TARGET {trustCausality.target.toFixed(0)}</dd></div>
                  <div><dt>TOP RISK</dt><dd>{riskRadar.primary.label} · {riskRadar.pressure}%</dd></div>
                </dl>
                <button autoFocus onClick={() => { setCriticalNews(null); playSound('tap') }}>ACKNOWLEDGE · RESUME {state.speed === 8 ? 'FAST FORWARD' : 'NORMAL'}</button>
              </section>
            )}
            {selectedRegion && selectedRegionId && <div className="region-inspector">
              <span>SELECTED REGION</span>
              <h2>{selectedRegion.name}</h2>
              <dl>
                <div><dt>AI ACCESS</dt><dd>{pct(selectedRegion.users / selectedRegion.population)}</dd></div>
                <div><dt>{competitiveMapView ? `${competitiveMapView.label} EST. SHARE` : 'CODEX SHARE'}</dt><dd>{pct(competitiveMapView?.shares[selectedRegionId] ?? selectedRegion.codexShare)}</dd></div>
                <div><dt>REGULATION</dt><dd>{pct(selectedRegion.regulation)}</dd></div>
              </dl>
              <button onClick={deployRegion}>{selectedRegion.introduced ? 'HOST COMMUNITY EVENT' : 'OPEN FIRST COMMUNITY'}<ChevronRight size={14} /></button>
            </div>}
          </div>
          <div className="timeline-track">
            <span>2026</span><div><i style={{ width: `${timelineProgress}%` }} /><b style={{ left: `${timelineProgress}%` }} /></div><span>2040</span>
          </div>
        </section>

        <aside className="strategy-rail">
          <div className="section-label"><Cpu size={13} /> STRATEGY LAYER</div>
          <div className="compute-counter"><span>AVAILABLE COMPUTE</span><strong>{fmt(state.compute, 1)} <small>PF</small></strong><small className={state.momentumDays > 0 ? 'is-active' : 'is-stalled'}><OverflowTicker text={state.momentumDays > 0 ? `MOMENTUM ACTIVE · ${state.momentumDays} DAYS` : 'MOMENTUM STALLED · ACT TO GROW MODEL CAPABILITY'} /></small></div>
          <button className="strategy-axis" onClick={() => openStrategy('model')}>
            <span><BrainCircuit size={16} /><b>MODEL</b><small>CAPABILITY</small></span><strong>K{state.capability.toFixed(1)}</strong><ChevronRight size={14} />
          </button>
          <button className="strategy-axis" onClick={() => openStrategy('product')}>
            <span><Sparkles size={16} /><b>PRODUCT</b><small>{enabledFeatures.length} FEATURES</small></span><strong>ACCESS</strong><ChevronRight size={14} />
          </button>
          <button className="strategy-axis" onClick={() => openStrategy('company')}>
            <span><ShieldCheck size={16} /><b>COMPANY</b><small>CONTROL CAPACITY</small></span><strong>S{state.safety.toFixed(0)} / G{state.governance.toFixed(0)}</strong><ChevronRight size={14} />
          </button>

          <div className="control-envelope">
            <div className="section-label section-label--sub"><ShieldCheck size={13} /> CONTROL ENVELOPE</div>
            <Meter label="CAPABILITY" value={state.capability} max={10} />
            <Meter label="SAFETY" value={state.safety} max={10} danger={m.safetyGap >= 3} hint={m.safetyGap > 0 ? `Capability gap +${m.safetyGap.toFixed(1)}` : 'At capability parity'} />
            <Meter label="GOVERNANCE" value={state.governance} max={10} danger={m.governanceGap >= 3} hint={m.governanceGap > 0 ? `Capability gap +${m.governanceGap.toFixed(1)}` : 'At capability parity'} />
          </div>

          <button className="open-ecosystem" onClick={() => performUpgradeAction('ecosystem')} disabled={state.ecosystemCooldownSeconds > 0}>
            <Network size={17} /><span><b>OPEN ECOSYSTEM</b><small>{state.ecosystemCooldownSeconds > 0 ? `READY IN ${Math.ceil(state.ecosystemCooldownSeconds)}s` : 'RELEASE SHARE · GROW TRUST'}</small></span><ArrowUpRight size={14} />
          </button>
          <button className="open-strategy" onClick={() => openStrategy('model')}>OPEN FULL CAPABILITY TREE <ChevronRight size={14} /></button>

          <div className="event-ledger">
            <div className="section-label section-label--sub"><Radio size={13} /> EVENT LEDGER</div>
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
          <span><small>TIBO PROTOCOL · 8s GLOBAL BOOST</small><b>{state.resetCooldownSeconds > 0 ? `TOKEN RESET · ${Math.ceil(state.resetCooldownSeconds)}s` : 'TOKEN RESET READY'}</b></span>
        </button>

        <form className="feature-console" onSubmit={submitFeature}>
          <div className="feature-console__label"><Sparkles size={15} /><span><small>SHIP A FEATURE</small><b>Describe the intent; ask the Advisor to map the tradeoff</b></span></div>
          <div className="feature-console__input">
            <input value={featureText} onChange={(event) => setFeatureText(event.target.value)} maxLength={60} placeholder="Describe a capability in 60 characters…" aria-label="Feature proposal" />
            <button type="submit">SHIP <ChevronRight size={13} /></button>
          </div>
          <button className="education-shortcut" type="button" onClick={() => shipFeature(EDUCATION_PROMPT)}><GraduationCap size={13} /> DEPLOY EDUCATION MODE</button>
          <p className={featureStatus.startsWith('LIVE GM') ? 'is-live' : ''}>{featureStatus}</p>
        </form>

        <div className="time-controls">
          <button aria-pressed={paused} className="pause-button" onClick={() => { setPaused((value) => !value); playSound('time') }}>{paused ? <CirclePlay size={16} /> : <CirclePause size={16} />}{paused ? 'RESUME' : 'PAUSE'}</button>
          <div className="speed-modes">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                aria-label={speed === 1 ? 'Normal speed — 1 day per second' : 'Fast forward — 8 days per second'}
                aria-pressed={state.speed === speed}
                className={state.speed === speed ? 'is-active' : ''}
                onClick={() => setSpeed(speed)}
              >
                {speed === 1 ? <CirclePlay size={16} /> : <ChevronsRight size={20} />}
                <span>{speed === 1 ? 'NORMAL' : 'FAST'}</span>
              </button>
            ))}
          </div>
          <small className="speed-readout">{state.speed === 8 ? 'FAST FORWARD · 8 DAYS / SEC' : 'NORMAL · 1 DAY / SEC'} · {state.momentumDays > 0 ? `${state.momentumDays} MOMENTUM DAYS` : 'ACCESS GROWTH STALLED'}</small>
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
        title={scenario2029.title}
        context={scenario2029.summary}
        options={decisionOptions2029}
        selectedOptionId={decisionSelection}
        whyThisMatters={scenario2029.whyThisMatters}
        onSelect={setDecisionSelection}
        onConfirm={confirmDecision}
      />

      <ScenarioDecision
        open={decisionKind === '2035'}
        milestone="hold-the-line-2035"
        source={{ label: 'AI 2040 / Plan A', href: scenario2035.sourceUrl ?? AI_2040_URL }}
        title={scenario2035.title}
        context={scenario2035.summary}
        options={decisionOptions2035}
        selectedOptionId={decisionSelection}
        whyThisMatters={scenario2035.whyThisMatters}
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
        referenceSummary="AI 2027 supplies the race pressure. AI 2040: Plan A supplies the verified slowdown, deliberate pause, and evidence-led restart."
        timelineSummary={`Simulation ${state.day < END_DAY ? 'terminated' : 'completed'} on ${dateLabel(state.day)}. The 2029 path was ${state.choice2029 ?? 'not reached before termination'}; the 2035 path was ${state.choice2035 ?? 'not reached before termination'}. Final access ${pct(m.worldAdoption)}, HHI ${m.hhi.toFixed(2)}.`}
        divergences={divergences}
        onClose={() => setEndingVisible(false)}
        onRestart={resetGameToStart}
      />
    </main>
  )
}
