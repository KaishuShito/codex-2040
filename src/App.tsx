import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
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
  Music2,
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
  acquiredStrategyNodeIds,
  addFeature,
  acknowledgeWorldEvent,
  advanceRealtime,
  buyUpgrade,
  buyStrategyNode,
  choose2029,
  choose2035,
  collectRewardBubble,
  constants,
  createInitialState,
  dateLabel,
  discardRewardBubbles,
  computeEconomy,
  enforceInvariants,
  evaluateEnding,
  extinctionRiskDailyDelta,
  getStrategyNodeAvailability,
  humanExtinctionRisk,
  introduceRegion,
  metrics,
  productStrategyLevel,
  openEcosystem,
  requestComputeLifeline,
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
import { getStrategyNode } from './strategyNodes'
import { AI_2040_URL, getDecisionMilestones, type SourceLabel } from './scenario'
import WorldMap, { type WorldMapCompetitiveView, type WorldMapMarker, type WorldMapRegionIntensity, type WorldMapRewardBubble } from './components/WorldMap'
import UpgradeOverlay, {
  type UpgradeOverlayAction,
  type UpgradeOverlayCosts,
  type UpgradeOverlayFeature,
  type UpgradeOverlayTab,
} from './components/UpgradeOverlay'
import ScenarioDecision, { type ScenarioDecisionOptions } from './components/ScenarioDecision'
import EndingOverlay, { type AnonymousWorldlineReceipt, type DecisionDivergences } from './components/EndingOverlay'
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
import { decodeSession, encodeSession, LEGACY_SESSION_STORAGE_KEY, SESSION_STORAGE_KEY } from './session'
import { createBrowserRunTelemetry, type RunTelemetry } from './runTelemetry'
import { fetchRunReceipt } from './runApi'
import { getEventSourceUrl } from './sourceLinks'
import type { StrategyNodeId } from './strategyNodes'
import { WORLD_EVENTS } from './worldEvents'
import {
  STANDARD_COPY,
  STANDARD_ENDING_CONTEXT,
  STANDARD_EVENT_CATEGORY_LABELS,
  STANDARD_REGION_LABELS,
  STANDARD_TRUST_FACTOR_LABELS,
  STANDARD_TUTORIAL_STEPS,
  getStandardWorldEventCopy,
  getStandardCopy,
  localizeStandardNewsHeadline,
  localizeStandard,
  type StandardLocale,
} from './standardI18n'

const PREDEFINED_FEATURE_PROMPTS = {
  mobile: 'Mobile support for Android and iOS',
  enterprise: 'Enterprise SSO for public institutions',
  education: 'Free Education Mode for schools worldwide',
  research: 'Deep research with cited web and file sources',
  connectors: 'Secure apps and connectors for workplace data',
  analysis: 'Advanced data analysis with code execution',
} as const
type PredefinedFeatureId = keyof typeof PREDEFINED_FEATURE_PROMPTS
const dayFor = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - START_DATE) / 86_400_000)
const DECISION_2029_DAY = dayFor('2029-01-01')
const DECISION_2035_DAY = dayFor('2035-01-01')
const INITIAL_STATE = enforceInvariants(createInitialState())
export const INITIAL_MARKET_BASELINE = Object.freeze({
  codex: metrics(INITIAL_STATE).codexShare,
  rivals: [...INITIAL_STATE.rivalShares] as [number, number, number],
})
const INITIAL_CODEX_SHARE = INITIAL_MARKET_BASELINE.codex
const INITIAL_RIVAL_SHARES = INITIAL_MARKET_BASELINE.rivals
const CRISIS_HEADLINE_PATTERN = /SAFETY|ALIGNMENT|REGULATORY|MISALIGNMENT|EXTINCTION(?: RISK)?|CRITICAL|EMERGENCY/i
const AUTO_PAUSE_WARNING_PATTERN = /SAFETY INCIDENT|REGULATORY FREEZE|MISALIGNMENT|EXTINCTION RISK|CRITICAL|EMERGENCY|DECISION/i

export const isCrisisHeadline = (headline: string) => CRISIS_HEADLINE_PATTERN.test(headline)
export const shouldAutoPauseForNews = (item: Pick<NewsItem, 'headline' | 'tone'>) => (
  /BUILD WEEK|AGENTS REACH/i.test(item.headline)
  || (item.tone === 'warn' && AUTO_PAUSE_WARNING_PATTERN.test(item.headline))
)
export const formatExtinctionRiskRate = (dailyRiskPoints: number, thresholdDays: number, locale: StandardLocale = 'ja') => {
  const percentagePoints = dailyRiskPoints / Math.max(1, thresholdDays) * 100
  return `${percentagePoints >= 0 ? '+' : ''}${percentagePoints.toFixed(1)}pt/${locale === 'ja' ? '日' : 'day'}`
}

type NewsFilter = 'major' | 'rivals' | 'all'

const decisionMilestones = getDecisionMilestones()
const scenario2029 = decisionMilestones.find((milestone) => milestone.date.startsWith('2029-'))!
const scenario2035 = decisionMilestones.find((milestone) => milestone.date.startsWith('2035-'))!

const fmt = (value: number, maximumFractionDigits = 0, locale: StandardLocale = 'ja') => new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { maximumFractionDigits }).format(value)
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
        ?? decodeSession(window.localStorage.getItem(LEGACY_SESSION_STORAGE_KEY))
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

function SourceBadge({ source, href, locale = 'ja' }: { source: SourceLabel; href?: string; locale?: StandardLocale }) {
  if (source === 'Your Timeline') return null
  const label = source === 'Live GM' ? (locale === 'ja' ? 'ライブGM' : 'Live GM') : source
  if (href) return <a className="source-badge" data-source={source} href={href} target="_blank" rel="noreferrer" aria-label={`${label}${getStandardCopy(locale, 'sourceOpen')}`}>{label}</a>
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

export type AppProps = { locale?: StandardLocale }

export default function App({ locale = 'ja' }: AppProps) {
  const c = (key: keyof typeof STANDARD_COPY) => getStandardCopy(locale, key)
  const [initialSession] = useState(loadInitialSession)
  const [state, setState] = useState<GameState>(initialSession.state)
  const [showStartScreen, setShowStartScreen] = useState(!initialSession.restored || !initialSession.hasStarted)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const [hasStarted, setHasStarted] = useState(initialSession.hasStarted)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [musicEnabled, setMusicEnabled] = useState(() => {
    try { return window.localStorage.getItem('codex-2040:bgm') !== 'off' } catch { return true }
  })
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [actionNudge, setActionNudge] = useState(false)
  const [paused, setPaused] = useState(false)
  const [criticalNews, setCriticalNews] = useState<NewsItem | null>(null)
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('major')
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId | null>('eastAsia')
  const [selectedCompetitor, setSelectedCompetitor] = useState<number | null>(null)
  const [previewCompetitor, setPreviewCompetitor] = useState<'codex' | number | null>(null)
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
  const [worldlineReceipt, setWorldlineReceipt] = useState<AnonymousWorldlineReceipt | null>(null)
  const [activePlaySeconds, setActivePlaySeconds] = useState<number | null>(null)

  const stateRef = useRef(state)
  const hasStartedRef = useRef(hasStarted)
  const runTelemetryRef = useRef<RunTelemetry | null>(null)
  const persistTimerRef = useRef<number | null>(null)
  const audioRef = useRef<GameAudio | null>(null)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  if (!audioRef.current) audioRef.current = new GameAudio()
  const pendingTimersRef = useRef<number[]>([])
  const voiceClientRef = useRef<RealtimeVoiceClient | null>(null)
  const voiceResetRef = useRef(voiceResetState)
  const voiceSubtitleIdRef = useRef(0)
  const observedNewsIdRef = useRef(state.news[0]?.id ?? 0)
  const lowerCommandRef = useRef<HTMLElement | null>(null)
  const lastBriefSoundIdRef = useRef<number | null>(null)
  const lastDecisionSoundRef = useRef<string | null>(null)

  const m = useMemo(() => metrics(state), [state])
  const trustCausality = useMemo(() => trustBreakdown(state), [state])
  const score = useMemo(() => scoreState(state), [state])
  const economy = useMemo(() => computeEconomy(state), [state])
  const extinctionRisk = useMemo(() => humanExtinctionRisk(state), [state])
  const extinctionRiskDelta = useMemo(() => extinctionRiskDailyDelta(state), [state])
  const extinctionRiskPct = Math.round(extinctionRisk * 100)
  const extinctionRiskRising = extinctionRiskDelta > 0
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
      { label: locale === 'ja' ? '安全事故' : 'Safety incident', ratio: m.safetyGap / constants.gapThreshold, detail: `${locale === 'ja' ? '差' : 'Gap'} ${m.safetyGap.toFixed(1)} / ${constants.gapThreshold}` },
      { label: locale === 'ja' ? '制御喪失' : 'Loss of control', ratio: extinctionRisk, detail: `${c('dangerDays')} ${state.safetyGapDays} / ${constants.misalignmentThresholdDays}` },
      { label: locale === 'ja' ? '規制凍結' : 'Regulatory freeze', ratio: Math.max(m.governanceGap / constants.gapThreshold, m.hhi / .6), detail: `${locale === 'ja' ? '差' : 'Gap'} ${m.governanceGap.toFixed(1)} · HHI ${m.hhi.toFixed(2)}` },
    ]
    const primary = [...risks].sort((left, right) => right.ratio - left.ratio)[0]
    return { risks, primary, pressure: Math.round(Math.min(1, primary.ratio) * 100) }
  }, [extinctionRisk, locale, m.governanceGap, m.hhi, m.safetyGap, state.safetyGapDays])
  const date = dateLabel(state.day)
  const decisionKind = state.day >= DECISION_2035_DAY && !state.choice2035
    ? '2035'
    : state.day >= DECISION_2029_DAY && !state.choice2029
      ? '2029'
      : null
  const simulationBlocked = showStartScreen || restartConfirmOpen || tutorialStep !== null || paused || Boolean(criticalNews) || Boolean(state.pendingWorldEvent) || upgradeOpen || Boolean(decisionKind) || state.terminal

  useEffect(() => {
    if (!simulationBlocked || state.rewardBubbles.length === 0) return
    setState((current) => {
      const next = discardRewardBubbles(current)
      stateRef.current = next
      return next
    })
  }, [simulationBlocked, state.rewardBubbles.length])

  const worldEventPopup = useMemo<WorldEventPopupNotice | null>(() => {
    const notice = state.pendingWorldEvent
    if (!notice) return null
    const definition = WORLD_EVENTS.find((event) => event.id === notice.eventId)
    const localizedCombo = notice.comboLabel
      ? definition?.combos?.find((combo) => combo.label === notice.comboLabel)
        ?? (definition?.combos?.length === 1 ? definition.combos[0] : undefined)
      : undefined
    const eventCopy = definition ? getStandardWorldEventCopy(locale, definition, localizedCombo) : null
    const signed = (value: number, suffix = '') => `${value > 0 ? '+' : ''}${value}${suffix}`
    const effects = [
      notice.effect.usersDeltaPct !== 0 ? { label: locale === 'ja' ? 'AI利用者' : 'AI users', amount: signed(notice.effect.usersDeltaPct, '%'), tone: notice.effect.usersDeltaPct > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.shareDelta !== 0 ? { label: notice.effect.target && notice.effect.target !== 'codex' ? (locale === 'ja' ? '競合シェア' : 'Rival share') : (locale === 'ja' ? 'CODEXシェア' : 'CODEX share'), amount: signed(Math.round(notice.effect.shareDelta * 100), locale === 'ja' ? '点' : 'pt'), tone: notice.effect.target && notice.effect.target !== 'codex' ? 'negative' as const : notice.effect.shareDelta > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.growthRateDelta !== 0 ? { label: locale === 'ja' ? '普及率' : 'Adoption rate', amount: signed(Math.round(notice.effect.growthRateDelta * 100), '%'), tone: notice.effect.growthRateDelta > 0 ? 'positive' as const : 'negative' as const } : null,
      notice.effect.trustDelta !== 0 ? { label: c('trustTarget'), amount: signed(notice.effect.trustDelta), tone: notice.effect.trustDelta > 0 ? 'positive' as const : 'negative' as const } : null,
    ].filter((effect): effect is NonNullable<typeof effect> => Boolean(effect))
    return {
      id: notice.eventId,
      source: notice.source,
      category: localizeStandard(locale, STANDARD_EVENT_CATEGORY_LABELS[notice.category]),
      date: notice.date,
      dateTime: notice.date,
      headline: eventCopy?.headline ?? (locale === 'ja' ? notice.headline : 'EXTERNAL WORLD EVENT // Source-language briefing'),
      cause: eventCopy?.cause ?? (locale === 'ja' ? notice.cause : 'This external event was supplied without an authored English translation.'),
      flavor: eventCopy?.flavor ?? (locale === 'ja' ? notice.flavor : 'Review the signed effects below before resuming the simulation.'),
      duration: locale === 'ja' ? `シミュレーション ${notice.ttlDays}日` : `Simulation ${notice.ttlDays} days`,
      effects: effects.length > 0 ? effects : [{ label: locale === 'ja' ? '時間軸' : 'Timeline', amount: locale === 'ja' ? '状況変化' : 'State changed', tone: 'neutral' }],
      combo: notice.comboLabel ? {
        priorFeature: eventCopy?.comboLabel ?? (locale === 'ja' ? (notice.comboFeature ?? notice.comboLabel) : 'Authored feature combination'),
        outcome: `${eventCopy?.comboHeadline ?? eventCopy?.comboLabel ?? (locale === 'ja' ? notice.comboLabel : 'Feature combination activated')}${notice.momentumDays > 0 ? ` · ${locale === 'ja' ? '勢い' : 'Momentum'} +${notice.momentumDays}${locale === 'ja' ? '日' : 'd'}` : ''}`,
      } : undefined,
    }
  }, [locale, state.pendingWorldEvent])

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
    const music = new Audio('/audio/pondering-the-cosmos.m4a')
    music.loop = true
    music.preload = 'auto'
    music.volume = .15
    const markPlaying = () => setMusicPlaying(true)
    const markPaused = () => setMusicPlaying(false)
    music.addEventListener('play', markPlaying)
    music.addEventListener('pause', markPaused)
    musicRef.current = music
    return () => {
      music.pause()
      music.removeEventListener('play', markPlaying)
      music.removeEventListener('pause', markPaused)
      musicRef.current = null
    }
  }, [])

  useEffect(() => {
    const music = musicRef.current
    if (!music) return
    music.volume = simulationBlocked ? .08 : .15
    try { window.localStorage.setItem('codex-2040:bgm', musicEnabled ? 'on' : 'off') } catch { /* Preference remains session-local. */ }
    if (!musicEnabled) {
      music.pause()
      return
    }
    if (hasStarted || tutorialStep !== null) void music.play().catch(() => setMusicPlaying(false))
  }, [hasStarted, musicEnabled, simulationBlocked, tutorialStep])

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
    const telemetry = createBrowserRunTelemetry('ja')
    runTelemetryRef.current = telemetry
    const visible = () => document.visibilityState === 'visible'
    const syncActivity = () => telemetry.updateActivity(
      hasStartedRef.current,
      stateRef.current.terminal,
      visible(),
    )
    const suspend = () => telemetry.suspend()
    const retry = () => telemetry.retry()
    const heartbeat = window.setInterval(() => {
      telemetry.checkpoint()
      telemetry.retry()
    }, 5_000)

    telemetry.start()
    syncActivity()
    document.addEventListener('visibilitychange', syncActivity)
    window.addEventListener('online', retry)
    window.addEventListener('pagehide', suspend)
    return () => {
      document.removeEventListener('visibilitychange', syncActivity)
      window.removeEventListener('online', retry)
      window.removeEventListener('pagehide', suspend)
      window.clearInterval(heartbeat)
      telemetry.stop()
      if (runTelemetryRef.current === telemetry) runTelemetryRef.current = null
    }
  }, [])

  useEffect(() => {
    const telemetry = runTelemetryRef.current
    if (!telemetry) return
    telemetry.updateActivity(hasStarted, state.terminal, document.visibilityState === 'visible')
    if (!state.terminal) return

    const snapshot = telemetry.snapshot()
    setActivePlaySeconds(snapshot.activePlaySeconds)
    telemetry.complete({
        final_score: Math.round(ending.score * 100),
        rank: ending.rank,
        ending: ending.id,
        choice_2029: state.choice2029,
        choice_2035: state.choice2035,
      })

    let cancelled = false
    const loadReceipt = async () => {
      await telemetry.flush()
      for (const delay of [0, 1_000, 3_000]) {
        if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay))
        if (cancelled) return
        const receipt = await fetchRunReceipt(snapshot.playId)
        if (receipt) {
          setWorldlineReceipt(receipt)
          return
        }
        telemetry.retry()
      }
    }
    void loadReceipt()
    return () => { cancelled = true }
  }, [ending.id, ending.rank, ending.score, hasStarted, state.choice2029, state.choice2035, state.terminal])

  useEffect(() => {
    if (!state.terminal || worldlineReceipt) return
    const refresh = async () => {
      const telemetry = runTelemetryRef.current
      if (!telemetry) return
      telemetry.retry()
      await telemetry.flush()
      const receipt = await fetchRunReceipt(telemetry.snapshot().playId)
      if (receipt) setWorldlineReceipt(receipt)
    }
    const interval = window.setInterval(() => { void refresh() }, 15_000)
    window.addEventListener('online', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', refresh)
    }
  }, [state.terminal, worldlineReceipt])

  useEffect(() => {
    if (!criticalNews || lastBriefSoundIdRef.current === criticalNews.id) return
    lastBriefSoundIdRef.current = criticalNews.id
    const crisis = isCrisisHeadline(criticalNews.headline)
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
    const critical = unseen.find(shouldAutoPauseForNews)
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

  const shipPredefinedFeature = (featureId: PredefinedFeatureId) => {
    const input = PREDEFINED_FEATURE_PROMPTS[featureId]
    const before = stateRef.current
    const next = addFeature(before, input)
    if (next === before || next.features.length === before.features.length) {
      return
    }
    setState(next)
    stateRef.current = next
    playSound('confirm')
  }

  const deployRegion = () => {
    if (!selectedRegionId || !selectedRegion) return
    const current = stateRef.current
    const next = introduceRegion(current, selectedRegionId)
    if (next === current) {
      return
    }
    setState(next)
    stateRef.current = next
    playSound('confirm')
  }

  const finishTutorial = () => {
    setShowStartScreen(false)
    setTutorialStep(null)
    setHasStarted(true)
    if (musicEnabled) void musicRef.current?.play().catch(() => setMusicPlaying(false))
    playSound('confirm')
    setActionNudge(true)
    const timer = window.setTimeout(() => setActionNudge(false), 4000)
    pendingTimersRef.current.push(timer)
    window.requestAnimationFrame(() => lowerCommandRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
  }

  const beginWithTutorial = () => {
    setShowStartScreen(false)
    setTutorialStep(0)
    if (musicEnabled) void musicRef.current?.play().catch(() => setMusicPlaying(false))
    playSound('tap')
  }

  const beginWithoutTutorial = () => {
    setShowStartScreen(false)
    setTutorialStep(null)
    setHasStarted(true)
    if (musicEnabled) void musicRef.current?.play().catch(() => setMusicPlaying(false))
    playSound('confirm')
  }

  const resetGameToStart = () => {
    const next = initialGame()
    runTelemetryRef.current?.reset()
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY)
    } catch { /* Storage may be disabled. */ }
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
    setWorldlineReceipt(null)
    setActivePlaySeconds(null)
    playSound('confirm')
  }

  const activateReset = () => {
    if (stateRef.current.resetCooldownSeconds > 0) return
    const next = triggerReset(stateRef.current)
    stateRef.current = next
    setState(next)
    setResetPulse((value) => value + 1)
    playSound('confirm')
  }

  const collectBubble = (bubbleId: string) => {
    const before = stateRef.current
    const next = collectRewardBubble(before, bubbleId)
    if (next === before) return
    stateRef.current = next
    setState(next)
    playSound('confirm')
  }

  const activateComputeLifeline = () => {
    const before = stateRef.current
    const next = requestComputeLifeline(before)
    if (next === before) return
    stateRef.current = next
    setState(next)
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

  const speakFallback = (text: string, language: 'ja' | 'en' = 'ja') => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language === 'en' ? 'en-US' : 'ja-JP'
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
    const line = 'こちらはTIBOボイス・オペレーターです。音声回線の代わりに台本モードで、ゲーム内Tiboリセットを案内します。'
    appendVoiceSubtitle('operator', line)
    speakFallback(line)
  }

  const runConfirmedGameReset = (language: 'ja' | 'en' = 'ja') => {
    if (stateRef.current.resetCooldownSeconds > 0) return false
    const next = triggerReset(stateRef.current)
    stateRef.current = next
    setState(next)
    setResetPulse((value) => value + 1)
    playSound('confirm')
    appendVoiceSubtitle('system', language === 'en'
      ? 'Confirmed: the in-game Tibo reset ran once.'
      : '確認済み: ゲーム内Tiboリセットを1回実行しました。')
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
          const language = result.request.language
          appendVoiceSubtitle('system', language === 'en'
            ? 'Request received. Waiting for a separate spoken confirmation such as “Do it.”'
            : '要求を確認しました。「やって！」など、別の音声確認を待っています。')
          return {
            status: 'confirmation_required',
            approval_id: result.request.id,
            scope: 'codex-2040-game-only',
            next_step: language === 'en'
              ? 'Ask the player aloud in English whether to execute. Accept a new short direct approval such as Do it, Yes, or Go ahead; reject negative or unclear replies.'
              : 'Ask the player aloud in Japanese whether to execute. Accept a new short direct approval such as やって, お願い, or はい; reject negative or unclear replies.',
          }
        }
        if (result.outcome === 'executed' && result.shouldExecute) {
          const language = result.request?.language ?? 'ja'
          runConfirmedGameReset(language)
          return {
            status: 'executed',
            scope: 'codex-2040-game-only',
            message: `The in-game Tibo reset ran exactly once and the global map pulse activated. Briefly tell the player in ${language === 'en' ? 'English' : 'Japanese'}; do not switch languages.`,
          }
        }
        if (result.outcome === 'cooldown') {
          return {
            status: 'cooldown',
            retry_after_seconds: Math.ceil(stateRef.current.resetCooldownSeconds),
            scope: 'codex-2040-game-only',
            message: `No reset ran. Briefly explain the game cooldown in ${result.request?.language === 'en' ? 'English' : 'Japanese'}; do not switch languages.`,
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

  const runScriptedVoiceRequest = (language: 'ja' | 'en') => {
    const before = voiceResetRef.current
    const next = requestFallbackReset(before, String(Date.now()), language)
    commitVoiceResetState(next)
    if (!next.pending || next.pending === before.pending) return
    appendVoiceSubtitle('player', next.pending.playerRequest)
    const line = language === 'en'
      ? 'I requested trigger token reset. Please confirm on screen to run this in-game action.'
      : 'trigger_token_resetを要求しました。ゲーム内操作を実行するには、画面で確認してください。'
    appendVoiceSubtitle('operator', line)
    speakFallback(line, language)
  }

  const resolveVoiceApproval = (approved: boolean) => {
    const result = resolveVoiceReset(voiceResetRef.current, approved, stateRef.current.resetCooldownSeconds)
    commitVoiceResetState(result.state)
    const language = result.request?.language ?? 'ja'
    if (result.outcome === 'cooldown') {
      const line = language === 'en'
        ? `Reset is cooling down. Try again in ${Math.ceil(stateRef.current.resetCooldownSeconds)} seconds.`
        : `リセットはあと${Math.ceil(stateRef.current.resetCooldownSeconds)}秒待つ必要があります。`
      appendVoiceSubtitle('system', line)
      if (result.request?.source === 'scripted-fallback') speakFallback(line, language)
      return
    }
    if (result.request?.source === 'realtime') {
      voiceClientRef.current?.requestResponse(result.outcome === 'rejected'
        ? `The player rejected the visible fallback approval. Briefly acknowledge in ${language === 'en' ? 'English' : 'Japanese'} that no game action ran; do not switch languages.`
        : `The player used the visible fallback approval. Briefly acknowledge the game-only outcome in ${language === 'en' ? 'English' : 'Japanese'}; do not switch languages.`)
    }
    if (!result.shouldExecute) {
      if (result.outcome === 'rejected') {
        const line = language === 'en'
          ? 'You rejected trigger_token_reset. No game action ran.'
          : 'プレイヤーがtrigger_token_resetを拒否しました。操作は実行されていません。'
        appendVoiceSubtitle('system', line)
        if (result.request?.source === 'scripted-fallback') speakFallback(line, language)
      }
      return
    }
    runConfirmedGameReset(language)
    if (result.request?.source === 'scripted-fallback') {
      speakFallback(language === 'en'
        ? 'Confirmed. The in-game Tibo reset ran once.'
        : '確認しました。ゲーム内Tiboリセットを1回実行しました。', language)
    }
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
  }, [criticalNews, tutorialStep, voiceMuted, voiceOpen, voiceStatus])

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
    if (action === 'feature-mobile') shipPredefinedFeature('mobile')
    if (action === 'feature-enterprise') shipPredefinedFeature('enterprise')
    if (action === 'feature-research') shipPredefinedFeature('research')
    if (action === 'feature-connectors') shipPredefinedFeature('connectors')
    if (action === 'feature-analysis') shipPredefinedFeature('analysis')
    if (action === 'feature-education') {
      shipPredefinedFeature('education')
      setUpgradeOpen(false)
    }
  }

  const performStrategyNodeAction = (nodeId: StrategyNodeId) => {
    const before = stateRef.current
    const next = buyStrategyNode(before, nodeId)
    if (next === before) return
    stateRef.current = next
    setState(next)
    playSound('confirm')
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
      label: localizeStandard(locale, STANDARD_REGION_LABELS[region.id]),
    } satisfies WorldMapRegionIntensity,
  ])) as Record<RegionId, WorldMapRegionIntensity>, [locale, state.regions])

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
    ...(date >= '2026-07-18' && date <= '2026-08-01'
      ? [{ id: 'tokyo', regionId: 'eastAsia' as const, label: locale === 'ja' ? 'Build Week 東京' : 'Build Week Tokyo', kind: 'community' as const }]
      : []),
    { id: 'race', regionId: 'na', label: locale === 'ja' ? '開発競争' : 'Capability race', kind: 'source', sourceLabel: 'AI 2027', active: date >= '2027-01-01' },
    { id: 'verification', regionId: 'eu', label: locale === 'ja' ? '国際検証会議' : 'International verification summit', kind: 'policy', sourceLabel: 'AI 2040', active: date >= '2029-01-01' },
    ...(state.flags.includes('feature:education') ? [{ id: 'education', regionId: 'india' as const, label: locale === 'ja' ? '学校アクセス' : 'School access', kind: 'community' as const, sourceLabel: 'Your Timeline' as const }] : []),
  ], [date, locale, state.flags])

  const mapRewardBubbles = useMemo<WorldMapRewardBubble[]>(() => simulationBlocked
    ? []
    : state.rewardBubbles.map((bubble) => ({
      id: bubble.id,
      regionId: bubble.region,
      reward: bubble.reward,
      placement: bubble.placement,
      remainingSeconds: bubble.remainingSeconds,
      source: bubble.source,
    })), [simulationBlocked, state.rewardBubbles])

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
    title: option.id === 'verified-slowdown' ? (locale === 'ja' ? '国際検証つき減速' : 'Verified slowdown') : option.id === 'race-ahead' ? (locale === 'ja' ? '開発競争を続行' : 'Continue the race') : (locale === 'ja' ? '一時減速' : 'Temporary slowdown'),
    summary: option.id === 'verified-slowdown'
      ? (locale === 'ja' ? '短期の速度を抑え、共同監視、透明な基準、複数ラボの追随余地を作る。' : 'Reduce near-term speed and create joint monitoring, transparent standards, and room for multiple labs to follow.')
      : option.id === 'race-ahead'
        ? (locale === 'ja' ? '優位を守るため拡大を続け、安全と統治の差を受け入れる。' : 'Keep scaling to defend the lead and accept widening safety and governance gaps.')
        : (locale === 'ja' ? '国際検証なしで急拡大を止め、社内の安全を補強する。' : 'Stop rapid scaling without international verification and reinforce internal safety.'),
    consequence: option.id === 'verified-slowdown'
      ? (locale === 'ja' ? '信頼、安全、統治、健全な競争が改善。短期成長は鈍化。' : 'Trust, safety, governance, and healthy competition improve; near-term growth slows.')
      : option.id === 'race-ahead'
        ? (locale === 'ja' ? '能力と成長が急伸し、制御の差も拡大。' : 'Capability and growth surge while control gaps widen.')
        : (locale === 'ja' ? '社内対策は改善するが、競合は停止を検証できない。' : 'Internal controls improve, but rivals cannot verify the pause.'),
  })) as unknown as ScenarioDecisionOptions

  const decisionOptions2035 = scenario2035.decision!.options.map((option) => ({
    id: option.id,
    title: option.id === 'hold-the-line' ? (locale === 'ja' ? '上限を守る' : 'Hold the capability ceiling') : (locale === 'ja' ? '再加速' : 'Accelerate again'),
    summary: option.id === 'hold-the-line'
      ? (locale === 'ja' ? '評価、国際検証、公共制度が整うまで能力上限を維持する。' : 'Maintain the capability ceiling until evaluations, international verification, and public institutions are ready.')
      : (locale === 'ja' ? '大規模な安全性の実証前に、競争圧力へ能力強化で応じる。' : 'Answer competitive pressure with stronger capabilities before safety is proven at scale.'),
    consequence: option.id === 'hold-the-line'
      ? (locale === 'ja' ? '制御された停止で人間の主体性とPlan Aを守る。' : 'A controlled pause protects human agency and Plan A.')
      : (locale === 'ja' ? '安全性の実証前に成長を再開し、競争路線へ戻る。' : 'Growth resumes before safety is proven, returning to the race path.'),
  })) as unknown as ScenarioDecisionOptions

  const divergences = useMemo<DecisionDivergences>(() => [
    {
      year: '2026',
      decision: locale === 'ja' ? '公共アクセス' : 'Public access',
      referenceScenario: locale === 'ja' ? 'コーディングエージェントが企業と研究に普及。' : 'Coding agents spread through companies and research.',
      yourTimeline: state.flags.includes('feature:education') ? (locale === 'ja' ? '教育モードで学校を主要なアクセス経路にした。' : 'Education mode made schools a primary access route.') : (locale === 'ja' ? '製品アクセスは商業主導のまま。' : 'Product access remained commercially led.'),
      whyItMattered: locale === 'ja' ? '誰が使えるかで、便益と統治責任が変わる。' : 'Who gets access changes both the benefits and the responsibility to govern them.',
    },
    {
      year: '2029',
      decision: locale === 'ja' ? '競争か減速か' : 'Race or slow down',
      referenceScenario: locale === 'ja' ? 'Plan Aは透明で国際検証可能な減速を採用。' : 'Plan A uses a transparent, internationally verifiable slowdown.',
      yourTimeline: state.choice2029 === null
        ? (locale === 'ja' ? '到達前に終了。' : 'The timeline ended before this decision.')
        : state.choice2029 === 'verified-slowdown'
          ? (locale === 'ja' ? '検証可能な協調を選択。' : 'You chose verifiable coordination.')
          : state.choice2029 === 'slowdown'
            ? (locale === 'ja' ? '共同検証なしで社内停止。' : 'You paused internally without joint verification.')
            : (locale === 'ja' ? '能力競争を続行。' : 'You continued the capability race.'),
      whyItMattered: locale === 'ja' ? '停止は、競合も検証し信頼できて初めて安全を生む。' : 'A pause creates safety only when competitors can verify and trust it.',
    },
    {
      year: '2035',
      decision: locale === 'ja' ? '上限を守る' : 'Hold the ceiling',
      referenceScenario: locale === 'ja' ? '安全性の実証が整うまで、最高水準の人間相当で停止。' : 'Pause at the best-human capability level until safety is demonstrated.',
      yourTimeline: state.choice2035 === null
        ? (locale === 'ja' ? '到達前に終了。' : 'The timeline ended before this decision.')
        : state.choice2035 === 'hold-the-line'
          ? (locale === 'ja' ? '意図した能力上限を維持。' : 'You maintained the intended capability ceiling.')
          : (locale === 'ja' ? '競争圧力の中で再加速。' : 'You accelerated again under competitive pressure.'),
      whyItMattered: locale === 'ja' ? '人間の制御を短期的優位より優先できるかを問う選択。' : 'This choice tests whether human control can outrank short-term advantage.',
    },
  ], [locale, state.choice2029, state.choice2035, state.flags])

  const resetProgress = state.resetCooldownSeconds > 0
    ? 1 - state.resetCooldownSeconds / constants.resetCooldownSeconds
    : 1
  const timelineProgress = clamp(state.day / END_DAY * 100)
  const latestNews = state.news[0]
  const majorNews = state.news.filter((item) => item.kind !== 'rival-strategy')
  const rivalNews = state.news.filter((item) => item.kind === 'rival-strategy')
  const visibleNews = newsFilter === 'major' ? majorNews : newsFilter === 'rivals' ? rivalNews : state.news
  const tutorial = tutorialStep === null ? null : STANDARD_TUTORIAL_STEPS[tutorialStep]
  const isCrisisBrief = Boolean(criticalNews && isCrisisHeadline(criticalNews.headline))
  const isExtinctionBrief = Boolean(criticalNews && /EXTINCTION(?: RISK)?/i.test(criticalNews.headline))
  const simulationStatus = showStartScreen
    ? (locale === 'ja' ? '待機中 · ミッション開始待ち' : 'Standby · awaiting mission start')
    : tutorial
      ? (locale === 'ja' ? '停止中 · チュートリアル' : 'Paused · tutorial')
    : decisionKind
      ? (locale === 'ja' ? '停止中 · 決定が必要' : 'Paused · decision required')
      : state.pendingWorldEvent
        ? `${locale === 'ja' ? '停止中' : 'Paused'} · ${localizeStandard(locale, STANDARD_EVENT_CATEGORY_LABELS[state.pendingWorldEvent.category])}`
      : criticalNews
      ? `${locale === 'ja' ? '停止中' : 'Paused'} · ${isCrisisBrief ? (locale === 'ja' ? '重大イベント' : 'Critical event') : (locale === 'ja' ? '世界情勢' : 'World update')}`
      : upgradeOpen
        ? (locale === 'ja' ? '停止中 · 戦略確認' : 'Paused · strategy review')
        : paused
          ? (locale === 'ja' ? '停止中 · プレイヤー操作' : 'Paused · player control')
          : `${locale === 'ja' ? '進行中' : 'Running'} · ${state.speed === 8 ? c('fast') : c('normal')} · ${state.momentumDays > 0 ? `${locale === 'ja' ? '勢い' : 'Momentum'} ${state.momentumDays}${locale === 'ja' ? '日' : 'd'}` : (locale === 'ja' ? '勢い停止' : 'Momentum stalled')}`
  const criticalCause = criticalNews
    ? /EXTINCTION(?: RISK)?/i.test(criticalNews.headline)
      ? (locale === 'ja' ? `モデル能力が安全能力を上回る状態が続き、人類絶滅リスクが${extinctionRiskPct}%に達しました。安全投資で能力差を縮めるとリスクは低下します。` : `Model capability has remained above safety capability, raising extinction risk to ${extinctionRiskPct}%. Safety investment that closes the gap reduces the risk.`)
      : /SAFETY|ALIGNMENT/i.test(criticalNews.headline)
      ? (locale === 'ja' ? `能力が安全を上回っています。現在の差: ${m.safetyGap.toFixed(1)}。` : `Capability is outpacing safety. Current gap: ${m.safetyGap.toFixed(1)}.`)
      : /REGULATORY/i.test(criticalNews.headline)
        ? (locale === 'ja' ? `統治不足または市場集中が規制対応を招きました。HHI: ${m.hhi.toFixed(2)}。` : `Weak governance or market concentration triggered a regulatory response. HHI: ${m.hhi.toFixed(2)}.`)
        : /BUILD WEEK/i.test(criticalNews.headline)
          ? (locale === 'ja' ? 'コミュニティの節目が注目を集め、新たな行動機会を生みました。' : 'A community milestone drew attention and created a new opportunity to act.')
          : /AGENTS REACH/i.test(criticalNews.headline)
            ? (locale === 'ja' ? 'AI 2027の競争圧力が加速。制御能力をモデル能力に追いつかせる必要があります。' : 'AI 2027 race pressure is accelerating. Control capacity must catch up with model capability.')
            : criticalNews.source === 'Live GM'
          ? (locale === 'ja' ? '検証済みのGMイベントが競争環境を変えました。' : 'A verified GM event changed the competitive environment.')
          : (locale === 'ja' ? '参照シナリオの節目が世界の状態を変えました。' : 'A reference-scenario milestone changed the state of the world.')
    : ''

  return (
    <main className={`command-shell${state.resetBoostSeconds > 0 ? ' is-boosting' : ''}`}>
      <div className="command-shell__grain" aria-hidden="true" />
      <aside className="mobile-orientation-hint" role="status">
        <Phone size={26} aria-hidden="true" />
        <strong>{c('rotateTitle')}</strong>
        <span>{c('rotateBody')}</span>
      </aside>

      <header className="command-header">
        <div className="command-brand">
          <span className="command-brand__mark"><Bot size={20} /></span>
          <span><b>CODEX <i>//</i> 2040</b><small>{c('simulator')}</small></span>
        </div>
        <div className="command-header__center">
          <button className="tutorial-launcher" onClick={beginWithTutorial} aria-expanded={tutorialStep !== null}>{c('howToPlay')}</button>
          <button className="new-game-launcher" type="button" disabled={showStartScreen} onClick={() => { setRestartConfirmOpen(true); playSound('tap') }}><RotateCcw size={11} /> {c('newGame')}</button>
        </div>
        <div className="simulation-clock">
          <div className="simulation-clock__actions">
            <button className="voice-call-launcher" onClick={() => { setVoiceOpen(true); playSound('tap') }} aria-expanded={voiceOpen}><Phone size={13} /> {c('voiceOperator')}</button>
            <button
              className="sound-toggle"
              type="button"
              aria-label={c('soundPlay')}
              aria-pressed={soundEnabled}
              title={soundEnabled ? c('soundMute') : c('soundEnable')}
              onClick={() => {
                const enabled = !soundEnabled
                setSoundEnabled(enabled)
                audioRef.current?.setEnabled(enabled)
                if (enabled) audioRef.current?.play('tap')
              }}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />} {soundEnabled ? c('soundOn') : c('soundOff')}
            </button>
            <button
              className="sound-toggle music-toggle"
              type="button"
              aria-label="BGM playback"
              aria-pressed={musicEnabled}
              title={musicEnabled ? (locale === 'ja' ? 'BGMをオフ' : 'Disable BGM') : (locale === 'ja' ? 'BGMをオン' : 'Enable BGM')}
              onClick={() => {
                const enabled = !musicEnabled
                setMusicEnabled(enabled)
                if (enabled) void musicRef.current?.play().catch(() => setMusicPlaying(false))
                else musicRef.current?.pause()
              }}
            >
              <Music2 size={13} /> BGM {musicEnabled && musicPlaying ? c('bgmOn') : musicEnabled ? c('bgmStandby') : c('bgmOff')}
            </button>
          </div>
          <span><i /> {c('deterministicEngine')}</span>
          <strong>{date}</strong>
        </div>
      </header>

      <section className="intel-strip" aria-label={c('latestScenarioIntel')}>
        <div className="intel-strip__label"><Radio size={13} /> {c('scenarioIntel')}</div>
        {latestNews && <div className="intel-strip__headline"><SourceBadge locale={locale} source={latestNews.source} /><OverflowTicker className="intel-strip__ticker" text={localizeStandardNewsHeadline(locale, latestNews)} /></div>}
        <div className="source-key" aria-label={c('sources')}>
          {(['AI 2027', 'AI 2040', 'Your Timeline'] as SourceLabel[]).map((source) => <SourceBadge locale={locale} source={source} key={source} />)}
        </div>
      </section>

      <section className="command-grid">
        <section className="world-stage">
          <div className="world-stage__header">
            <span><small>{c('operationsMap')}</small><b>{competitiveMapView ? `${competitiveMapView.label} ${locale === 'ja' ? '地域分析' : 'regional analysis'}` : c('worldAccessNetwork')}</b></span>
            <span className="world-stage__status"><i /> {simulationStatus}</span>
          </div>
          <div className="world-stage__map">
            <WorldMap
              locale={locale}
              regions={mapRegions}
              selectedRegion={selectedRegionId}
              onRegionClick={(regionId) => { setSelectedRegionId(regionId); playSound('tap') }}
              onClearSelection={() => { setSelectedRegionId(null); playSound('tap') }}
              eventMarkers={mapMarkers}
              competitiveView={competitiveMapView}
              resetPulse={resetPulse}
              rewardBubbles={mapRewardBubbles}
              onRewardBubbleClick={collectBubble}
              ariaLabel={locale === 'ja' ? '世界のAI利用と教育ネットワークの操作マップ' : 'Interactive map of global AI use and education networks'}
            />
            {(showStartScreen || restartConfirmOpen || tutorial || state.pendingWorldEvent || (criticalNews && !decisionKind && !state.terminal)) && <div className="game-modal-shield" aria-hidden="true" />}
            {showStartScreen && (
              <section className="start-brief" role="dialog" aria-modal="true" aria-labelledby="start-brief-title">
                <span className="start-brief__eyebrow">YOUR ROLE // 2026</span>
                <h1 id="start-brief-title">{c('startTitle')}</h1>
                <p>{c('startBody')}</p>
                <div className="start-brief__sources"><SourceBadge locale={locale} source="AI 2027" /><SourceBadge locale={locale} source="AI 2040" /><SourceBadge locale={locale} source="Your Timeline" /></div>
                <footer>
                  <button autoFocus onClick={beginWithTutorial}>{c('startTutorial')} <ChevronRight size={14} /></button>
                  <button onClick={beginWithoutTutorial}>{c('skipTutorial')}</button>
                </footer>
                <small>{c('autoSave')}</small>
              </section>
            )}
            {restartConfirmOpen && !showStartScreen && (
              <section className="restart-confirm" role="dialog" aria-modal="true" aria-labelledby="restart-confirm-title">
                <span>{c('newTimeline')}</span>
                <h2 id="restart-confirm-title">{c('restartTitle')}</h2>
                <p>{c('restartBody')}</p>
                <footer>
                  <button autoFocus onClick={() => { setRestartConfirmOpen(false); playSound('tap') }}>{c('continue')}</button>
                  <button onClick={resetGameToStart}>{c('eraseStart')}</button>
                </footer>
              </section>
            )}
            {tutorial && (
              <section className="tutorial-brief" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
                <header><span>{localizeStandard(locale, tutorial.eyebrow)}</span><span><b>{tutorialStep! + 1} / {STANDARD_TUTORIAL_STEPS.length}</b><button onClick={finishTutorial}>{hasStarted ? c('closeResume') : c('skipTutorial')}</button></span></header>
                <div className="tutorial-progress" aria-hidden="true">{STANDARD_TUTORIAL_STEPS.map((_, index) => <i key={index} className={index <= tutorialStep! ? 'is-active' : ''} />)}</div>
                <h2 id="tutorial-title">{localizeStandard(locale, tutorial.title)}</h2>
                <p>{localizeStandard(locale, tutorial.body)}</p>
                <aside>{hasStarted && tutorialStep === 0 ? c('pausedGuide') : localizeStandard(locale, tutorial.cue)}</aside>
                <footer>
                  <button disabled={tutorialStep === 0} onClick={() => { setTutorialStep((step) => step === null ? 0 : Math.max(0, step - 1)); playSound('tap') }}>{c('back')}</button>
                  <button autoFocus onClick={() => { if (tutorialStep === STANDARD_TUTORIAL_STEPS.length - 1) finishTutorial(); else { setTutorialStep((step) => step === null ? 0 : step + 1); playSound('tap') } }}>{tutorialStep === STANDARD_TUTORIAL_STEPS.length - 1 ? (hasStarted ? c('resume') : c('start')) : c('next')}</button>
                </footer>
              </section>
            )}
            {worldEventPopup && tutorialStep === null && !decisionKind && !state.terminal && (
              <WorldEventPopup
                locale={locale}
                notice={worldEventPopup}
                onAcknowledge={() => {
                  const next = acknowledgeWorldEvent(stateRef.current)
                  stateRef.current = next
                  setState(next)
                  playSound('confirm')
                }}
                advisorCopy={locale === 'ja' ? '守りたいもの、活かしたい機会をCodex 2040アドバイザーに伝えてください。実行可能な行動へ整理し、操作はあなたが行います。' : 'Tell the Codex 2040 advisor what you want to protect and which opportunity matters. It will organize actionable options; you remain in control.'}
              />
            )}
            {criticalNews && !decisionKind && tutorialStep === null && !state.terminal && (
              <section className="critical-brief" data-crisis={isCrisisBrief} role="dialog" aria-modal="true" aria-labelledby="critical-brief-title">
                <header><SourceBadge locale={locale} source={criticalNews.source} /><time>{criticalNews.date}</time><span>{isCrisisBrief ? (locale === 'ja' ? '重大情報' : 'CRITICAL INTEL') : (locale === 'ja' ? '世界情勢' : 'WORLD UPDATE')} · {locale === 'ja' ? '時間停止中' : 'TIME PAUSED'}</span></header>
                <h2 id="critical-brief-title">{localizeStandardNewsHeadline(locale, criticalNews)}</h2>
                <p>{criticalCause}</p>
                <dl>
                  <div><dt>{isExtinctionBrief ? c('extinctionRisk') : isCrisisBrief ? c('socialTrust') : (locale === 'ja' ? '信頼見通し' : 'Trust outlook')}</dt><dd>{isExtinctionBrief ? `${extinctionRiskPct}% · ${c('instantGameOver')}` : `${state.trust.toFixed(0)} → ${c('trustTarget')} ${trustCausality.target.toFixed(0)}`}</dd></div>
                  <div><dt>{locale === 'ja' ? '最大リスク' : 'TOP RISK'}</dt><dd>{riskRadar.primary.label} · {riskRadar.pressure}%</dd></div>
                </dl>
                <button autoFocus onClick={() => { setCriticalNews(null); playSound('tap') }}>{locale === 'ja' ? `確認して${state.speed === 8 ? '高速' : '通常'}再開` : `Acknowledge and resume at ${state.speed === 8 ? 'fast' : 'normal'} speed`}</button>
              </section>
            )}
            {selectedRegion && selectedRegionId && <div className="region-inspector">
              <span>{c('selectedRegion')}</span>
              <h2>{localizeStandard(locale, STANDARD_REGION_LABELS[selectedRegion.id])}</h2>
              <dl>
                <div><dt>{locale === 'ja' ? 'AIアクセス' : 'AI access'}</dt><dd>{pct(selectedRegion.users / selectedRegion.population)}</dd></div>
                <div><dt>{competitiveMapView ? `${competitiveMapView.label} ${locale === 'ja' ? '推定シェア' : 'estimated share'}` : 'CODEX share'}</dt><dd>{pct(competitiveMapView?.shares[selectedRegionId] ?? selectedRegion.codexShare)}</dd></div>
                <div><dt>{c('regulation')}</dt><dd>{pct(selectedRegion.regulation)}</dd></div>
              </dl>
              <div className="region-inspector__cost" data-affordable={state.compute >= 45}>
                <span>{c('requiredResources')}</span>
                <strong>45 PF</strong>
                <small>{state.compute >= 45
                  ? `${locale === 'ja' ? '実行後' : 'After action'} ${fmt(state.compute - 45, 1, locale)} PF`
                  : `${locale === 'ja' ? '不足 · あと' : 'Short · need'} ${fmt(45 - state.compute, 1, locale)} PF`}</small>
              </div>
              <button
                onClick={deployRegion}
                disabled={state.compute < 45}
                title={state.compute < 45 ? (locale === 'ja' ? `計算資源があと${fmt(45 - state.compute, 1, locale)} PF必要です` : `Need ${fmt(45 - state.compute, 1, locale)} more PF`) : undefined}
              >
                {selectedRegion.introduced ? c('startCommunity') : c('startOutpost')}<span>45 PF</span><ChevronRight size={14} />
              </button>
            </div>}
          </div>
          <div className="timeline-track">
            <span>2026</span><div><i style={{ width: `${timelineProgress}%` }} /><b style={{ left: `${timelineProgress}%` }} /></div><span>2040</span>
          </div>
        </section>

        <aside className="strategy-rail">
          <div className="section-label"><Cpu size={13} /> {c('strategy')}</div>
          <div className="compute-counter" data-testid="compute-budget">
            <span>{c('computeBudget')}</span>
            <strong>{fmt(state.compute, 1, locale)} <small>PF</small></strong>
            <small className="compute-counter__currency">{c('computeCurrency')}</small>
            <div className="compute-flow" aria-label={locale === 'ja' ? '1日あたりの計算予算収支' : 'Daily compute budget flow'}>
              <span><small>{c('income')}</small><b>+{fmt(economy.income, 1, locale)}</b></span>
              <span><small>{c('runningCost')}</small><b>−{fmt(economy.runningCost, 1, locale)}</b></span>
              <span data-negative={economy.net < 0}><small>{c('net')}</small><b>{economy.net >= 0 ? '+' : ''}{fmt(economy.net, 1, locale)}/{locale === 'ja' ? '日' : 'day'}</b></span>
            </div>
            <small className={state.momentumDays > 0 ? 'is-active' : 'is-stalled'}><OverflowTicker text={state.momentumDays > 0 ? (locale === 'ja' ? `勢いあり · あと${state.momentumDays}日` : `Momentum active · ${state.momentumDays}d remaining`) : (locale === 'ja' ? '勢い停止 · 行動して成長を再開' : 'Momentum stalled · take action to restart growth')} /></small>
            {state.compute < 45 && !state.flags.includes('lifeline:used') && (
              <button
                className="compute-lifeline"
                data-testid="compute-recovery"
                aria-label={locale === 'ja' ? `1回限りの緊急計算協定を実行、${constants.lifelineCompute} PFを獲得、信頼マイナス8、導入地域のCODEXシェアを0.9倍` : `Use the one-time emergency compute compact: gain ${constants.lifelineCompute} PF, lose 8 trust, and multiply CODEX share in launched regions by 0.9`}
                onClick={activateComputeLifeline}
              >
                <span><b>{locale === 'ja' ? '緊急計算協定 · 1回限り' : 'EMERGENCY COMPUTE COMPACT · ONE USE'}</b><small>+{constants.lifelineCompute} PF / {locale === 'ja' ? '信頼' : 'trust'} −8 / {locale === 'ja' ? '地域シェア' : 'regional share'} ×0.90</small></span>
                <ChevronRight size={13} />
              </button>
            )}
            {state.compute < 45 && state.flags.includes('lifeline:used') && <small className="compute-lifeline__used">{locale === 'ja' ? '緊急計算協定は使用済み' : 'Emergency compute compact already used'}</small>}
          </div>
          <button className="strategy-axis" onClick={() => openStrategy('model')}>
            <span><BrainCircuit size={16} /><b>{c('model')}</b><small>{c('capability')}</small></span><strong>K{state.capability.toFixed(1)}</strong><ChevronRight size={14} />
          </button>
          <button className="strategy-axis" onClick={() => openStrategy('product')}>
            <span><Sparkles size={16} /><b>{c('product')}</b><small>{c('features')} {enabledFeatures.length}</small></span><strong>{c('access')}</strong><ChevronRight size={14} />
          </button>
          <button className="strategy-axis" onClick={() => openStrategy('company')}>
            <span><ShieldCheck size={16} /><b>{c('company')}</b><small>{c('controlCapacity')}</small></span><strong>S{state.safety.toFixed(0)} / G{state.governance.toFixed(0)}</strong><ChevronRight size={14} />
          </button>

          <div className="control-envelope">
            <div className="section-label section-label--sub"><ShieldCheck size={13} /> {c('controlBalance')}</div>
            <Meter label={c('capability')} value={state.capability} max={10} />
            <Meter label={c('safety')} value={state.safety} max={10} danger={m.safetyGap >= 3} hint={m.safetyGap > 0 ? `${locale === 'ja' ? '能力差' : 'Capability gap'} +${m.safetyGap.toFixed(1)}` : (locale === 'ja' ? '能力と同等' : 'Matches capability')} />
            <Meter label={c('governance')} value={state.governance} max={10} danger={m.governanceGap >= 3} hint={m.governanceGap > 0 ? `${locale === 'ja' ? '能力差' : 'Capability gap'} +${m.governanceGap.toFixed(1)}` : (locale === 'ja' ? '能力と同等' : 'Matches capability')} />
          </div>

          <button className="open-ecosystem" onClick={() => openStrategy('ecosystem')}>
            <Network size={17} /><span><b>{c('ecosystemStrategy')}</b><small>{c('ecosystemHelp')}</small></span><ArrowUpRight size={14} />
          </button>
          <button className="open-strategy" onClick={() => openStrategy('model')}>{c('openStrategy')} <ChevronRight size={14} /></button>

          <div className="event-ledger">
            <div className="section-label section-label--sub"><Radio size={13} /> {c('eventHistory')}</div>
            <div className="event-ledger__filters" role="group" aria-label={c('eventHistory')}>
              <button type="button" aria-pressed={newsFilter === 'major'} onClick={() => setNewsFilter('major')}>{c('major')} <span>{majorNews.length}</span></button>
              <button type="button" aria-pressed={newsFilter === 'rivals'} onClick={() => setNewsFilter('rivals')}>{c('rivals')} <span>{rivalNews.length}</span></button>
              <button type="button" aria-pressed={newsFilter === 'all'} onClick={() => setNewsFilter('all')}>{c('all')} <span>{state.news.length}</span></button>
            </div>
            <div className="event-ledger__list">
            {visibleNews.map((item) => (
              <article key={item.id}><SourceBadge locale={locale} source={item.source} href={getEventSourceUrl(item.source, item.date)} /><time>{item.date}</time><b><OverflowTicker text={localizeStandardNewsHeadline(locale, item)} /></b></article>
            ))}
            {visibleNews.length === 0 && <p className="event-ledger__empty">{c('noNews')}</p>}
            </div>
          </div>
        </aside>
      </section>

      <section ref={lowerCommandRef} className={`lower-command-zone${actionNudge ? ' is-onboarding-target' : ''}`}>
        <section className="telemetry-deck" aria-label={c('worldTelemetry')}>
          <header className="telemetry-deck__header"><Activity size={13} /><span><b>{c('worldTelemetry')}</b><small>{c('telemetrySummary')}</small></span></header>

          <article className="telemetry-card telemetry-card--reach">
            <header><span>{c('codexUsers')}</span><small>{c('reach')}</small></header>
            <strong>{fmt(m.codexUsers * 1_000_000, 0, locale)}</strong>
            <div className="telemetry-card__split"><span><small>{c('aiUserShare')}</small><b>{pct(m.codexShare)}</b></span><span><small>{c('worldAccess')}</small><b>{pct(m.worldAdoption)}</b></span></div>
          </article>

          <article className="telemetry-card telemetry-card--mission" aria-label={c('abundanceScore')} data-testid="abundance-score">
            <header><span>{c('abundanceScore')}</span><small>{c('total')}</small></header>
            <strong>{Math.round(score.score * 100)} <i>/ 100 · {score.rank}</i></strong>
            <div className="mission-breakdown" aria-label={locale === 'ja' ? 'アバンダンススコアの内訳' : 'Abundance score breakdown'}>
              <span><small>{c('access')}</small><b>{Math.round(score.access * 100)}</b></span>
              <span><small>{c('regions')}</small><b>{Math.round(score.coverage * 100)}</b></span>
              <span><small>{c('competition')}</small><b>{Math.round(score.competition * 100)}</b></span>
              <span><small>{c('safety')}</small><b>{Math.round(score.safety * 100)}</b></span>
            </div>
          </article>

          <article className="telemetry-card telemetry-card--trust" data-danger={state.trust < 45}>
            <header><span>{c('socialTrust')}</span><strong>{state.trust.toFixed(0)}</strong></header>
            <div className="telemetry-card__bar" aria-hidden="true"><i style={{ width: `${clamp(state.trust)}%` }} /></div>
            <div className="trust-causality" aria-label={locale === 'ja' ? '社会的信頼の要因' : 'Social trust factors'}>
              <div><span>{c('trustTarget')} {trustCausality.target.toFixed(0)}</span><strong className={trustCausality.dailyDelta < 0 ? 'is-negative' : 'is-positive'}>{trustCausality.dailyDelta >= 0 ? '+' : ''}{trustCausality.dailyDelta.toFixed(2)}/{locale === 'ja' ? '日' : 'day'}</strong></div>
              {trustFactors.map((factor) => <p key={factor.id} className={factor.value < 0 ? 'is-negative' : 'is-positive'}><span>{localizeStandard(locale, STANDARD_TRUST_FACTOR_LABELS[factor.id])}</span><b>{factor.value >= 0 ? '+' : ''}{factor.value.toFixed(0)}</b></p>)}
            </div>
          </article>

          <article className="telemetry-card telemetry-card--pressure" data-danger={extinctionRiskPct >= 50} data-testid="extinction-risk">
            <header><span>{c('extinctionRisk')}</span><strong>{extinctionRiskPct}%</strong></header>
            <div
              className="telemetry-card__bar"
              role="progressbar"
              aria-label={c('extinctionRisk')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={extinctionRiskPct}
              aria-valuetext={`${extinctionRiskPct}% · ${c('instantGameOver')}`}
            ><i style={{ width: `${extinctionRiskPct}%` }} /></div>
            <div className="extinction-readout">
              <b>{c('instantGameOver')}</b>
              <span data-danger={extinctionRiskRising}>{extinctionRiskRising ? `${locale === 'ja' ? '上昇中' : 'Rising'} · ${formatExtinctionRiskRate(extinctionRiskDelta, constants.misalignmentThresholdDays, locale)}` : extinctionRiskPct > 0 ? `${locale === 'ja' ? '回復中' : 'Recovering'} · ${formatExtinctionRiskRate(extinctionRiskDelta, constants.misalignmentThresholdDays, locale)}` : (locale === 'ja' ? '安定 · 能力と安全が均衡' : 'Stable · capability and safety are balanced')}</span>
              <small>{c('dangerDays')} {state.safetyGapDays} / {constants.misalignmentThresholdDays}</small>
            </div>
          </article>

          <article className="telemetry-card telemetry-card--market" data-danger={m.hhi > .6}>
            <header><span>{c('marketHealth')}</span><strong>{Math.round((1 - m.hhi) * 100)}</strong><small>HHI {m.hhi.toFixed(2)}</small></header>
            <div className="telemetry-card__bar" aria-hidden="true"><i style={{ width: `${(1 - m.hhi) * 100}%` }} /></div>
            <div className="market-list" aria-label={c('competitionEnvironment')}>
              <button
                type="button"
                className={`is-codex${selectedCompetitor === null ? ' is-selected' : ''}`}
                aria-pressed={selectedCompetitor === null}
                aria-label={locale === 'ja' ? 'CODEXを選択して通常の世界地図に戻る' : 'Select CODEX and return to the standard world map'}
                onPointerEnter={() => setPreviewCompetitor('codex')}
                onPointerLeave={() => setPreviewCompetitor(null)}
                onFocus={() => setPreviewCompetitor('codex')}
                onBlur={() => setPreviewCompetitor(null)}
                onClick={() => { setSelectedCompetitor(null); playSound('tap') }}
              >
                <i /><b>CODEX<small>K{state.capability.toFixed(1)} · P{productStrategyLevel(state).toFixed(1)} · C{((state.safety + state.governance) / 2).toFixed(1)}</small></b><strong>{pct(m.codexShare)}</strong><ChevronRight size={11} />
              </button>
              {RIVAL_NAMES.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  className={selectedCompetitor === index ? 'is-selected' : ''}
                  aria-pressed={selectedCompetitor === index}
                  onPointerEnter={() => setPreviewCompetitor(index)}
                  onPointerLeave={() => setPreviewCompetitor(null)}
                  onFocus={() => setPreviewCompetitor(index)}
                  onBlur={() => setPreviewCompetitor(null)}
                  onClick={() => { setSelectedCompetitor((selected) => selected === index ? null : index); playSound('tap') }}
                >
                  <i /><b>{name}<small>K{state.rivalCapability[index].toFixed(1)} · P{state.rivalProduct[index].toFixed(1)} · C{state.rivalCompany[index].toFixed(1)}</small></b><strong>{pct(state.rivalShares[index])}</strong><ChevronRight size={11} />
                </button>
              ))}
            </div>
            {previewCompetitor !== null && (() => {
              const index = typeof previewCompetitor === 'number' ? previewCompetitor : null
              const isCodex = index === null
              const name = index === null ? 'CODEX' : RIVAL_NAMES[index]
              const share = index === null ? m.codexShare : state.rivalShares[index]
              const axes = index === null
                ? [state.capability, productStrategyLevel(state), (state.safety + state.governance) / 2]
                : [state.rivalCapability[index], state.rivalProduct[index], state.rivalCompany[index]]
              const shareDelta = share - m.codexShare
              const rivalPortfolio = index === null ? null : state.rivalStrategies?.[index]
              const latestRivalNode = rivalPortfolio?.lastNodeId ? getStrategyNode(rivalPortfolio.lastNodeId) : null
              return (
                <section className="market-popover" role="status" aria-label={locale === 'ja' ? `${name}の市場情報` : `${name} market intelligence`}>
                  <header><span>{name}</span><strong className={shareDelta > 0 ? 'is-leading' : ''}>{isCodex ? (locale === 'ja' ? '基準' : 'BASELINE') : `${shareDelta >= 0 ? '+' : ''}${Math.round(shareDelta * 100)}${locale === 'ja' ? '点 対CODEX' : 'pt vs CODEX'}`}</strong></header>
                  <dl>
                    <div><dt>{locale === 'ja' ? 'シェア' : 'SHARE'}</dt><dd>{pct(share)}</dd></div>
                    <div><dt>{c('model')}</dt><dd>{axes[0].toFixed(1)}</dd></div>
                    <div><dt>{c('product')}</dt><dd>{axes[1].toFixed(1)}</dd></div>
                    <div><dt>{c('company')}</dt><dd>{axes[2].toFixed(1)}</dd></div>
                  </dl>
                  {!isCodex && rivalPortfolio && (
                    <p className="market-popover__strategy">
                      <span>{locale === 'ja' ? '最新戦略' : 'LATEST STRATEGY'}</span>
                      <b>{latestRivalNode?.title[locale] ?? (locale === 'ja' ? '投資準備中' : 'Preparing investment')}</b>
                      <em>{locale === 'ja' ? `${rivalPortfolio.acquiredNodes.length}ノード取得` : `${rivalPortfolio.acquiredNodes.length} nodes acquired`}</em>
                    </p>
                  )}
                  <small>{isCodex ? (locale === 'ja' ? 'クリックで通常地図へ戻る' : 'Click to return to the standard map') : (locale === 'ja' ? 'クリックで都市別の利用者分布を表示' : 'Click to show user distribution by city')}</small>
                </section>
              )
            })()}
          </article>
        </section>

        <section className="command-utilities" aria-label={locale === 'ja' ? 'コマンドユーティリティ' : 'Command utilities'}>
          <button
            className="reset-action"
            disabled={state.resetCooldownSeconds > 0}
            onClick={activateReset}
            style={{ '--reset-progress': `${resetProgress * 360}deg` } as CSSProperties}
          >
            <span className="reset-action__ring"><RotateCcw size={20} /></span>
            <span><small>{locale === 'ja' ? 'TIBOプロトコル · 世界強化 8秒' : 'TIBO PROTOCOL · 8-SECOND GLOBAL BOOST'}</small><b>{state.resetCooldownSeconds > 0 ? (locale === 'ja' ? `トークンリセット · あと${Math.ceil(state.resetCooldownSeconds)}秒` : `TOKEN RESET · ${Math.ceil(state.resetCooldownSeconds)}s remaining`) : (locale === 'ja' ? 'トークンリセット準備完了' : 'TOKEN RESET READY')}</b></span>
          </button>

          <div className="time-controls">
            <button aria-pressed={paused} className="pause-button" onClick={() => { setPaused((value) => !value); playSound('time') }}>{paused ? <CirclePlay size={16} /> : <CirclePause size={16} />}{paused ? c('resume') : c('pause')}</button>
            <div className="speed-modes">
              {SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  aria-label={speed === 1 ? (locale === 'ja' ? '通常速度 — 1秒で1日' : 'Normal speed — one day per second') : (locale === 'ja' ? '高速 — 1秒で8日' : 'Fast speed — eight days per second')}
                  aria-pressed={state.speed === speed}
                  className={state.speed === speed ? 'is-active' : ''}
                  onClick={() => setSpeed(speed)}
                >
                  {speed === 1 ? <CirclePlay size={16} /> : <ChevronsRight size={20} />}
                  <span>{speed === 1 ? c('normal') : c('fast')}</span>
                </button>
              ))}
            </div>
            <small className="speed-readout">{state.speed === 8 ? (locale === 'ja' ? '高速 · 1秒で8日' : 'FAST · 8 DAYS PER SECOND') : (locale === 'ja' ? '通常 · 1秒で1日' : 'NORMAL · 1 DAY PER SECOND')} · {state.momentumDays > 0 ? (locale === 'ja' ? `勢い あと${state.momentumDays}日` : `MOMENTUM ${state.momentumDays}D LEFT`) : (locale === 'ja' ? 'アクセス成長停止' : 'ACCESS GROWTH STALLED')}</small>
          </div>
        </section>
      </section>

      <VoiceCallPanel
        locale={locale}
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
        completedNodeIds={acquiredStrategyNodeIds(state)}
        getNodeAvailability={(nodeId) => getStrategyNodeAvailability(state, nodeId)}
        locale={locale}
        onNodeAction={performStrategyNodeAction}
        onAction={performUpgradeAction}
        onClose={() => { setUpgradeOpen(false); playSound('tap') }}
      />

      <ScenarioDecision
        locale={locale}
        open={decisionKind === '2029'}
        milestone="choose-path-2029"
        source={{ label: 'AI 2040 / Plan A', href: scenario2029.sourceUrl ?? AI_2040_URL }}
        title={locale === 'ja' ? '進路を選ぶ' : 'Choose a path'}
        context={locale === 'ja' ? '短い協調機会の中で、競争、一時停止、国際検証つき減速のどれかを選びます。' : 'During a brief coordination window, choose racing, a temporary pause, or verified slowdown.'}
        options={decisionOptions2029}
        selectedOptionId={decisionSelection}
        whyThisMatters={locale === 'ja' ? '得た時間を共有の安全資源にできるか、次の競争までの先延ばしにするかを決めます。' : 'Decide whether time gained becomes shared safety capacity or merely delays the next race.'}
        onSelect={setDecisionSelection}
        onConfirm={confirmDecision}
      />

      <ScenarioDecision
        locale={locale}
        open={decisionKind === '2035'}
        milestone="hold-the-line-2035"
        source={{ label: 'AI 2040 / Plan A', href: scenario2035.sourceUrl ?? AI_2040_URL }}
        title={locale === 'ja' ? '上限を守る' : 'Hold the ceiling'}
        context={locale === 'ja' ? '人間の最高専門家に迫る中、経済・地政学的な拡大圧力が頂点に達します。' : 'As models approach the best human experts, economic and geopolitical pressure to scale peaks.'}
        options={decisionOptions2035}
        selectedOptionId={decisionSelection}
        whyThisMatters={locale === 'ja' ? '人間の制御を短期的な競争優位より優先できるかを試します。' : 'This tests whether human control can take priority over short-term competitive advantage.'}
        onSelect={setDecisionSelection}
        onConfirm={confirmDecision}
      />

      <EndingOverlay
        locale={locale}
        open={state.terminal && endingVisible}
        rank={ending.rank}
        ending={ending.id}
        scoreOutOf100={ending.score * 100}
        completionDate={dateLabel(state.day).toUpperCase()}
        completionStatus={state.day < END_DAY ? 'terminated' : 'complete'}
        summary={localizeStandard(locale, STANDARD_ENDING_CONTEXT[ending.id])}
        referenceSummary={locale === 'ja' ? 'AI 2027は開発競争の圧力を、AI 2040のPlan Aは検証可能な減速、意図的停止、証拠に基づく再始動を示します。' : 'AI 2027 illustrates race pressure; AI 2040 Plan A illustrates verifiable slowdown, deliberate pauses, and evidence-based restart.'}
        timelineSummary={locale === 'ja' ? `シミュレーションは${dateLabel(state.day)}に${state.day < END_DAY ? '終了' : '完了'}。2029年は${state.choice2029 === 'verified-slowdown' ? '国際検証つき減速' : state.choice2029 === 'slowdown' ? '一時減速' : state.choice2029 === 'race' ? '競争続行' : '未到達'}、2035年は${state.choice2035 === 'hold-the-line' ? '上限維持' : state.choice2035 === 'accelerate' ? '再加速' : '未到達'}。最終アクセス ${pct(m.worldAdoption)}、HHI ${m.hhi.toFixed(2)}。` : `The simulation ${state.day < END_DAY ? 'ended' : 'completed'} on ${dateLabel(state.day)}. Final access ${pct(m.worldAdoption)}, HHI ${m.hhi.toFixed(2)}.`}
        divergences={divergences}
        localChoices={{ choice_2029: state.choice2029, choice_2035: state.choice2035 }}
        activePlaySeconds={activePlaySeconds}
        receipt={worldlineReceipt}
        marketShares={[
          { id: 'codex', name: 'CODEX', share: m.codexShare, baseline: INITIAL_CODEX_SHARE },
          ...RIVAL_NAMES.map((name, index) => ({ id: name.toLowerCase(), name, share: state.rivalShares[index], baseline: INITIAL_RIVAL_SHARES[index] })),
        ]}
        onClose={() => setEndingVisible(false)}
        onRestart={resetGameToStart}
      />
    </main>
  )
}
