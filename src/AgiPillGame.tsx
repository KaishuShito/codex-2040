import { useEffect, useMemo, useRef, useState } from 'react'
import AgiPillDashboard, { type AgiPillLayer } from './components/AgiPillDashboard'
import {
  agiPillMetrics,
  applyAgiPillEffects,
  createAgiPillState,
  enforceAgiPillInvariants,
  runAgiPillTicks,
  setAgiPillPolicy,
  type AgiPillEffect,
  type AgiPillPolicy,
  type AgiPillState,
} from './agiPill/engine'
import { AGI_PILL_EVENT_EARLIEST_DAYS, AGI_PILL_EVENTS, isAgiPillEventEligible, toAgiPillEffectDescriptors, type AgiPillEventDefinition, type AgiPillEventOption } from './agiPill/events'
import {
  AGI_PILL_UPGRADES,
  isAgiPillPrerequisiteSatisfied,
  type AgiPillResource,
  type AgiPillUpgrade,
  type AgiPillUpgradeId,
} from './agiPill/upgrades'
import {
  AGI_PILL_SOURCES,
  CATALOG_SOURCE_TIER_LABELS,
  CAUSE_LABELS,
  ERA_LABELS,
  HEADROOM_LABELS,
  OUTCOME_LABELS,
  PHASE_LABELS,
  RIVAL_LABELS,
  RIVAL_POSTURE_LABELS,
  SOURCE_TIER_LABEL_KEYS,
  classifyResourceHeadroom,
  getPillCopy,
  type AgiPillLocale,
} from './agiPill/content'
import { decodeModeSession, encodeAgiPillModeSession, MODE_SESSION_STORAGE_KEY } from './agiPill/session'
import { GameAudio } from './sound'
import './AgiPillGame.css'

export const AGI_PILL_RULESET_VERSION = 'agi-pill-v1'
type Speed = 1 | 8

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'
const PILL_POLICIES = new Set<AgiPillPolicy>(['observe', 'balanced', 'accelerate', 'safety-first', 'governance-first', 'industrialize', 'resource-recovery', 'cooperate', 'expand-orbit', 'build-dyson', 'post-dyson'])
const PILL_PHASES = new Set(['year-1-3', 'year-3-5', 'year-5-10', 'post-dyson'])
const PILL_OUTCOMES = new Set(['active', 'stagnation', 'rival-takeover', 'industrial-accident', 'misalignment', 'pluralistic-expansion'])
const PILL_WARNINGS = new Set(['rival-capture', 'industrial-cascade', 'misalignment', 'resource-lock'])

export const decodeAgiPillState = (value: unknown): AgiPillState | null => {
  if (!isObject(value)
    || value.version !== 1
    || value.mode !== 'agi-pill'
    || typeof value.day !== 'number'
    || typeof value.seed !== 'number'
    || !PILL_POLICIES.has(value.policy as AgiPillPolicy)
    || !PILL_PHASES.has(value.phase as string)
    || !PILL_OUTCOMES.has(value.outcome as string)
    || !Array.isArray(value.rivalCivilizations)
    || value.rivalCivilizations.length !== 3
    || !isObject(value.expansion)
    || !Array.isArray(value.flags)
    || !Array.isArray(value.milestones)
    || (value.warning !== null && (!isObject(value.warning)
      || !PILL_WARNINGS.has(value.warning.kind as string)
      || typeof value.warning.startedDay !== 'number'
      || !Number.isFinite(value.warning.startedDay)
      || typeof value.warning.countdownDays !== 'number'
      || !Number.isFinite(value.warning.countdownDays)
      || value.warning.countdownDays <= 0
      || !Array.isArray(value.warning.recoveryPolicies)
      || !value.warning.recoveryPolicies.every((policy) => PILL_POLICIES.has(policy as AgiPillPolicy))))) return null
  return enforceAgiPillInvariants(value as AgiPillState)
}

const loadPillSession = () => {
  if (typeof window === 'undefined') return { state: createAgiPillState(), hasStarted: false, restored: false, speed: 1 as Speed, paused: true }
  const decoded = decodeModeSession(window.localStorage.getItem(MODE_SESSION_STORAGE_KEY), {
    rulesetVersion: AGI_PILL_RULESET_VERSION,
    decodeState: decodeAgiPillState,
  })
  if (decoded?.mode === 'agi-pill') return { state: decoded.state, hasStarted: decoded.hasStarted, restored: true, speed: decoded.speed, paused: decoded.paused }
  return { state: createAgiPillState(), hasStarted: false, restored: false, speed: 1 as Speed, paused: true }
}

const modeEventFlag = (id: string) => `pill:event:${id}`
const upgradeFlag = (id: string) => `pill:upgrade:${id}`
const recoveryDeadlineFlag = (optionId: string, day: number) => `pill:recovery-deadline:${optionId}:${day}`
const recoveryAppliedFlag = (optionId: string) => `pill:recovery-applied:${optionId}`

const POLICY_LABELS: Record<AgiPillPolicy, { en: string; ja: string }> = {
  observe: { en: 'Observe', ja: '観測' },
  balanced: { en: 'Balanced', ja: '均衡投資' },
  accelerate: { en: 'Overclock', ja: '過剰加速' },
  'safety-first': { en: 'Safety first', ja: '安全優先' },
  'governance-first': { en: 'Governance first', ja: '統治優先' },
  industrialize: { en: 'Recursive industry', ja: '自己増殖産業' },
  'resource-recovery': { en: 'Recover resources', ja: '資源回復' },
  cooperate: { en: 'Civilization pact', ja: '文明協調' },
  'expand-orbit': { en: 'Expand orbit', ja: '軌道展開' },
  'build-dyson': { en: 'Ignite swarm', ja: 'スウォーム点火' },
  'post-dyson': { en: 'Beyond Dyson', ja: 'Dysonの先へ' },
}

const BOTTLENECK_LABELS = {
  compute: { en: 'experiment compute', ja: '実験計算' },
  experiments: { en: 'physical experiments', ja: '物理実験' },
  assurance: { en: 'assurance', ja: '検証能力' },
  robots: { en: 'robot capacity', ja: 'ロボット能力' },
  energy: { en: 'energy', ja: 'エネルギー' },
  resources: { en: 'accessible resources', ja: '可採資源' },
  permission: { en: 'social permission', ja: '社会的許可' },
} as const

const WARNING_COPY = {
  'rival-capture': { en: ['Rival capture window', 'Your productive base is becoming dependent on a faster rival branch.'], ja: ['競合による奪取窓', '生産基盤が、より速い競合文明へ依存し始めています。'] },
  'industrial-cascade': { en: ['Industrial cascade', 'Correlated defects are propagating through self-replicating factories.'], ja: ['産業連鎖事故', '相関した欠陥が自己増殖工場へ伝播しています。'] },
  misalignment: { en: ['Control deficit', 'Capability is outrunning verification and corrigibility.'], ja: ['制御赤字', '能力が検証と修正可能性を追い越しています。'] },
  'resource-lock': { en: ['Resource lock', 'Accessible stocks cannot support the current replication tempo.'], ja: ['資源ロック', '現在の複製速度を可採資源が支えられません。'] },
} as const

const fmt = (value: number, digits = 1) => new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
const timeLabel = (day: number, locale: AgiPillLocale) => {
  const years = Math.floor(day / 365)
  const days = day % 365
  return locale === 'ja' ? `AGI後 T+${years}年 ${days}日` : `POST-AGI T+${years}Y ${days}D`
}

const layerFor = (state: AgiPillState): AgiPillLayer => state.expansion.dysonBuilt
  ? 'solar'
  : state.expansion.orbitalIndustry >= 1 ? 'orbit' : 'earth'

const relevantPolicies = (state: AgiPillState): AgiPillPolicy[] => {
  if (state.expansion.dysonBuilt) return ['post-dyson', 'cooperate', 'safety-first', 'governance-first', 'resource-recovery']
  if (state.phase === 'year-5-10') return ['expand-orbit', 'build-dyson', 'industrialize', 'safety-first', 'cooperate']
  return ['balanced', 'accelerate', 'safety-first', 'governance-first', 'industrialize', 'resource-recovery', 'cooperate']
}

const phaseTier = (state: AgiPillState) => state.expansion.dysonBuilt ? 6 : state.phase === 'year-5-10' ? 4 : state.phase === 'year-3-5' ? 3 : 2
const scaledCost = (value: number) => value * .02

const canAfford = (state: AgiPillState, upgrade: AgiPillUpgrade) => Object.entries(upgrade.cost).every(([resource, amount]) => {
  const cost = scaledCost(amount ?? 0)
  if (resource === 'materials') return state.resources >= cost
  if (resource === 'legitimacy') return state.governance >= cost
  return state[resource as 'compute' | 'energy'] >= cost
})

const costEffects = (cost: Readonly<Partial<Record<AgiPillResource, number>>>): AgiPillEffect[] => Object.entries(cost).map(([resource, amount]) => ({
  metric: resource === 'materials' ? 'resources' : resource === 'legitimacy' ? 'governance' : resource as 'compute' | 'energy',
  operation: 'add',
  value: -scaledCost(amount ?? 0),
}))

export default function AgiPillGame({ locale, onLocaleChange, onChooseMode }: {
  locale: AgiPillLocale
  onLocaleChange: (locale: AgiPillLocale) => void
  onChooseMode: () => void
}) {
  const initial = useMemo(loadPillSession, [])
  const [state, setState] = useState(initial.state)
  const [hasStarted, setHasStarted] = useState(initial.hasStarted)
  const [restored, setRestored] = useState(initial.restored)
  const [speed, setSpeed] = useState<Speed>(initial.speed)
  const [paused, setPaused] = useState(initial.hasStarted ? initial.paused : true)
  const [pendingEvent, setPendingEvent] = useState<AgiPillEventDefinition | null>(null)
  const [activeLayer, setActiveLayer] = useState<AgiPillLayer>(layerFor(initial.state))
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [programsOpen, setProgramsOpen] = useState(false)
  const [tenYearReviewOpen, setTenYearReviewOpen] = useState(false)
  const audio = useRef(new GameAudio())
  const metrics = agiPillMetrics(state)

  useEffect(() => { audio.current.preload() }, [])
  useEffect(() => {
    if (!hasStarted) return
    window.localStorage.setItem(MODE_SESSION_STORAGE_KEY, encodeAgiPillModeSession(state, true, AGI_PILL_RULESET_VERSION, new Date().toISOString(), { speed, paused }))
  }, [state, hasStarted, paused, speed])

  useEffect(() => {
    if (!hasStarted || paused || pendingEvent || state.terminal) return
    const timer = window.setInterval(() => setState((current) => runAgiPillTicks(current, speed)), 1000)
    return () => window.clearInterval(timer)
  }, [hasStarted, paused, pendingEvent, speed, state.terminal])

  useEffect(() => {
    if (!hasStarted || pendingEvent || state.terminal) return
    const currentMetrics = agiPillMetrics(state)
    const eligibilityState = {
      ...state,
      ...state.expansion,
      rivalPressure: currentMetrics.rivalPressure,
    }
    let due: AgiPillEventDefinition | undefined
    if (state.phase !== 'post-dyson') {
      const eventPhase = state.phase
      due = AGI_PILL_EVENTS.find((event, index) => !state.flags.includes(modeEventFlag(event.id))
        && isAgiPillEventEligible(event, { ...eligibilityState, phase: eventPhase }, { earliestDay: AGI_PILL_EVENT_EARLIEST_DAYS[index] ?? Infinity }))
    }
    if (due) {
      setPendingEvent(due)
      setPaused(true)
      audio.current.play(due.tags.some((tag: string) => tag === 'misalignment' || tag === 'accident') ? 'alert' : 'brief')
    }
  }, [hasStarted, pendingEvent, state.day, state.flags, state.terminal])

  useEffect(() => {
    const layer = layerFor(state)
    if (layer !== activeLayer) {
      setActiveLayer(layer)
      audio.current.play('brief')
    }
  }, [activeLayer, state.expansion.dysonBuilt, state.expansion.orbitalIndustry])

  useEffect(() => {
    if (state.outcome !== 'active') setPaused(true)
  }, [state.outcome])

  useEffect(() => {
    if (state.day < 10 * 365 || state.outcome !== 'active' || pendingEvent || state.flags.includes('pill:review:t10')) return
    setTenYearReviewOpen(true)
    setPaused(true)
  }, [pendingEvent, state.day, state.flags, state.outcome])

  const acquired = useMemo(() => new Set(state.flags.filter((flag) => flag.startsWith('pill:upgrade:')).map((flag) => flag.slice('pill:upgrade:'.length) as AgiPillUpgradeId)), [state.flags])
  const availablePrograms = AGI_PILL_UPGRADES.filter((upgrade) => upgrade.tier <= phaseTier(state) && !acquired.has(upgrade.id) && isAgiPillPrerequisiteSatisfied(upgrade.prerequisite, acquired)).slice(0, 12)
  const activeRecoveries = useMemo<{ option: AgiPillEventOption; deadline: number }[]>(() => (AGI_PILL_EVENTS as readonly AgiPillEventDefinition[]).flatMap((event) => event.options).flatMap((option) => {
    if (!option.setsFlags.some((flag) => state.flags.includes(flag)) || state.flags.includes(recoveryAppliedFlag(option.id))) return []
    const prefix = `pill:recovery-deadline:${option.id}:`
    const deadlineFlag = state.flags.find((flag) => flag.startsWith(prefix))
    const deadline = deadlineFlag ? Number(deadlineFlag.slice(prefix.length)) : -1
    return Number.isFinite(deadline) && state.day <= deadline ? [{ option, deadline }] : []
  }), [state.day, state.flags])

  const start = () => {
    setHasStarted(true)
    setPaused(false)
    audio.current.play('confirm')
  }

  const choosePolicy = (policy: AgiPillPolicy) => {
    setState((current) => setAgiPillPolicy(current, policy))
    audio.current.play(policy === 'accelerate' ? 'alert' : 'confirm')
  }

  const chooseEventOption = (event: AgiPillEventDefinition, optionIndex: number) => {
    const option = event.options[optionIndex]!
    setState((current) => {
      const effected = applyAgiPillEffects(current, toAgiPillEffectDescriptors(option.effects), event.id)
      return enforceAgiPillInvariants({
        ...effected,
        flags: [
          ...effected.flags.filter((flag) => !(option.clearsFlags ?? []).includes(flag)),
          ...option.setsFlags,
          modeEventFlag(event.id),
          recoveryDeadlineFlag(option.id, Math.round(effected.day + option.recovery.windowYears * 365)),
        ],
      })
    })
    setPendingEvent(null)
    setPaused(false)
    audio.current.play('confirm')
  }

  const buyProgram = (upgrade: AgiPillUpgrade) => {
    if (!canAfford(state, upgrade)) return
    setState((current) => {
      const effects: AgiPillEffect[] = [...costEffects(upgrade.cost), ...upgrade.effects.map((effect) => ({ metric: effect.metric, operation: effect.operation, value: effect.value }))]
      const next = applyAgiPillEffects(current, effects, `upgrade:${upgrade.id}`)
      return enforceAgiPillInvariants({ ...next, flags: [...next.flags, upgradeFlag(upgrade.id)] })
    })
    audio.current.play('confirm')
  }

  const executeRecovery = (optionId: string) => {
    const recovery = activeRecoveries.find(({ option }) => option.id === optionId)
    if (!recovery) return
    setState((current) => {
      const effected = applyAgiPillEffects(current, toAgiPillEffectDescriptors(recovery.option.recovery.effects), `recovery:${optionId}`)
      return enforceAgiPillInvariants({
        ...effected,
        interventions: effected.interventions + 1,
        flags: [...effected.flags, recoveryAppliedFlag(optionId)],
      })
    })
    audio.current.play('confirm')
  }

  const resetPill = (confirmReset = true) => {
    const message = locale === 'ja' ? 'AGIピルの現在の世界線だけを削除します。Standardのセーブは残ります。' : 'Delete only the current AGI Pill timeline? The Standard save remains.'
    if (confirmReset && !window.confirm(message)) return
    window.localStorage.removeItem(MODE_SESSION_STORAGE_KEY)
    setState(createAgiPillState({ seed: Date.now() }))
    setHasStarted(false)
    setRestored(false)
    setPaused(true)
    setPendingEvent(null)
  }

  if (!hasStarted) {
    return (
      <main className="pill-intro">
        <div className="pill-intro__grid" aria-hidden="true" />
        <section>
          <span>CODEX 2040 // MODE 02</span>
          <h1>{locale === 'ja' ? 'AGIピルを飲む？' : 'TAKE THE AGI PILL?'}</h1>
          <p>{getPillCopy(locale, 'mode.pill.description')}</p>
          <div className="pill-intro__loop">
            <b>{locale === 'ja' ? '知能' : 'INTELLIGENCE'}</b><i>×</i><b>{locale === 'ja' ? '産業' : 'INDUSTRY'}</b><i>×</i><b>{locale === 'ja' ? '統治' : 'GOVERNANCE'}</b>
          </div>
          <p className="pill-intro__warning">{getPillCopy(locale, 'mode.pill.warning')}</p>
          {restored && <p className="pill-intro__restore">{locale === 'ja' ? '保存されたAGIピル世界線を検出しました。' : 'Saved AGI Pill timeline detected.'}</p>}
          <div className="pill-intro__actions">
            <button type="button" onClick={start}>{restored ? (locale === 'ja' ? '世界線を再開' : 'Resume timeline') : (locale === 'ja' ? 'シミュレーション開始' : 'Begin simulation')}</button>
            <button type="button" onClick={onChooseMode}>{locale === 'ja' ? 'モード選択へ戻る' : 'Back to modes'}</button>
          </div>
        </section>
      </main>
    )
  }

  const unlockedLayers: AgiPillLayer[] = ['earth']
  if (state.expansion.orbitalIndustry >= 1) unlockedLayers.push('orbit')
  if (state.expansion.dysonBuilt) unlockedLayers.push('solar')
  const dashboardMetrics = [
    ['intelligence', locale === 'ja' ? '知能' : 'Intelligence', state.intelligence, `v ${fmt(metrics.researchVelocity * 1000, 2)}`],
    ['compute', locale === 'ja' ? '計算' : 'Compute', state.compute, locale === 'ja' ? '対数容量' : 'log capacity'],
    ['energy', locale === 'ja' ? 'エネルギー' : 'Energy', state.energy, locale === 'ja' ? '対数容量' : 'log capacity'],
    ['robots', locale === 'ja' ? 'ロボット' : 'Robots', state.robots, `${locale === 'ja' ? '境界付き指数' : 'bounded index'} · v ${fmt(metrics.industrialVelocity * 1000, 2)}`],
    ['safety', locale === 'ja' ? '安全' : 'Safety', state.safety, `${locale === 'ja' ? 'ギャップ' : 'gap'} ${fmt(metrics.safetyGap)}`],
    ['governance', locale === 'ja' ? '統治' : 'Governance', state.governance, `${locale === 'ja' ? 'ギャップ' : 'gap'} ${fmt(metrics.governanceGap)}`],
    ['resources', locale === 'ja' ? '可採資源' : 'Resources', state.resources, `${fmt(metrics.resourceHeadroom * 100, 0)}% · ${HEADROOM_LABELS[classifyResourceHeadroom(metrics.resourceHeadroom)][locale]}`],
    ['risk', locale === 'ja' ? '破局リスク帯' : 'Risk band', state.risk, locale === 'ja' ? 'モデル出力' : 'model output'],
  ].map(([id, label, value, detail]) => ({
    id: String(id), label: String(label), value: fmt(Number(value)), detail: String(detail),
    signal: id === 'risk' && Number(value) >= 55 ? 'critical' as const : id === metrics.primaryBottleneck ? 'constrained' as const : 'stable' as const,
  }))

  const causalCards = state.lastCauses.slice(0, 4).map((cause) => ({
    id: cause.id,
    cause: CAUSE_LABELS[cause.id][locale],
    effect: cause.direction === 'help' ? (locale === 'ja' ? '加速' : 'accelerates') : cause.direction === 'limit' ? (locale === 'ja' ? '制約' : 'constrains') : (locale === 'ja' ? '危険' : 'threatens'),
    explanation: `${locale === 'ja' ? '影響度' : 'magnitude'} ${fmt(cause.magnitude, 2)}`,
    recovery: cause.direction === 'help' ? undefined : `${locale === 'ja' ? '回復手' : 'Recovery'}: ${POLICY_LABELS[state.warning?.recoveryPolicies[0] ?? 'balanced'][locale]}`,
    signal: cause.direction === 'harm' ? 'critical' as const : cause.direction === 'limit' ? 'constrained' as const : 'accelerating' as const,
  }))

  const milestoneDefinitions = [
    ['agi-research-loop', locale === 'ja' ? '知能再帰' : 'Research recursion'],
    ['robot-self-replication', locale === 'ja' ? '産業閉鎖' : 'Industrial closure'],
    ['orbital-industry', locale === 'ja' ? '軌道工業' : 'Orbital industry'],
    ['dyson-swarm', locale === 'ja' ? 'Dyson点火' : 'Dyson ignition'],
    ['solar-system-takeoff', locale === 'ja' ? '分岐文明' : 'Branch civilizations'],
  ] as const
  const firstIncompleteMilestone = milestoneDefinitions.findIndex(([id]) => !state.milestones.includes(id))
  const milestones = milestoneDefinitions.map(([id, label], index) => ({
    id,
    label,
    status: state.milestones.includes(id) ? 'complete' as const : index === firstIncompleteMilestone ? 'active' as const : 'locked' as const,
  }))

  return (
    <main className="pill-game" data-testid="agi-pill-game">
      <header className="pill-game__topbar">
        <div><b>AGI PILL</b><span>{timeLabel(state.day, locale)}</span><em>{ERA_LABELS[state.phase][locale]} · {PHASE_LABELS[state.phase][locale]}</em></div>
        <nav>
          <button type="button" onClick={() => onLocaleChange(locale === 'ja' ? 'en' : 'ja')}>{locale === 'ja' ? 'EN' : '日本語'}</button>
          <button type="button" onClick={() => setSourcesOpen(true)}>{getPillCopy(locale, 'source.open')}</button>
          <button type="button" onClick={onChooseMode}>{locale === 'ja' ? 'モード' : 'Modes'}</button>
          <button type="button" onClick={() => resetPill()}>{locale === 'ja' ? '新規' : 'New'}</button>
        </nav>
      </header>

      <section className="pill-game__controls" aria-label={locale === 'ja' ? '時間と戦略' : 'Time and strategy'}>
        <div className="pill-speed">
          <button type="button" className={!paused && speed === 1 ? 'is-active' : ''} onClick={() => { setSpeed(1); setPaused(false); audio.current.play('time') }}>▶ 1x</button>
          <button type="button" className={!paused && speed === 8 ? 'is-active' : ''} onClick={() => { setSpeed(8); setPaused(false); audio.current.play('time') }}>≫ 8x</button>
          <button type="button" className={paused ? 'is-active' : ''} onClick={() => setPaused((value) => !value)}>Ⅱ {locale === 'ja' ? '停止' : 'Pause'}</button>
        </div>
        <div className="pill-policies">
          {relevantPolicies(state).map((policy) => <button type="button" key={policy} className={state.policy === policy ? 'is-active' : ''} onClick={() => choosePolicy(policy)}>{POLICY_LABELS[policy][locale]}</button>)}
        </div>
        <button type="button" className="pill-programs-button" onClick={() => setProgramsOpen(true)}>{locale === 'ja' ? `戦略ツリー ${acquired.size}/45` : `Strategy tree ${acquired.size}/45`}</button>
      </section>

      {state.warning && !state.terminal && (
        <aside className="pill-warning" role="alert">
          <div><span>{locale === 'ja' ? 'CRITICAL WINDOW' : 'CRITICAL WINDOW'}</span><h2>{WARNING_COPY[state.warning.kind][locale][0]}</h2><p>{WARNING_COPY[state.warning.kind][locale][1]}</p></div>
          <div><b>{Math.max(0, state.warning.countdownDays - (state.day - state.warning.startedDay))} DAYS</b><small>{locale === 'ja' ? '回復可能' : 'RECOVERABLE'}</small></div>
          <nav>{state.warning.recoveryPolicies.map((policy) => <button type="button" key={policy} onClick={() => choosePolicy(policy)}>{POLICY_LABELS[policy][locale]}</button>)}</nav>
        </aside>
      )}

      {activeRecoveries.length > 0 && !pendingEvent && !state.terminal && (
        <aside className="pill-recovery" aria-label={locale === 'ja' ? 'イベント回復策' : 'Event countermeasures'}>
          <span>{locale === 'ja' ? '回復窓' : 'RECOVERY WINDOW'}</span>
          {activeRecoveries.slice(0, 2).map(({ option, deadline }) => <article key={option.id}>
            <div><b>{option.recovery.trigger[locale]}</b><p>{option.recovery.action[locale]}</p><small>{Math.max(0, deadline - state.day)} {locale === 'ja' ? '日残り' : 'days left'}</small></div>
            <button type="button" onClick={() => executeRecovery(option.id)}>{locale === 'ja' ? '対抗策を実行' : 'Execute countermeasure'}</button>
          </article>)}
        </aside>
      )}

      <AgiPillDashboard
        locale={locale}
        activeLayer={activeLayer}
        unlockedLayers={unlockedLayers}
        onLayerChange={setActiveLayer}
        metrics={dashboardMetrics}
        causalCards={causalCards}
        milestones={milestones}
        dysonProgress={state.expansion.dysonProgress}
        frontierTitle={state.expansion.dysonBuilt ? (locale === 'ja' ? '光速遅延下の分岐文明' : 'Branch civilizations under light lag') : (locale === 'ja' ? '地球の制約を越える' : 'Beyond Earth-bound constraints')}
        frontierDetail={state.expansion.dysonBuilt ? getPillCopy(locale, 'ending.continue.help') : `${locale === 'ja' ? '主要ボトルネック' : 'Primary bottleneck'}: ${BOTTLENECK_LABELS[metrics.primaryBottleneck][locale]}`}
        timeLabel={timeLabel(state.day, locale)}
      />

      <section className="pill-game__ledger">
        <article><span>{locale === 'ja' ? '競合/分岐文明' : 'Rivals / branches'}</span>{state.rivalCivilizations.map((rival) => <p key={rival.id}><b>{RIVAL_LABELS[rival.id][locale]}</b><i>{fmt(rival.capability)} K</i><i>{fmt(rival.industrialBase)} IND</i><i>{RIVAL_POSTURE_LABELS[rival.posture][locale]}</i></p>)}</article>
        <article><span>{locale === 'ja' ? '現在の因果' : 'Current causality'}</span><p><b>{locale === 'ja' ? '一次制約' : 'Primary constraint'}</b><i>{BOTTLENECK_LABELS[metrics.primaryBottleneck][locale]}</i></p><p><b>{locale === 'ja' ? '競争圧力' : 'Rival pressure'}</b><i>{fmt(metrics.rivalPressure, 2)}x</i></p><p><b>Dyson</b><i>{fmt(state.expansion.dysonProgress)}%</i></p></article>
      </section>

      {pendingEvent && (
        <div className="pill-modal" role="dialog" aria-modal="true" aria-labelledby="pill-event-title">
          <section className="pill-event">
            <span>{ERA_LABELS[pendingEvent.phase][locale]} // {CATALOG_SOURCE_TIER_LABELS[pendingEvent.sourceTier][locale]}</span>
            <h2 id="pill-event-title">{pendingEvent.title[locale]}</h2>
            <p>{pendingEvent.summary[locale]}</p>
            <blockquote>{pendingEvent.causalChain[locale]}</blockquote>
            <div>{pendingEvent.options.map((option, index) => <button type="button" key={option.id} onClick={() => chooseEventOption(pendingEvent, index)}><b>{option.label[locale]}</b><span>{option.description[locale]}</span><small>{locale === 'ja' ? '回復窓' : 'Recovery window'}: {option.recovery.windowYears}y · {option.recovery.action[locale]}</small></button>)}</div>
            <button type="button" className="pill-source-link" onClick={() => setSourcesOpen(true)}>{getPillCopy(locale, 'source.open')} · {pendingEvent.sourceRefs.length}</button>
          </section>
        </div>
      )}

      {programsOpen && (
        <div className="pill-modal" role="dialog" aria-modal="true" aria-labelledby="pill-program-title">
          <section className="pill-programs">
            <header><div><span>09 AXES // 45 PROGRAMS</span><h2 id="pill-program-title">{locale === 'ja' ? '文明戦略ツリー' : 'Civilization strategy tree'}</h2></div><button type="button" onClick={() => setProgramsOpen(false)}>×</button></header>
            <p>{locale === 'ja' ? 'コスト表示は対数容量への換算値。互いの前提を開き、成長と負債を同時に作ります。' : 'Costs are scaled into log-capacity units. Programs unlock one another and create both growth and liabilities.'}</p>
            <div>{availablePrograms.map((upgrade) => <article key={upgrade.id} data-axis={upgrade.axis}><span>{upgrade.axis} // T{upgrade.tier} · {CATALOG_SOURCE_TIER_LABELS[upgrade.sourceTier][locale]}</span><h3>{upgrade.title[locale]}</h3><p>{upgrade.summary[locale]}</p><small>{upgrade.tradeoff[locale]}</small><button type="button" disabled={!canAfford(state, upgrade)} onClick={() => buyProgram(upgrade)}>{canAfford(state, upgrade) ? (locale === 'ja' ? '投資する' : 'Fund program') : (locale === 'ja' ? '資源不足' : 'Insufficient resources')}</button></article>)}</div>
            <button type="button" className="pill-source-link" onClick={() => { setProgramsOpen(false); setSourcesOpen(true) }}>{getPillCopy(locale, 'source.open')}</button>
          </section>
        </div>
      )}

      {tenYearReviewOpen && (
        <div className="pill-modal" role="dialog" aria-modal="true" aria-labelledby="pill-review-title">
          <section className="pill-event pill-horizon-review">
            <span>T+10 // {locale === 'ja' ? 'シナリオ地平レビュー' : 'SCENARIO HORIZON REVIEW'}</span>
            <h2 id="pill-review-title">{locale === 'ja' ? 'ここから先は予測ではなく、分岐を追う' : 'Beyond here, follow branches—not a forecast'}</h2>
            <p>{locale === 'ja' ? '典型シナリオ範囲の終端です。Dyson点火や太陽系進出を終点にせず、安全・統治・競合・物理上限を保ったまま続行できます。' : 'This is the edge of the typical scenario range. Continue past Dyson and solar expansion while preserving safety, governance, rival, and physical-limit consequences.'}</p>
            <div className="pill-horizon-review__metrics"><b>INT {fmt(state.intelligence)}</b><b>IND {fmt(state.robots)}</b><b>SAFE {fmt(state.safety)}</b><b>GOV {fmt(state.governance)}</b><b>DYSON {fmt(state.expansion.dysonProgress)}%</b></div>
            <button type="button" onClick={() => {
              setState((current) => ({ ...current, flags: [...current.flags, 'pill:review:t10'] }))
              setTenYearReviewOpen(false)
              setPaused(false)
            }}>{locale === 'ja' ? '地平の先へ続行' : 'Continue beyond the horizon'}</button>
          </section>
        </div>
      )}

      {sourcesOpen && (
        <div className="pill-modal" role="dialog" aria-modal="true" aria-labelledby="pill-source-title">
          <section className="pill-sources">
            <header><div><span>DATA // MODEL // SCENARIO</span><h2 id="pill-source-title">{getPillCopy(locale, 'source.title')}</h2></div><button type="button" onClick={() => setSourcesOpen(false)}>×</button></header>
            <p>{getPillCopy(locale, 'source.subtitle')}</p>
            <div>{AGI_PILL_SOURCES.map((source) => <article key={source.id}><span>{getPillCopy(locale, SOURCE_TIER_LABEL_KEYS[source.tier])}</span><h3>{source.title}</h3><b>{source.publisher}</b><p>{source.note[locale]}</p>{source.caveat && <p className="pill-source__caveat"><b>{locale === 'ja' ? '確立しないこと' : 'Does not establish'}:</b> {source.caveat[locale]}</p>}{source.variables && <small>{locale === 'ja' ? '使用変数' : 'Variables'}: {source.variables.join(' · ')}</small>}{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{getPillCopy(locale, 'source.read')} ↗</a> : <small>{getPillCopy(locale, 'source.noLink')}</small>}</article>)}</div>
          </section>
        </div>
      )}

      {(state.terminal || state.outcome !== 'active') && (
        <div className="pill-modal pill-modal--ending" role="dialog" aria-modal="true">
          <section className="pill-ending">
            <span>WORLDLINE COMPLETE // {OUTCOME_LABELS[state.outcome][locale]}</span>
            <h2>{OUTCOME_LABELS[state.outcome][locale]}</h2>
            <p>{locale === 'ja' ? `AGI後${Math.floor(state.day / 365)}年。到達段階: ${ERA_LABELS[state.phase][locale]}。最大の因果は${CAUSE_LABELS[state.lastCauses[0]?.id ?? 'physical-ceiling'][locale]}でした。` : `T+${Math.floor(state.day / 365)} years. Reached ${ERA_LABELS[state.phase][locale]}. Dominant cause: ${CAUSE_LABELS[state.lastCauses[0]?.id ?? 'physical-ceiling'][locale]}.`}</p>
            <div><b>RUN {state.runSeed}</b><b>INT {fmt(state.intelligence)}</b><b>IND {fmt(state.robots)}</b><b>SAFE {fmt(state.safety)}</b><b>GOV {fmt(state.governance)}</b><b>DYSON {fmt(state.expansion.dysonProgress)}%</b></div>
            <nav className="pill-ending__actions">
              <button type="button" onClick={() => resetPill(false)}>{locale === 'ja' ? '別の世界線を試す' : 'Try another worldline'}</button>
              <button type="button" onClick={onChooseMode}>{locale === 'ja' ? 'モード選択へ' : 'Choose mode'}</button>
            </nav>
          </section>
        </div>
      )}
    </main>
  )
}
