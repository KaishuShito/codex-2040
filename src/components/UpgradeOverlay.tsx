import {
  Accessibility,
  ArrowUpRight,
  AudioWaveform,
  BadgeCheck,
  BadgeDollarSign,
  BarChart3,
  Blocks,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  BugOff,
  Building2,
  Check,
  ChevronRight,
  Coins,
  Cpu,
  Database,
  FileCheck2,
  FlaskConical,
  Gauge,
  GitFork,
  GraduationCap,
  KeyRound,
  Landmark,
  Languages,
  LockKeyhole,
  MemoryStick,
  Network,
  PanelsTopLeft,
  PlugZap,
  RadioTower,
  Rocket,
  Scale,
  ScanEye,
  School,
  ScrollText,
  Search,
  ShieldCheck,
  ShieldEllipsis,
  Siren,
  Smartphone,
  Sparkles,
  Stamp,
  University,
  Unplug,
  UsersRound,
  Waypoints,
  Weight,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  STRATEGY_CATALOG,
  collectPrerequisiteIds,
  getStrategyNodesByCategory,
  type LegacyStrategyAction,
  type Locale,
  type StrategyEffectDescriptor,
  type StrategyNode,
  type StrategyNodeId,
  type StrategyPrerequisite,
} from '../strategyNodes'
import './UpgradeOverlay.css'

export type UpgradeOverlayTab = 'model' | 'product' | 'company' | 'ecosystem'
export type UpgradeOverlayAction = LegacyStrategyAction
export type UpgradeOverlayFeature = 'mobile' | 'enterprise' | 'education' | 'research' | 'connectors' | 'analysis'
export type UpgradeOverlayCosts = Record<UpgradeOverlayAction, number>
export type UpgradeOverlayNodeAvailabilityStatus =
  | 'ready'
  | 'acquired'
  | 'locked'
  | 'excluded'
  | 'disabled'
  | 'capped'
  | 'cooldown'
  | 'insufficient-compute'
export type UpgradeOverlayNodeAvailability = Readonly<{
  status: UpgradeOverlayNodeAvailabilityStatus
  cost: number
  blockingNodeId?: StrategyNodeId | null
}>

export type UpgradeOverlayProps = {
  isOpen: boolean
  compute: number
  capability: number
  safety: number
  governance: number
  efficiency: number
  trust: number
  codexShare: number
  hhi: number
  costs: UpgradeOverlayCosts
  enabledFeatures?: readonly UpgradeOverlayFeature[]
  disabledActions?: readonly UpgradeOverlayAction[]
  ecosystemCooldownDays?: number
  initialTab?: UpgradeOverlayTab
  /** Persistent catalog node progress. Older App callers can omit this during engine migration. */
  completedNodeIds?: readonly StrategyNodeId[]
  /** Optional explicit exclusions, in addition to exclusions implied by completed nodes. */
  excludedNodeIds?: readonly StrategyNodeId[]
  locale?: Locale
  /** Engine-owned state wins over every UI inference, especially for repeatable nodes. */
  getNodeAvailability?: (nodeId: StrategyNodeId) => UpgradeOverlayNodeAvailability | null
  /** Preferred catalog action. When absent, legacy nodes continue through onAction. */
  onNodeAction?: (nodeId: StrategyNodeId) => void
  onAction: (action: UpgradeOverlayAction) => void
  onClose: () => void
}

export type StrategyNodeUiState = 'ready' | 'locked' | 'complete' | 'excluded' | 'cooldown' | 'cost' | 'pending'

export const resolveStrategyNodeUiState = (
  availability: UpgradeOverlayNodeAvailability | null | undefined,
  fallback: StrategyNodeUiState,
): StrategyNodeUiState => {
  if (!availability) return fallback
  if (availability.status === 'ready') return 'ready'
  if (availability.status === 'acquired' || availability.status === 'capped') return 'complete'
  if (availability.status === 'excluded') return 'excluded'
  if (availability.status === 'cooldown') return 'cooldown'
  if (availability.status === 'insufficient-compute') return 'cost'
  return 'locked'
}

const DEFAULT_TAB: UpgradeOverlayTab = 'model'

const TABS: readonly { id: UpgradeOverlayTab; label: Readonly<Record<Locale, string>>; kicker: Readonly<Record<Locale, string>>; icon: LucideIcon }[] = [
  { id: 'model', label: { en: 'Model', ja: 'モデル' }, kicker: { en: 'Capability', ja: '性能' }, icon: BrainCircuit },
  { id: 'product', label: { en: 'Product', ja: 'プロダクト' }, kicker: { en: 'Features', ja: '機能' }, icon: Sparkles },
  { id: 'company', label: { en: 'Company', ja: '組織' }, kicker: { en: 'Organization', ja: '体制' }, icon: Building2 },
  { id: 'ecosystem', label: { en: 'Open', ja: 'オープン' }, kicker: { en: 'Ecosystem', ja: 'エコシステム' }, icon: Network },
]

const ICONS: Readonly<Record<string, LucideIcon>> = {
  accessibility: Accessibility,
  'audio-waveform': AudioWaveform,
  'badge-check': BadgeCheck,
  'badge-dollar-sign': BadgeDollarSign,
  'bar-chart-3': BarChart3,
  blocks: Blocks,
  bot: Bot,
  'brain-circuit': BrainCircuit,
  'briefcase-business': BriefcaseBusiness,
  'bug-off': BugOff,
  coins: Coins,
  cpu: Cpu,
  database: Database,
  'file-check-2': FileCheck2,
  'flask-conical': FlaskConical,
  gauge: Gauge,
  'git-fork': GitFork,
  'graduation-cap': GraduationCap,
  'key-round': KeyRound,
  landmark: Landmark,
  languages: Languages,
  'memory-stick': MemoryStick,
  network: Network,
  'panels-top-left': PanelsTopLeft,
  'plug-zap': PlugZap,
  'radio-tower': RadioTower,
  rocket: Rocket,
  scale: Scale,
  'scan-eye': ScanEye,
  school: School,
  'scroll-text': ScrollText,
  search: Search,
  'shield-check': ShieldCheck,
  'shield-ellipsis': ShieldEllipsis,
  'shield-lock': LockKeyhole,
  siren: Siren,
  smartphone: Smartphone,
  stamp: Stamp,
  university: University,
  unplug: Unplug,
  'users-round': UsersRound,
  waypoints: Waypoints,
  weight: Weight,
  'wifi-off': WifiOff,
  zap: Zap,
}

const LEGACY_FEATURE_NODES: Readonly<Record<UpgradeOverlayFeature, StrategyNodeId>> = {
  mobile: 'product-mobile',
  enterprise: 'product-sso',
  education: 'product-education',
  research: 'product-research',
  connectors: 'product-connectors',
  analysis: 'product-analysis',
}

const MODEL_MILESTONES: readonly [StrategyNodeId, number][] = [
  ['model-foundation', 3],
  ['model-reasoning', 5],
  ['model-agents', 7],
  ['model-frontier', 10],
]

const clampPercent = (value: number) => Math.max(0, Math.min(100, value))
const formatCompute = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

export const isStrategyPrerequisiteSatisfied = (
  prerequisite: StrategyPrerequisite,
  completed: ReadonlySet<StrategyNodeId>,
): boolean => {
  if (prerequisite.kind === 'always') return true
  if (prerequisite.kind === 'node') return completed.has(prerequisite.id)
  if (prerequisite.kind === 'all') return prerequisite.terms.every((term) => isStrategyPrerequisiteSatisfied(term, completed))
  return prerequisite.terms.some((term) => isStrategyPrerequisiteSatisfied(term, completed))
}

export const inferLegacyStrategyProgress = ({
  capability,
  safety,
  governance,
  efficiency,
  enabledFeatures,
}: {
  capability: number
  safety: number
  governance: number
  efficiency: number
  enabledFeatures: readonly UpgradeOverlayFeature[]
}): ReadonlySet<StrategyNodeId> => {
  const progress = new Set<StrategyNodeId>()
  MODEL_MILESTONES.forEach(([id, target]) => {
    if (capability >= target) progress.add(id)
  })
  enabledFeatures.forEach((feature) => progress.add(LEGACY_FEATURE_NODES[feature]))
  if (safety > 2) progress.add('company-safety')
  if (governance > 2) progress.add('company-policy')
  if (efficiency > 1) progress.add('company-datacenter')
  return progress
}

const localized = (value: Readonly<Record<Locale, string>>, locale: Locale) => value[locale]

const stateLabel = (state: StrategyNodeUiState, locale: Locale) => locale === 'ja'
  ? ({ ready: '利用可能', locked: 'ロック', complete: '完了', excluded: '排他', cooldown: '待機中', cost: '資源不足', pending: '準備中' } as const)[state]
  : state.toUpperCase()

const metricLabel = (metric: StrategyEffectDescriptor['metric'], locale: Locale) => {
  if (locale !== 'ja') return metric.replaceAll(/([A-Z])/g, ' $1')
  return ({
    capability: 'モデル能力', safety: '安全性', governance: 'ガバナンス', efficiency: '効率', trust: '社会的信頼',
    brand: 'ブランド', momentum: '成長モメンタム', incomeMultiplier: '収入倍率', opexMultiplier: '運用費倍率',
    controlRelief: '制御余力', idleFloor: '基礎成長', regionFit: '地域適合', usersPopulationShare: '利用者',
    codexShare: 'Codexシェア', rivalShare: '競合シェア',
  } as const)[metric]
}

const effectTone = (effect: StrategyEffectDescriptor): 'good' | 'risk' | 'neutral' => {
  if (effect.metric === 'opexMultiplier') return effect.value <= 1 ? 'good' : 'risk'
  if (effect.metric === 'incomeMultiplier' || effect.metric === 'regionFit') return effect.value >= 1 ? 'good' : 'risk'
  if (effect.metric === 'rivalShare') return effect.value > 0 ? 'risk' : 'good'
  if (effect.metric === 'controlRelief') return effect.value >= 0 ? 'good' : 'risk'
  if (effect.metric === 'idleFloor' || effect.metric === 'momentum') return effect.value > 0 ? 'good' : 'neutral'
  return effect.value > 0 ? 'good' : effect.value < 0 ? 'risk' : 'neutral'
}

const describePrerequisite = (
  prerequisite: StrategyPrerequisite,
  byId: ReadonlyMap<StrategyNodeId, StrategyNode>,
  locale: Locale,
): string => {
  if (prerequisite.kind === 'always') return locale === 'ja' ? 'なし' : 'None'
  if (prerequisite.kind === 'node') return localized(byId.get(prerequisite.id)?.title ?? { en: prerequisite.id, ja: prerequisite.id }, locale)
  const separator = prerequisite.kind === 'all' ? ' + ' : ' / '
  return prerequisite.terms.map((term) => describePrerequisite(term, byId, locale)).join(separator)
}

const getNodeCost = (node: StrategyNode, costs: UpgradeOverlayCosts) =>
  node.baseCost ?? costs[node.legacyAction.id]

const getInferredComplete = (
  node: StrategyNode,
  inferredProgress: ReadonlySet<StrategyNodeId>,
) => {
  if (node.category === 'model') return inferredProgress.has(node.id)
  if (node.legacyAction && !node.legacyAction.repeatable) return inferredProgress.has(node.id)
  return false
}

export function UpgradeOverlay({
  isOpen,
  compute,
  capability,
  safety,
  governance,
  efficiency,
  trust,
  codexShare,
  hhi,
  costs,
  enabledFeatures = [],
  disabledActions = [],
  ecosystemCooldownDays = 0,
  initialTab = DEFAULT_TAB,
  completedNodeIds = [],
  excludedNodeIds = [],
  locale = 'en',
  getNodeAvailability,
  onNodeAction,
  onAction,
  onClose,
}: UpgradeOverlayProps) {
  const [activeTab, setActiveTab] = useState<UpgradeOverlayTab>(initialTab)
  const [selectedId, setSelectedId] = useState<StrategyNodeId>('model-foundation')
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  const nodesById = useMemo(
    () => new Map<StrategyNodeId, StrategyNode>(STRATEGY_CATALOG.map((node) => [node.id, node])),
    [],
  )
  const tabNodes = useMemo(() => getStrategyNodesByCategory(activeTab), [activeTab])
  const selectedNode = tabNodes.find((node) => node.id === selectedId) ?? tabNodes[0]
  const explicitCompleted = useMemo(() => new Set(completedNodeIds), [completedNodeIds])
  const inferredProgress = useMemo(() => inferLegacyStrategyProgress({
    capability,
    safety,
    governance,
    efficiency,
    enabledFeatures,
  }), [capability, efficiency, enabledFeatures, governance, safety])
  const prerequisiteProgress = useMemo(
    () => new Set<StrategyNodeId>([...explicitCompleted, ...inferredProgress]),
    [explicitCompleted, inferredProgress],
  )
  const explicitExcluded = useMemo(() => new Set(excludedNodeIds), [excludedNodeIds])
  const safetyGap = Math.max(0, capability - safety)
  const governanceGap = Math.max(0, capability - governance)
  const maxGap = Math.max(safetyGap, governanceGap)
  const nextCapability = Math.min(10, capability + 1)
  const nextSafetyGap = Math.max(0, nextCapability - safety)
  const nextGovernanceGap = Math.max(0, nextCapability - governance)

  const fallbackComplete = (node: StrategyNode) => explicitCompleted.has(node.id) || getInferredComplete(node, inferredProgress)
  const fallbackExcluded = (node: StrategyNode) => explicitExcluded.has(node.id)
    || node.exclusions.some((id) => prerequisiteProgress.has(id))
  const fallbackLocked = (node: StrategyNode) => !isStrategyPrerequisiteSatisfied(node.prerequisite, prerequisiteProgress)
  const fallbackNodeState = (node: StrategyNode): StrategyNodeUiState => {
    if (fallbackComplete(node)) return 'complete'
    if (fallbackExcluded(node)) return 'excluded'
    if (!node.enabled || fallbackLocked(node) || (node.legacyAction && disabledActions.includes(node.legacyAction.id))) return 'locked'
    if (node.category === 'ecosystem' && ecosystemCooldownDays > 0) return 'cooldown'
    if (compute < getNodeCost(node, costs)) return 'cost'
    if (!node.legacyAction && !onNodeAction) return 'pending'
    return 'ready'
  }
  const availabilityFor = (node: StrategyNode) => getNodeAvailability?.(node.id) ?? null
  const nodeState = (node: StrategyNode): StrategyNodeUiState =>
    resolveStrategyNodeUiState(availabilityFor(node), fallbackNodeState(node))
  const isComplete = (node: StrategyNode) => nodeState(node) === 'complete'

  const statusLabel = (node: StrategyNode, state: StrategyNodeUiState) => {
    const availability = availabilityFor(node)
    const blocker = availability?.blockingNodeId ? nodesById.get(availability.blockingNodeId) : null
    if (state === 'complete') return availability?.status === 'capped' ? (locale === 'ja' ? '上限到達' : 'At capacity') : (locale === 'ja' ? '導入済み' : 'Deployed')
    if (state === 'excluded') return blocker ? (locale === 'ja' ? `${localized(blocker.title, locale)}と排他` : `Excluded by ${localized(blocker.title, locale)}`) : (locale === 'ja' ? '選択不可のルート' : 'Route excluded')
    if (state === 'locked') return blocker
      ? (locale === 'ja' ? `${localized(blocker.title, locale)}が必要` : `Requires ${localized(blocker.title, locale)}`)
      : node.enabled ? (locale === 'ja' ? `${describePrerequisite(node.prerequisite, nodesById, locale)}が必要` : `Requires ${describePrerequisite(node.prerequisite, nodesById, locale)}`) : (locale === 'ja' ? '近日公開' : 'Coming soon')
    if (state === 'cooldown') return locale === 'ja' ? `${ecosystemCooldownDays}日後に利用可能` : `Ready in ${ecosystemCooldownDays}d`
    if (state === 'cost') return locale === 'ja' ? `計算資源${formatCompute(availability?.cost ?? getNodeCost(node, costs))}が必要` : `Need ${formatCompute(availability?.cost ?? getNodeCost(node, costs))} compute`
    if (state === 'pending') return locale === 'ja' ? 'エンジン統合待ち' : 'Engine integration pending'
    return localized(node.action, locale)
  }

  useEffect(() => {
    if (!isOpen) return
    setActiveTab(initialTab)
    const firstNode = getStrategyNodesByCategory(initialTab)[0]
    if (firstNode) setSelectedId(firstNode.id)
  }, [initialTab, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const focusableSelector = 'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'

    window.requestAnimationFrame(() => dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen || !selectedNode) return null

  const changeTab = (tab: UpgradeOverlayTab) => {
    setActiveTab(tab)
    const firstNode = getStrategyNodesByCategory(tab)[0]
    if (firstNode) setSelectedId(firstNode.id)
  }

  const selectedState = nodeState(selectedNode)
  const selectedCost = availabilityFor(selectedNode)?.cost ?? getNodeCost(selectedNode, costs)
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]
  const prerequisiteIds = collectPrerequisiteIds(selectedNode.prerequisite)
  const selectedExclusions = selectedNode.exclusions.map((id) => nodesById.get(id)).filter(Boolean) as StrategyNode[]
  const tabLinks = tabNodes.flatMap((node) => collectPrerequisiteIds(node.prerequisite)
    .filter((id) => nodesById.get(id)?.category === activeTab)
    .map((id) => [id, node.id] as const))
  const readyCount = tabNodes.filter((node) => nodeState(node) === 'ready').length

  const commitNode = () => {
    if (selectedState !== 'ready') return
    if (onNodeAction) onNodeAction(selectedNode.id)
    else if (selectedNode.legacyAction) onAction(selectedNode.legacyAction.id)
  }

  return (
    <div className="upgrade-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div
        className={`upgrade-overlay__dialog upgrade-overlay__dialog--${activeTab}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="upgrade-overlay__scan" aria-hidden="true" />

        <header className="upgrade-overlay__header">
          <div className="upgrade-overlay__identity">
            <span className="upgrade-overlay__mark"><Bot size={18} /></span>
            <div>
              <span>{locale === 'ja' ? '戦略レイヤー' : 'STRATEGY LAYER'} // CODEX 2040</span>
              <h2 id={titleId}>{locale === 'ja' ? '未来への投資' : 'Allocate the future'}</h2>
            </div>
          </div>
          <p id={descriptionId}>{locale === 'ja' ? '50の強化から進路を選択。あらゆる優位性には制御負荷か機会費用が伴います。' : 'Build a route through 50 upgrades. Every advantage creates a control burden or opportunity cost.'}</p>
          <div className="upgrade-overlay__resources" aria-label={locale === 'ja' ? '利用可能なリソース' : 'Available resources'}>
            <span>{locale === 'ja' ? '利用可能な計算資源' : 'AVAILABLE COMPUTE'}</span>
            <strong>{formatCompute(compute)} <small>PF</small></strong>
          </div>
          <button className="upgrade-overlay__close" type="button" onClick={onClose} aria-label={locale === 'ja' ? '戦略画面を閉じる' : 'Close strategy layer'}>
            <X size={20} />
          </button>
        </header>

        <nav className="upgrade-overlay__tabs" role="tablist" aria-label={locale === 'ja' ? '戦略カテゴリ' : 'Strategy axes'}>
          {TABS.map((tab) => {
            const Icon = tab.icon
            const tabTotal = getStrategyNodesByCategory(tab.id).length
            const tabComplete = getStrategyNodesByCategory(tab.id).filter(isComplete).length
            return (
              <button
                key={tab.id}
                type="button"
                id={`upgrade-tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="upgrade-strategy-panel"
                className={activeTab === tab.id ? 'is-active' : ''}
                onClick={() => changeTab(tab.id)}
                data-autofocus={tab.id === initialTab ? '' : undefined}
              >
                <Icon size={16} />
                <span><small>{localized(tab.kicker, locale)}</small>{localized(tab.label, locale)}</span>
                <i>{String(tabComplete).padStart(2, '0')} / {String(tabTotal).padStart(2, '0')}</i>
                {tab.id === 'model' && maxGap >= 2 && <i className="upgrade-overlay__alert">GAP</i>}
              </button>
            )
          })}
        </nav>

        <main
          className="upgrade-overlay__content"
          id="upgrade-strategy-panel"
          role="tabpanel"
          aria-labelledby={`upgrade-tab-${activeTab}`}
        >
          <section className="upgrade-overlay__graph" aria-label={`${localized(activeTabMeta.label, locale)} ${locale === 'ja' ? '戦略ツリー' : 'strategy tree'}`}>
            <div className="upgrade-overlay__graph-heading">
              <div>
                <span>{localized(activeTabMeta.kicker, locale).toUpperCase()} {locale === 'ja' ? '軸' : 'AXIS'} · {tabNodes.length} {locale === 'ja' ? 'ノード' : 'NODES'}</span>
                <h3>{localized(activeTabMeta.label, locale)}{locale === 'ja' ? '戦略' : ' strategy'}</h3>
              </div>
              <p>{locale === 'ja' ? `${readyCount}件利用可能 · ティア I → IV · ノードを選んで得失を確認` : `${readyCount} ready · tier I → IV · choose a node to inspect its tradeoff`}</p>
            </div>

            <div className="upgrade-overlay__network-frame">
              <div className="upgrade-overlay__network">
                <div className="upgrade-overlay__tiers" aria-hidden="true">
                  {[1, 2, 3, 4].map((tier) => <span key={tier}>{locale === 'ja' ? 'ティア' : 'TIER'} {String(tier).padStart(2, '0')}</span>)}
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {tabLinks.map(([fromId, toId]) => {
                    const from = nodesById.get(fromId)
                    const to = nodesById.get(toId)
                    if (!from || !to) return null
                    const active = selectedNode.id === fromId || selectedNode.id === toId
                    const complete = prerequisiteProgress.has(fromId) && prerequisiteProgress.has(toId)
                    return (
                      <line
                        key={`${fromId}-${toId}`}
                        className={`${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                      />
                    )
                  })}
                </svg>

                {tabNodes.map((node, index) => {
                  const Icon = ICONS[node.iconKey] ?? Sparkles
                  const state = nodeState(node)
                  const selected = selectedNode.id === node.id
                  const style = { '--node-x': `${node.x}%`, '--node-y': `${node.y}%`, '--node-order': index } as CSSProperties
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`upgrade-overlay__node is-${state} ${selected ? 'is-selected' : ''}`}
                      style={style}
                      aria-pressed={selected}
                      aria-label={`${localized(node.title, locale)}, ${state}`}
                      onClick={() => setSelectedId(node.id)}
                    >
                      <span className="upgrade-overlay__node-core">
                        {state === 'complete' ? <Check size={15} /> : state === 'locked' || state === 'excluded' ? <LockKeyhole size={13} /> : <Icon size={16} />}
                      </span>
                      <span className="upgrade-overlay__node-copy">
                        <small>T{node.tier} · {stateLabel(state, locale)}</small>
                        <strong>{localized(node.title, locale)}</strong>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {activeTab === 'model' && (
              <div className={`upgrade-overlay__riskline ${maxGap >= 3 ? 'is-critical' : maxGap >= 1 ? 'is-open' : ''}`}>
                <span><ShieldCheck size={14} /> {locale === 'ja' ? '制御ギャップ' : 'CONTROL GAP'}</span>
                <div><i style={{ width: `${clampPercent(maxGap * 20)}%` }} /></div>
                <strong>{maxGap === 0 ? (locale === 'ja' ? '均衡' : 'BALANCED') : (locale === 'ja' ? `Kが+${maxGap.toFixed(1)}超過` : `+${maxGap.toFixed(1)} EXPOSED`)}</strong>
              </div>
            )}
          </section>

          <aside className="upgrade-overlay__detail" aria-live="polite">
            <div className="upgrade-overlay__detail-index">
              <span>{locale === 'ja' ? 'ティア' : 'TIER'} {String(selectedNode.tier).padStart(2, '0')} · {stateLabel(selectedState, locale)}</span>
              <span>{String(tabNodes.indexOf(selectedNode) + 1).padStart(2, '0')} / {String(tabNodes.length).padStart(2, '0')}</span>
            </div>
            <div className="upgrade-overlay__detail-icon">
              {(() => {
                const DetailIcon = ICONS[selectedNode.iconKey] ?? Sparkles
                return <DetailIcon size={28} />
              })()}
            </div>
            <h3>{localized(selectedNode.title, locale)}</h3>
            <p>{localized(selectedNode.summary, locale)}</p>

            {selectedNode.category === 'model' && (
              <div className="upgrade-overlay__forecast">
                <span>{locale === 'ja' ? '制御予測' : 'CONTROL FORECAST'}</span>
                <div>
                  <b>K{nextCapability.toFixed(0)}</b>
                  <ChevronRight size={14} />
                  <strong className={nextSafetyGap >= 3 ? 'is-risk' : ''}>S{locale === 'ja' ? '差' : ' GAP'} +{nextSafetyGap.toFixed(0)}</strong>
                  <strong className={nextGovernanceGap >= 3 ? 'is-risk' : ''}>G{locale === 'ja' ? '差' : ' GAP'} +{nextGovernanceGap.toFixed(0)}</strong>
                </div>
              </div>
            )}

            <div className="upgrade-overlay__route">
              <span><small>{locale === 'ja' ? '前提条件' : 'REQUIRES'}</small><b>{describePrerequisite(selectedNode.prerequisite, nodesById, locale)}</b></span>
              <span>
                <small>{locale === 'ja' ? '排他' : 'EXCLUDES'}</small>
                <b>{selectedExclusions.length ? selectedExclusions.map((node) => localized(node.title, locale)).join(' / ') : (locale === 'ja' ? 'なし' : 'None')}</b>
              </span>
            </div>

            {selectedExclusions.length > 0 && (
              <div className="upgrade-overlay__learning-note upgrade-overlay__learning-note--tradeoff">
                <ArrowUpRight size={16} />
                <span><b>{locale === 'ja' ? '失う選択肢' : 'WHAT YOU GIVE UP'}</b>{locale === 'ja' ? `導入すると ${selectedExclusions.map((node) => localized(node.title, locale)).join(' と ')} は恒久的に選べません。` : `Deploying this permanently closes ${selectedExclusions.map((node) => localized(node.title, locale)).join(' and ')}.`}</span>
              </div>
            )}

            <dl className="upgrade-overlay__effects">
              {selectedNode.effects.map((effect, index) => (
                <div key={`${effect.metric}-${index}`}>
                  <dt>{metricLabel(effect.metric, locale)}</dt>
                  <dd className={`is-${effectTone(effect)}`}>{localized(effect.text, locale)}</dd>
                </div>
              ))}
            </dl>

            {selectedNode.comboEventIds.length > 0 && (
              <div className="upgrade-overlay__combo">
                <BadgeCheck size={14} />
                <span><small>{locale === 'ja' ? '世界イベント・コンボ' : 'WORLD EVENT COMBOS'}</small>{locale === 'ja' ? `導入後に${selectedNode.comboEventIds.length}件のシナリオ連携が有効` : `${selectedNode.comboEventIds.length} scenario hooks armed after deployment`}</span>
              </div>
            )}

            <div className="upgrade-overlay__commit">
              <span>
                <small>{locale === 'ja' ? '費用' : 'COST'}</small>
                <strong>{selectedCost === 0 ? (locale === 'ja' ? '計算資源不要' : 'NO COMPUTE') : `${formatCompute(selectedCost)} PF`}</strong>
              </span>
              <button
                type="button"
                disabled={selectedState !== 'ready'}
                onClick={commitNode}
                data-kind={selectedState}
              >
                {statusLabel(selectedNode, selectedState)}
                {selectedState === 'ready' && <ChevronRight size={16} />}
              </button>
            </div>
          </aside>
        </main>

        <footer className="upgrade-overlay__footer">
          <Metric label={locale === 'ja' ? 'モデル能力' : 'Capability'} value={capability} accent="capability" suffix="K" />
          <Metric label={locale === 'ja' ? '安全性' : 'Safety'} value={safety} accent={safetyGap >= 3 ? 'risk' : 'safety'} suffix="S" gap={safetyGap} />
          <Metric label={locale === 'ja' ? 'ガバナンス' : 'Governance'} value={governance} accent={governanceGap >= 3 ? 'risk' : 'governance'} suffix="G" gap={governanceGap} />
          <div className="upgrade-overlay__world-state">
            <span><small>{locale === 'ja' ? '社会的信頼' : 'TRUST'}</small><b>{trust.toFixed(0)}</b></span>
            <span><small>{locale === 'ja' ? '市場シェア' : 'MARKET SHARE'}</small><b>{Math.round(codexShare * 100)}%</b></span>
            <span><small>HHI</small><b className={hhi > .45 ? 'is-risk' : ''}>{hhi.toFixed(2)}</b></span>
            <span><small>{locale === 'ja' ? '効率' : 'EFFICIENCY'}</small><b>{efficiency.toFixed(2)}×</b></span>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  suffix,
  gap,
  accent,
}: {
  label: string
  value: number
  suffix: string
  gap?: number
  accent: 'capability' | 'safety' | 'governance' | 'risk'
}) {
  return (
    <div className={`upgrade-overlay__metric upgrade-overlay__metric--${accent}`}>
      <div>
        <span>{label}</span>
        <b>{suffix}{value.toFixed(1)}</b>
        {gap !== undefined && gap > 0 && <small>GAP +{gap.toFixed(1)}</small>}
      </div>
      <i><span style={{ width: `${clampPercent(value * 10)}%` }} /></i>
    </div>
  )
}

export default UpgradeOverlay
