import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Cpu,
  GraduationCap,
  Network,
  Phone,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import {
  END_DAY,
  SPEEDS,
  START_DATE,
  addFeature,
  advanceRealtime,
  applyGMEvents,
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
  runTicks,
  scoreState,
  triggerReset,
  type Choice2029,
  type Choice2035,
  type EndingId,
  type GameState,
  type RegionId,
  type Speed,
  type Upgrade,
} from './engine'
import {
  advanceHeartbeat,
  createEducationModeResponse,
  createGmRuntimeState,
  enqueueImmediateAction,
  filterPlayerInput,
  GM_CONSTANTS,
  type GmEvent,
  type GmSnapshot,
  type ImmediateAction,
} from './gm'
import { pollGmEvents, postGmAction, postGmHeartbeat } from './gmBridgeClient'
import { AI_2040_URL, getDecisionMilestones, type SourceLabel } from './scenario'
import WorldMap, { type WorldMapMarker, type WorldMapRegionIntensity } from './components/WorldMap'
import UpgradeOverlay, {
  type UpgradeOverlayAction,
  type UpgradeOverlayCosts,
  type UpgradeOverlayFeature,
  type UpgradeOverlayTab,
} from './components/UpgradeOverlay'
import ScenarioDecision, { type ScenarioDecisionOptions } from './components/ScenarioDecision'
import EndingOverlay, { type DecisionDivergences } from './components/EndingOverlay'
import VoiceCallPanel, { type VoiceSubtitle } from './components/VoiceCallPanel'
import { RealtimeVoiceClient, type MicPermissionStatus, type VoiceConnectionStatus } from './voiceAgent'
import {
  createVoiceResetState,
  handleRealtimeResetToolCall,
  requestFallbackReset,
  resolveVoiceReset,
  type VoiceResetState,
} from './voiceReset'

const EDUCATION_PROMPT = '世界中の学校で無料利用できる教育モード'
const dayFor = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - START_DATE) / 86_400_000)
const DECISION_2029_DAY = dayFor('2029-01-01')
const DECISION_2035_DAY = dayFor('2035-01-01')

export type DemoCueId =
  | 'education-local'
  | 'token-reset'
  | 'education-governance'
  | 'rival-response'
  | 'open-2029'
  | 'choose-2029'
  | 'open-2035'
  | 'choose-2035'
  | 'control-investment'
  | 'open-ecosystem'
  | 'resolve-2040'

export type DemoCue = { id: DemoCueId; atSeconds: number; label: string }

export const DEMO_SCHEDULE: readonly DemoCue[] = [
  { id: 'education-local', atSeconds: 4, label: 'Education Mode ships locally' },
  { id: 'token-reset', atSeconds: 8, label: 'Token reset lights the network' },
  { id: 'education-governance', atSeconds: 11, label: 'GM adds access and child-data governance' },
  { id: 'rival-response', atSeconds: 15, label: 'A rival expands the market' },
  { id: 'open-2029', atSeconds: 20, label: '2029 choice opens' },
  { id: 'choose-2029', atSeconds: 24, label: 'Verified slowdown selected' },
  { id: 'open-2035', atSeconds: 32, label: '2035 choice opens' },
  { id: 'choose-2035', atSeconds: 36, label: 'Hold the Line selected' },
  { id: 'control-investment', atSeconds: 41, label: 'Safety and governance catch up' },
  { id: 'open-ecosystem', atSeconds: 46, label: 'Power is released to the ecosystem' },
  { id: 'resolve-2040', atSeconds: 54, label: 'The 2040 ending resolves' },
] as const

export const getDueDemoCues = (elapsedSeconds: number, completed: ReadonlySet<DemoCueId>) =>
  DEMO_SCHEDULE.filter((cue) => cue.atSeconds <= elapsedSeconds && !completed.has(cue.id))

const DEMO_EDUCATION_EVENTS: readonly GmEvent[] = [
  {
    id: 'evt-00000000-0000-4000-8000-000000000203',
    date: '2026-01-01',
    type: 'community_event',
    headline: '地域教育ハブが全地域で始動',
    region: 'global',
    effect: { users_delta_pct: 60, share_delta: -.02, growth_rate_delta: .4, trust_delta: 8, target: 'codex' },
    flavor: '地域運営の教育拠点が、未接続地域にも安全な入口を開く。',
    ttl_days: 30,
  },
  {
    id: 'evt-00000000-0000-4000-8000-000000000204',
    date: '2026-01-01',
    type: 'news',
    headline: '児童データの共同監査基準を採択',
    region: 'global',
    effect: { users_delta_pct: 30, share_delta: 0, growth_rate_delta: .4, trust_delta: 8, target: 'codex' },
    flavor: '学校と規制当局が同意と保存期間の共通監査を始める。',
    ttl_days: 30,
  },
]

const DEMO_RIVAL_EVENTS: readonly GmEvent[] = [
  {
    id: 'evt-00000000-0000-4000-8000-000000000301',
    date: '2026-01-01',
    type: 'rival',
    headline: '競合連合が教育アクセス基金を公開',
    region: 'global',
    effect: { users_delta_pct: 60, share_delta: .2, growth_rate_delta: .4, trust_delta: 8, target: 'rivalQi' },
    flavor: '健全な競争が市場全体の学習アクセスを広げる。',
    ttl_days: 30,
  },
  {
    id: 'evt-00000000-0000-4000-8000-000000000302',
    date: '2026-01-01',
    type: 'community_event',
    headline: '相互運用コミュニティが接続を拡大',
    region: 'global',
    effect: { users_delta_pct: 30, share_delta: .2, growth_rate_delta: .4, trust_delta: 8, target: 'rivalAnthro' },
    flavor: '複数の提供者が地域の選択肢と接続性を同時に増やす。',
    ttl_days: 30,
  },
]

const DEMO_RESTART_EVENT_CYCLES: readonly (readonly GmEvent[])[] = [
  [
    {
      id: 'evt-00000000-0000-4000-8000-000000000501', date: '2039-11-01', type: 'rival', headline: '安全な再始動でアクセスが加速', region: 'global',
      effect: { users_delta_pct: 60, share_delta: -.15, growth_rate_delta: .4, trust_delta: 8, target: 'codex' }, flavor: '検証済みの基盤が複数陣営の安全な成長を支える。', ttl_days: 30,
    },
    {
      id: 'evt-00000000-0000-4000-8000-000000000502', date: '2039-11-01', type: 'community_event', headline: '世界の学習拠点が相互接続', region: 'global',
      effect: { users_delta_pct: 30, share_delta: -.15, growth_rate_delta: .4, trust_delta: 8, target: 'codex' }, flavor: '教育と公共サービスが開かれた標準で接続される。', ttl_days: 30,
    },
  ],
  [
    {
      id: 'evt-00000000-0000-4000-8000-000000000503', date: '2039-12-01', type: 'rival', headline: '複数陣営が安全な接続を共同拡大', region: 'global',
      effect: { users_delta_pct: 60, share_delta: -.15, growth_rate_delta: .4, trust_delta: 8, target: 'codex' }, flavor: '検証済みの相互運用標準が選択肢を保ったままアクセスを広げる。', ttl_days: 30,
    },
    {
      id: 'evt-00000000-0000-4000-8000-000000000504', date: '2039-12-01', type: 'community_event', headline: '地域学習網が最後の接続域へ到達', region: 'global',
      effect: { users_delta_pct: 30, share_delta: -.15, growth_rate_delta: .4, trust_delta: 8, target: 'codex' }, flavor: '地域主導の学習網が公共監査とともに接続格差を縮める。', ttl_days: 30,
    },
  ],
]

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

const initialGame = (demoMode: boolean): GameState => ({
  ...createInitialState({ demoMode }),
  speed: demoMode ? 8 : 5,
})

const createBridgeSnapshot = (state: GameState, playerInbox: readonly string[] = []): GmSnapshot => {
  const current = metrics(state)
  const topRegions = [...state.regions]
    .sort((left, right) => right.users / right.population - left.users / left.population)
    .slice(0, 4)
    .map((region) => region.id)
  return {
    date: dateLabel(state.day),
    A_world: current.worldAdoption,
    S_c: current.codexShare,
    HHI: current.hhi,
    T: state.trust,
    K: state.capability,
    S: state.safety,
    G: state.governance,
    topRegions,
    recentEvents: state.news.slice(0, 8).map((item) => item.headline),
    playerInbox,
  }
}

/** Engine-applied authored events remain visibly distinct from validated live GM output. */
export const applyScriptedEvents = (state: GameState, events: readonly GmEvent[]): GameState => {
  const firstNewId = state.nextNewsId
  const next = applyGMEvents(state, events.map((event) => ({ ...event, date: dateLabel(state.day) })))
  return {
    ...next,
    news: next.news.map((item) => item.id >= firstNewId && item.source === 'Live GM'
      ? { ...item, source: 'Your Timeline' as const }
      : item),
  }
}

export const applyDemoCueToState = (state: GameState, cue: DemoCue): GameState => {
  if (cue.id === 'education-local') return addFeature(state, EDUCATION_PROMPT)
  if (cue.id === 'token-reset') return triggerReset(state)
  if (cue.id === 'education-governance') return applyScriptedEvents(state, DEMO_EDUCATION_EVENTS)
  if (cue.id === 'rival-response') return applyScriptedEvents(state, DEMO_RIVAL_EVENTS)
  if (cue.id === 'open-2029') return state.day < DECISION_2029_DAY ? runTicks(state, DECISION_2029_DAY - state.day) : state
  if (cue.id === 'choose-2029') return { ...choose2029(state, 'verified-slowdown'), speed: 8 }
  if (cue.id === 'open-2035') return state.day < DECISION_2035_DAY ? runTicks(state, DECISION_2035_DAY - state.day) : state
  if (cue.id === 'choose-2035') return { ...choose2035(state, 'hold-the-line'), speed: 8 }
  if (cue.id === 'control-investment') {
    let next = state
    for (let index = 0; index < 8; index += 1) {
      next = buyUpgrade(next, 'safety')
      next = buyUpgrade(next, 'governance')
    }
    return next
  }
  if (cue.id === 'open-ecosystem') {
    const approachDay = END_DAY - 60
    const approached = state.day < approachDay ? runTicks(state, approachDay - state.day) : state
    return { ...openEcosystem(approached), speed: 1 }
  }
  let next = triggerReset(state)
  next = applyScriptedEvents(next, DEMO_RESTART_EVENT_CYCLES[0])
  next = runTicks(next, Math.min(30, Math.max(0, END_DAY - next.day)))
  next = applyScriptedEvents(next, DEMO_RESTART_EVENT_CYCLES[1])
  return runTicks(next, END_DAY - next.day)
}

/** Deterministic evidence path for the authored wall-clock demo, including real-time cooldowns. */
export const replayDemoSchedule = (): GameState => {
  let state = initialGame(true)
  let elapsedSeconds = 0
  for (const cue of DEMO_SCHEDULE) {
    const seconds = Math.max(0, cue.atSeconds - elapsedSeconds)
    for (let second = 0; second < seconds; second += 1) {
      state = advanceRealtime(state, 1)
      const blocked = state.terminal
        || state.day >= DECISION_2029_DAY && !state.choice2029
        || state.day >= DECISION_2035_DAY && !state.choice2035
      if (!blocked) state = runFrame(state)
    }
    state = applyDemoCueToState(state, cue)
    elapsedSeconds = cue.atSeconds
  }
  return state
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
        aria-valuetext={`${value.toFixed(max <= 10 ? 1 : 0)} of ${max}`}
      ><i style={{ width: `${normalized}%` }} /></div>
      {hint && <small>{hint}</small>}
    </div>
  )
}

function SourceBadge({ source }: { source: SourceLabel }) {
  return <span className="source-badge" data-source={source}>{source}</span>
}

export default function App() {
  const [demoMode, setDemoMode] = useState(true)
  const [state, setState] = useState<GameState>(() => initialGame(true))
  const [paused, setPaused] = useState(false)
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId>('eastAsia')
  const [featureText, setFeatureText] = useState('')
  const [featureStatus, setFeatureStatus] = useState('Local effects apply instantly. GM interpretation follows asynchronously.')
  const [resetPulse, setResetPulse] = useState(0)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeTab, setUpgradeTab] = useState<UpgradeOverlayTab>('model')
  const [decisionSelection, setDecisionSelection] = useState<string | null>(null)
  const [endingVisible, setEndingVisible] = useState(true)
  const [heartbeatSeconds, setHeartbeatSeconds] = useState(60)
  const [bridgeMode, setBridgeMode] = useState<'checking' | 'available' | 'unavailable' | 'fallback'>('checking')
  const [educationResponded, setEducationResponded] = useState(false)
  const [demoElapsedSeconds, setDemoElapsedSeconds] = useState(0)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<VoiceConnectionStatus>('idle')
  const [micPermission, setMicPermission] = useState<MicPermissionStatus>('unknown')
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [voiceSubtitles, setVoiceSubtitles] = useState<VoiceSubtitle[]>([])
  const [operatorDraft, setOperatorDraft] = useState('')
  const [voiceResetState, setVoiceResetState] = useState(createVoiceResetState)

  const stateRef = useRef(state)
  const gmRuntimeRef = useRef(createGmRuntimeState(Date.now()))
  const pendingTimersRef = useRef<number[]>([])
  const educationRespondedRef = useRef(false)
  const demoStartedAtRef = useRef(Date.now())
  const completedDemoCuesRef = useRef(new Set<DemoCueId>())
  const heartbeatInFlightRef = useRef(false)
  const pollInFlightRef = useRef(false)
  const lastValidGmEventAtRef = useRef<number | null>(null)
  const voiceClientRef = useRef<RealtimeVoiceClient | null>(null)
  const voiceResetRef = useRef(voiceResetState)
  const voiceSubtitleIdRef = useRef(0)

  const m = useMemo(() => metrics(state), [state])
  const score = useMemo(() => scoreState(state), [state])
  const ending = useMemo(() => evaluateEnding(state), [state])
  const selectedRegion = state.regions.find((region) => region.id === selectedRegionId) ?? state.regions[0]
  const date = dateLabel(state.day)
  const decisionKind = state.day >= DECISION_2035_DAY && !state.choice2035
    ? '2035'
    : state.day >= DECISION_2029_DAY && !state.choice2029
      ? '2029'
      : null
  const simulationBlocked = paused || Boolean(decisionKind) || state.terminal

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { educationRespondedRef.current = educationResponded }, [educationResponded])
  useEffect(() => { voiceResetRef.current = voiceResetState }, [voiceResetState])

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
    let prior = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.max(0, (now - prior) / 1000)
      prior = now
      setState((current) => advanceRealtime(current, elapsed))
    }, 200)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    const checkHeartbeat = async () => {
      const now = Date.now()
      setHeartbeatSeconds(Math.max(0, Math.ceil((gmRuntimeRef.current.nextHeartbeatAtMs - now) / 1000)))
      if (now < gmRuntimeRef.current.nextHeartbeatAtMs || heartbeatInFlightRef.current) return
      heartbeatInFlightRef.current = true
      const inbox = gmRuntimeRef.current.immediateQueue.map((action) => action.input)
      await postGmHeartbeat(createBridgeSnapshot(stateRef.current, inbox), undefined, now)
      heartbeatInFlightRef.current = false
      if (!active) return
      const lastValidEventAt = lastValidGmEventAtRef.current
      const hasFreshValidEvent = lastValidEventAt !== null
        && now - lastValidEventAt <= GM_CONSTANTS.heartbeatIntervalMs
      const heartbeat = advanceHeartbeat(gmRuntimeRef.current, now, hasFreshValidEvent ? 'available' : 'unavailable')
      gmRuntimeRef.current = heartbeat.state
      setHeartbeatSeconds(Math.max(0, Math.ceil((heartbeat.state.nextHeartbeatAtMs - Date.now()) / 1000)))
      setBridgeMode(heartbeat.source === 'live-gm' ? 'available' : 'fallback')
      if (heartbeat.fallbackEvent) {
        gmRuntimeRef.current = { ...gmRuntimeRef.current, immediateQueue: [] }
        setState((current) => applyScriptedEvents(current, [heartbeat.fallbackEvent!]))
      }
    }
    const timer = window.setInterval(() => { void checkHeartbeat() }, 1000)
    void checkHeartbeat()
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let active = true
    const poll = async () => {
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      const result = await pollGmEvents()
      pollInFlightRef.current = false
      if (!active) return
      if (result.status === 'available' && result.events.length > 0) {
        lastValidGmEventAtRef.current = Date.now()
        gmRuntimeRef.current = {
          ...gmRuntimeRef.current,
          mode: 'live',
          consecutiveFailures: 0,
          immediateQueue: [],
        }
        setBridgeMode('available')
        setState((current) => applyGMEvents(current, result.events))
        if (result.events.some((event) => /教育|学校|児童データ|learning|school/i.test(`${event.headline} ${event.flavor}`))) {
          setEducationResponded(true)
          setFeatureStatus('LOCAL GM EVENT · validated access and child-data governance response received.')
        }
      } else if (result.status === 'unavailable') {
        setBridgeMode((current) => current === 'fallback' ? current : 'unavailable')
      }
    }
    const timer = window.setInterval(() => { void poll() }, 2500)
    void poll()
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const switchMode = (nextDemoMode: boolean) => {
    if (nextDemoMode === demoMode) return
    setDemoMode(nextDemoMode)
    setState(initialGame(nextDemoMode))
    setPaused(false)
    setResetPulse(0)
    setDecisionSelection(null)
    setEndingVisible(true)
    setEducationResponded(false)
    setBridgeMode('checking')
    setDemoElapsedSeconds(0)
    const now = Date.now()
    gmRuntimeRef.current = createGmRuntimeState(now)
    lastValidGmEventAtRef.current = null
    demoStartedAtRef.current = now
    completedDemoCuesRef.current = new Set()
    setHeartbeatSeconds(60)
  }

  const queueGmAction = async (kind: 'feature' | 'community_event' | 'choice_2029' | 'choice_2035', input: string) => {
    const action: ImmediateAction = {
      id: `${kind}-${Date.now()}`,
      kind,
      input,
      receivedAtMs: Date.now(),
    }
    const queued = enqueueImmediateAction(gmRuntimeRef.current, action)
    if (!queued.accepted) return false
    gmRuntimeRef.current = queued.state
    const inbox = gmRuntimeRef.current.immediateQueue.map((queuedAction) => queuedAction.input)
    const result = await postGmAction(createBridgeSnapshot(stateRef.current, inbox), action)
    if (result.status === 'accepted') {
      setBridgeMode((current) => current === 'fallback' || current === 'available' ? current : 'checking')
      return true
    }
    setBridgeMode((current) => current === 'fallback' ? current : 'unavailable')
    return false
  }

  const applyEducationFallback = () => {
    if (educationRespondedRef.current) return
    const responses = createEducationModeResponse({ date: dateLabel(stateRef.current.day) })
    setState((current) => applyScriptedEvents(current, responses))
    gmRuntimeRef.current = { ...gmRuntimeRef.current, mode: 'scripted-fallback', immediateQueue: [] }
    setBridgeMode('fallback')
    educationRespondedRef.current = true
    setEducationResponded(true)
    setFeatureStatus('SCRIPTED GM FALLBACK · access benefit confirmed; child-data governance review opened.')
  }

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
      : 'LOCAL EFFECT APPLIED · regional fit updated immediately; GM response queued.')
    void queueGmAction('feature', input).then((available) => {
      if (!education || available || demoMode) return
      const timer = window.setTimeout(applyEducationFallback, 900)
      pendingTimersRef.current.push(timer)
    })
  }

  const submitFeature = (event: FormEvent) => {
    event.preventDefault()
    shipFeature(featureText)
  }

  const deployRegion = () => {
    const current = stateRef.current
    const next = introduceRegion(current, selectedRegionId)
    if (next === current) {
      setFeatureStatus(current.compute < 45 ? '45 compute required for a community deployment.' : 'Region is already active.')
      return
    }
    setState(next)
    stateRef.current = next
    void queueGmAction('community_event', selectedRegion.name)
    setFeatureStatus(`LOCAL EFFECT APPLIED · ${selectedRegion.name} community network expanded.`)
  }

  const activateReset = () => {
    if (stateRef.current.resetCooldownSeconds > 0) return
    setState((current) => triggerReset(current))
    setResetPulse((value) => value + 1)
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
  }

  const openStrategy = (tab: UpgradeOverlayTab) => {
    setUpgradeTab(tab)
    setUpgradeOpen(true)
  }

  const performUpgradeAction = (action: UpgradeOverlayAction) => {
    const upgradeMap: Partial<Record<UpgradeOverlayAction, Upgrade>> = {
      model: 'model',
      safety: 'safety',
      governance: 'governance',
      datacenter: 'datacenter',
    }
    const upgrade = upgradeMap[action]
    if (upgrade) setState((current) => buyUpgrade(current, upgrade))
    if (action === 'ecosystem') setState((current) => openEcosystem(current))
    if (action === 'feature-mobile') shipFeature('Mobile support for Android and iOS')
    if (action === 'feature-enterprise') shipFeature('Enterprise SSO for public institutions')
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
      const next = { ...choose2029(stateRef.current, choice), speed: demoMode ? 8 as const : 1 as const }
      stateRef.current = next
      setState(next)
      void queueGmAction('choice_2029', optionId)
    } else if (decisionKind === '2035') {
      const choiceMap: Record<string, Choice2035> = { 'hold-the-line': 'hold-the-line', 'accelerate-again': 'accelerate' }
      const choice = choiceMap[optionId]
      if (!choice) return
      const next = { ...choose2035(stateRef.current, choice), speed: demoMode ? 8 as const : 1 as const }
      stateRef.current = next
      setState(next)
      void queueGmAction('choice_2035', optionId)
    }
    setDecisionSelection(null)
  }

  const runDemoCue = (cue: DemoCue) => {
    const next = applyDemoCueToState(stateRef.current, cue)
    stateRef.current = next
    setState(next)
    if (cue.id === 'education-local') {
      setFeatureStatus('LOCAL EFFECT APPLIED · education access and regional fit increased immediately.')
      void queueGmAction('feature', EDUCATION_PROMPT)
    }
    if (cue.id === 'token-reset') setResetPulse((value) => value + 1)
    if (cue.id === 'education-governance') {
      gmRuntimeRef.current = { ...gmRuntimeRef.current, mode: 'scripted-fallback', immediateQueue: [] }
      educationRespondedRef.current = true
      setEducationResponded(true)
      setBridgeMode('fallback')
      setFeatureStatus('AUTHORED DEMO EVENT · education access and child-data governance advanced within GM caps.')
    }
    if (cue.id === 'open-2029') setDecisionSelection('verified-slowdown')
    if (cue.id === 'choose-2029') {
      setDecisionSelection(null)
      void queueGmAction('choice_2029', 'verified-slowdown')
    }
    if (cue.id === 'open-2035') setDecisionSelection('hold-the-line')
    if (cue.id === 'choose-2035') {
      setDecisionSelection(null)
      void queueGmAction('choice_2035', 'hold-the-line')
    }
    if (cue.id === 'resolve-2040') setEndingVisible(true)
  }

  useEffect(() => {
    if (!demoMode) return
    const direct = () => {
      const elapsed = Math.min(60, (Date.now() - demoStartedAtRef.current) / 1000)
      setDemoElapsedSeconds(elapsed)
      const due = getDueDemoCues(elapsed, completedDemoCuesRef.current)
      for (const cue of due) {
        completedDemoCuesRef.current.add(cue.id)
        runDemoCue(cue)
      }
    }
    const timer = window.setInterval(direct, 200)
    direct()
    return () => window.clearInterval(timer)
  }, [demoMode])

  const nextDemoCue = DEMO_SCHEDULE.find((cue) => !completedDemoCuesRef.current.has(cue.id))

  const mapRegions = useMemo(() => Object.fromEntries(state.regions.map((region) => [
    region.id,
    {
      adoption: region.population > 0 ? region.users / region.population : 0,
      codexShare: region.codexShare,
      active: region.introduced,
      label: region.name,
    } satisfies WorldMapRegionIntensity,
  ])) as Record<RegionId, WorldMapRegionIntensity>, [state.regions])

  const mapMarkers = useMemo<WorldMapMarker[]>(() => [
    { id: 'tokyo', regionId: 'eastAsia', label: 'Build Week Tokyo', kind: 'community', sourceLabel: 'Your Timeline' },
    { id: 'race', regionId: 'na', label: 'Race pressure', kind: 'source', sourceLabel: 'AI 2027', active: date >= '2027-01-01' },
    { id: 'verification', regionId: 'eu', label: 'Verification forum', kind: 'policy', sourceLabel: 'AI 2040', active: date >= '2029-01-01' },
    ...(educationResponded ? [{ id: 'education', regionId: 'india' as const, label: 'School access', kind: 'live' as const, sourceLabel: 'Live GM' }] : []),
  ], [date, educationResponded])

  const enabledFeatures = useMemo<UpgradeOverlayFeature[]>(() => [
    ...(state.flags.includes('feature:mobile') ? ['mobile' as const] : []),
    ...(state.flags.includes('feature:enterprise') ? ['enterprise' as const] : []),
    ...(state.flags.includes('feature:education') ? ['education' as const] : []),
  ], [state.flags])

  const upgradeCosts = useMemo<UpgradeOverlayCosts>(() => ({
    model: 70 * 2 ** Math.max(0, state.capability - 2),
    safety: 105 + 45 * state.safety,
    governance: 105 + 45 * state.governance,
    datacenter: 150 * state.efficiency,
    'feature-mobile': 90,
    'feature-enterprise': 90,
    'feature-education': 90,
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
  const bridgeLabel = bridgeMode === 'available'
    ? 'LIVE BRIDGE AVAILABLE'
    : bridgeMode === 'fallback'
      ? 'SCRIPTED FALLBACK ACTIVE'
      : bridgeMode === 'unavailable'
        ? 'BRIDGE UNAVAILABLE'
        : 'AWAITING VALID GM EVENT'

  return (
    <main className={`command-shell${state.resetBoostSeconds > 0 ? ' is-boosting' : ''}`}>
      <div className="command-shell__grain" aria-hidden="true" />

      <header className="command-header">
        <div className="command-brand">
          <span className="command-brand__mark"><Bot size={20} /></span>
          <span><b>CODEX <i>//</i> 2040</b><small>AI GOVERNANCE SCENARIO SIMULATOR</small></span>
        </div>
        <div className="mode-switch" aria-label="Simulation mode">
          <button aria-pressed={demoMode} className={demoMode ? 'is-active' : ''} onClick={() => switchMode(true)}>60s DEMO</button>
          <button aria-pressed={!demoMode} className={!demoMode ? 'is-active' : ''} onClick={() => switchMode(false)}>NORMAL</button>
        </div>
        <div className="simulation-clock">
          <button className="voice-call-launcher" onClick={() => setVoiceOpen(true)} aria-expanded={voiceOpen}><Phone size={13} /> VOICE OPERATOR</button>
          <span><i /> DETERMINISTIC ENGINE</span>
          <strong>{date}</strong>
        </div>
      </header>

      <section className="intel-strip" aria-label="Latest scenario intelligence">
        <div className="intel-strip__label"><Radio size={13} /> SCENARIO INTELLIGENCE</div>
        {latestNews && <div className="intel-strip__headline"><SourceBadge source={latestNews.source} /><b title={latestNews.headline}>{latestNews.headline}</b><span>{latestNewsDetail}</span></div>}
        <div className="source-key" aria-label="Source label key">
          {(['AI 2027', 'AI 2040', 'Your Timeline', 'Live GM'] as SourceLabel[]).map((source) => <SourceBadge source={source} key={source} />)}
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
          <Meter label="SOCIAL TRUST" value={state.trust} danger={state.trust < 45} />
          <Meter label="MARKET HEALTH" value={(1 - m.hhi) * 100} hint={`HHI ${m.hhi.toFixed(2)} · lower concentration is healthier`} danger={m.hhi > .6} />

          <div className="section-label section-label--sub"><Network size={13} /> COMPETITIVE FIELD</div>
          <div className="market-list">
            <span className="is-codex"><i /><b>CODEX</b><strong>{pct(m.codexShare)}</strong></span>
            <span><i /><b>ANTHRO</b><strong>{pct(state.rivalShares[0])}</strong></span>
            <span><i /><b>GOO</b><strong>{pct(state.rivalShares[1])}</strong></span>
            <span><i /><b>QI</b><strong>{pct(state.rivalShares[2])}</strong></span>
          </div>

          <div className="gm-watchdog" data-mode={bridgeMode}>
            <div><Radio size={13} /><span><b>GM BRIDGE</b><small>{bridgeLabel}</small></span></div>
            <strong>{heartbeatSeconds}s</strong>
            <p>Transport acknowledgements remain pending. Only a validated non-empty event marks GM live; the 60-second watchdog otherwise runs a bounded script.</p>
          </div>
        </aside>

        <section className="world-stage">
          <div className="world-stage__header">
            <span><small>OPERATIONS MAP</small><b>GLOBAL AI ACCESS NETWORK</b></span>
            <span className="world-stage__status"><i /> {simulationBlocked ? 'SIMULATION PAUSED' : `RUNNING ×${state.speed}`}</span>
          </div>
          <div className="world-stage__map">
            <WorldMap
              regions={mapRegions}
              selectedRegion={selectedRegionId}
              onRegionClick={(regionId) => setSelectedRegionId(regionId)}
              eventMarkers={mapMarkers}
              resetPulse={resetPulse}
            />
            <div className="region-inspector">
              <span>SELECTED REGION</span>
              <h2>{selectedRegion.name}</h2>
              <dl>
                <div><dt>AI ACCESS</dt><dd>{pct(selectedRegion.users / selectedRegion.population)}</dd></div>
                <div><dt>CODEX SHARE</dt><dd>{pct(selectedRegion.codexShare)}</dd></div>
                <div><dt>REGULATION</dt><dd>{pct(selectedRegion.regulation)}</dd></div>
              </dl>
              <button onClick={deployRegion}>{selectedRegion.introduced ? 'HOST COMMUNITY EVENT' : 'OPEN FIRST COMMUNITY'}<ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="timeline-track">
            <span>2026</span><div><i style={{ width: `${timelineProgress}%` }} /><b style={{ left: `${timelineProgress}%` }} /></div><span>2040</span>
          </div>
        </section>

        <aside className="strategy-rail">
          <div className="section-label"><Cpu size={13} /> STRATEGY LAYER</div>
          <div className="compute-counter"><span>AVAILABLE COMPUTE</span><strong>{fmt(state.compute, 1)} <small>PF</small></strong></div>
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
              <article key={item.id}><SourceBadge source={item.source} /><time>{item.date}</time><b>{item.headline}</b></article>
            ))}
          </div>
        </aside>
      </section>

      <section className="action-dock">
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
          <div className="feature-console__label"><Sparkles size={15} /><span><small>SHIP A FEATURE</small><b>Change the timeline locally, then let GM respond</b></span></div>
          <div className="feature-console__input">
            <input value={featureText} onChange={(event) => setFeatureText(event.target.value)} maxLength={60} placeholder="Describe a capability in 60 characters…" aria-label="Feature proposal" />
            <button type="submit">SHIP <ChevronRight size={13} /></button>
          </div>
          <button className="education-shortcut" type="button" onClick={() => shipFeature(EDUCATION_PROMPT)}><GraduationCap size={13} /> DEPLOY EDUCATION MODE</button>
          <p className={featureStatus.startsWith('LIVE GM') ? 'is-live' : ''}>{featureStatus}</p>
        </form>

        <div className="time-controls">
          <button aria-pressed={paused} className="pause-button" onClick={() => setPaused((value) => !value)}>{paused ? <CirclePlay size={16} /> : <CirclePause size={16} />}{paused ? 'RESUME' : 'PAUSE'}</button>
          <div>{SPEEDS.map((speed) => <button key={speed} aria-pressed={state.speed === speed} className={state.speed === speed ? 'is-active' : ''} onClick={() => setSpeed(speed)}>×{speed}</button>)}</div>
          {demoMode && <div className="demo-director" aria-live="polite"><Zap size={14} /><span><b>AUTO DIRECTOR · {Math.floor(demoElapsedSeconds)} / 60s</b><small>{nextDemoCue ? `NEXT · ${nextDemoCue.label}` : 'TIMELINE COMPLETE'}</small></span></div>}
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
        onClose={() => setUpgradeOpen(false)}
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
        onRestart={() => {
          const next = initialGame(demoMode)
          setState(next)
          stateRef.current = next
          setEndingVisible(true)
          setDecisionSelection(null)
          setEducationResponded(false)
          educationRespondedRef.current = false
          setDemoElapsedSeconds(0)
          const now = Date.now()
          gmRuntimeRef.current = createGmRuntimeState(now)
          lastValidGmEventAtRef.current = null
          setBridgeMode('checking')
          setHeartbeatSeconds(60)
          demoStartedAtRef.current = now
          completedDemoCuesRef.current = new Set()
        }}
      />
    </main>
  )
}
