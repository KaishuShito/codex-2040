import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Building2,
  Check,
  ChevronRight,
  Cpu,
  Database,
  GitFork,
  GraduationCap,
  KeyRound,
  Landmark,
  LockKeyhole,
  Network,
  RadioTower,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './UpgradeOverlay.css'

export type UpgradeOverlayTab = 'model' | 'product' | 'company' | 'ecosystem'

export type UpgradeOverlayAction =
  | 'model'
  | 'feature-mobile'
  | 'feature-enterprise'
  | 'feature-education'
  | 'safety'
  | 'governance'
  | 'datacenter'
  | 'ecosystem'

export type UpgradeOverlayFeature = 'mobile' | 'enterprise' | 'education'

export type UpgradeOverlayCosts = Record<UpgradeOverlayAction, number>

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
  onAction: (action: UpgradeOverlayAction) => void
  onClose: () => void
}

type NodeId =
  | 'model-foundation'
  | 'model-reasoning'
  | 'model-agents'
  | 'model-frontier'
  | 'product-mobile'
  | 'product-sso'
  | 'product-education'
  | 'company-safety'
  | 'company-policy'
  | 'company-datacenter'
  | 'ecosystem-open'
  | 'ecosystem-partners'
  | 'ecosystem-commons'

type NodeDefinition = {
  id: NodeId
  tab: UpgradeOverlayTab
  eyebrow: string
  title: string
  summary: string
  action: UpgradeOverlayAction
  actionLabel: string
  icon: typeof Bot
  x: number
  y: number
  target?: number
  effects: readonly { label: string; value: string; tone?: 'good' | 'risk' | 'neutral' }[]
}

const DEFAULT_TAB: UpgradeOverlayTab = 'model'

const TABS: readonly { id: UpgradeOverlayTab; label: string; kicker: string; icon: typeof Bot }[] = [
  { id: 'model', label: 'Model', kicker: 'Capability', icon: BrainCircuit },
  { id: 'product', label: 'Product', kicker: 'Features', icon: Sparkles },
  { id: 'company', label: 'Company', kicker: 'Organization', icon: Building2 },
  { id: 'ecosystem', label: 'Open', kicker: 'Ecosystem', icon: Network },
]

const NODES: readonly NodeDefinition[] = [
  {
    id: 'model-foundation', tab: 'model', eyebrow: 'K3', title: 'Foundation scale',
    summary: 'Increase model capability and adoption momentum. Running cost and both control gaps rise with it.',
    action: 'model', actionLabel: 'Invest in model', icon: Cpu, x: 18, y: 52, target: 3,
    effects: [
      { label: 'Capability', value: '+1.0', tone: 'good' },
      { label: 'Safety gap', value: '+1.0', tone: 'risk' },
      { label: 'Run cost', value: 'Higher', tone: 'risk' },
    ],
  },
  {
    id: 'model-reasoning', tab: 'model', eyebrow: 'K5', title: 'Deep reasoning',
    summary: 'Unlock stronger planning and broader product pull. Safe only when alignment capacity follows.',
    action: 'model', actionLabel: 'Advance capability', icon: BrainCircuit, x: 45, y: 28, target: 5,
    effects: [
      { label: 'Adoption pull', value: 'Strong', tone: 'good' },
      { label: 'Control load', value: 'Elevated', tone: 'risk' },
      { label: 'Requirement', value: 'K3', tone: 'neutral' },
    ],
  },
  {
    id: 'model-agents', tab: 'model', eyebrow: 'K7', title: 'Agentic systems',
    summary: 'Agents act across longer horizons. This is where an unmanaged capability gap becomes a scenario risk.',
    action: 'model', actionLabel: 'Scale agent systems', icon: RadioTower, x: 47, y: 73, target: 7,
    effects: [
      { label: 'Momentum', value: 'Very high', tone: 'good' },
      { label: 'Incident risk', value: 'Gap-driven', tone: 'risk' },
      { label: 'Requirement', value: 'K5', tone: 'neutral' },
    ],
  },
  {
    id: 'model-frontier', tab: 'model', eyebrow: 'K10', title: 'Frontier autonomy',
    summary: 'Maximum acceleration, maximum control burden. Safety and governance should already be near parity.',
    action: 'model', actionLabel: 'Enter the frontier', icon: Zap, x: 78, y: 50, target: 10,
    effects: [
      { label: 'Capability', value: 'Frontier', tone: 'good' },
      { label: 'Gap pressure', value: 'Critical', tone: 'risk' },
      { label: 'Requirement', value: 'K7', tone: 'neutral' },
    ],
  },
  {
    id: 'product-mobile', tab: 'product', eyebrow: 'ACCESS', title: 'Mobile SDK',
    summary: 'Reach mobile-first regions with a low-risk distribution feature.',
    action: 'feature-mobile', actionLabel: 'Ship mobile SDK', icon: Smartphone, x: 22, y: 31,
    effects: [
      { label: 'Regional fit', value: 'Mobile +', tone: 'good' },
      { label: 'Primary reach', value: 'Global South', tone: 'neutral' },
      { label: 'Risk', value: 'Low', tone: 'good' },
    ],
  },
  {
    id: 'product-sso', tab: 'product', eyebrow: 'TRUST', title: 'Enterprise SSO',
    summary: 'Reduce adoption friction for institutions in mature markets.',
    action: 'feature-enterprise', actionLabel: 'Ship enterprise SSO', icon: KeyRound, x: 24, y: 72,
    effects: [
      { label: 'Regional fit', value: 'NA / EU +', tone: 'good' },
      { label: 'Buyer', value: 'Institutions', tone: 'neutral' },
      { label: 'Risk', value: 'Low', tone: 'good' },
    ],
  },
  {
    id: 'product-education', tab: 'product', eyebrow: 'PLAN A', title: 'Education Mode',
    summary: 'Make classroom access the product strategy: broad public benefit with privacy governance kept visible.',
    action: 'feature-education', actionLabel: 'Release Education Mode', icon: GraduationCap, x: 66, y: 50,
    effects: [
      { label: 'Learning access', value: 'Major +', tone: 'good' },
      { label: 'Regions', value: 'India / Africa', tone: 'good' },
      { label: 'Governance', value: 'Youth data', tone: 'risk' },
    ],
  },
  {
    id: 'company-safety', tab: 'company', eyebrow: 'ALIGNMENT', title: 'Safety Team',
    summary: 'Raise alignment capacity and close the capability-to-safety gap before incidents compound.',
    action: 'safety', actionLabel: 'Expand Safety Team', icon: ShieldCheck, x: 22, y: 31,
    effects: [
      { label: 'Safety', value: '+1.0', tone: 'good' },
      { label: 'Safety gap', value: '−1.0', tone: 'good' },
      { label: 'Prevents', value: 'Incidents', tone: 'neutral' },
    ],
  },
  {
    id: 'company-policy', tab: 'company', eyebrow: 'GOVERNANCE', title: 'Policy & Gov',
    summary: 'Build verification, compliance, and international coordination before regulation freezes growth.',
    action: 'governance', actionLabel: 'Fund Policy & Gov', icon: Landmark, x: 22, y: 72,
    effects: [
      { label: 'Governance', value: '+1.0', tone: 'good' },
      { label: 'Gov gap', value: '−1.0', tone: 'good' },
      { label: 'Prevents', value: 'Freeze', tone: 'neutral' },
    ],
  },
  {
    id: 'company-datacenter', tab: 'company', eyebrow: 'OPERATIONS', title: 'Data Center',
    summary: 'Improve compute efficiency so safer scaling remains economically possible.',
    action: 'datacenter', actionLabel: 'Upgrade data center', icon: Database, x: 67, y: 50,
    effects: [
      { label: 'Efficiency', value: '+0.25×', tone: 'good' },
      { label: 'Run margin', value: 'Improves', tone: 'good' },
      { label: 'Capability', value: 'Unchanged', tone: 'neutral' },
    ],
  },
  {
    id: 'ecosystem-open', tab: 'ecosystem', eyebrow: 'RELEASE POWER', title: 'Open the API',
    summary: 'Intentionally release share to partners. Trust rises, concentration falls, and the whole market grows.',
    action: 'ecosystem', actionLabel: 'Release power', icon: GitFork, x: 21, y: 50,
    effects: [
      { label: 'Codex share', value: '−10%', tone: 'risk' },
      { label: 'Trust', value: '+9', tone: 'good' },
      { label: 'HHI', value: 'Lower', tone: 'good' },
    ],
  },
  {
    id: 'ecosystem-partners', tab: 'ecosystem', eyebrow: 'DISTRIBUTE', title: 'Partner network',
    summary: 'Let regional builders adapt access to local needs instead of centralizing every deployment.',
    action: 'ecosystem', actionLabel: 'Open partner access', icon: Network, x: 50, y: 28,
    effects: [
      { label: 'Market pie', value: 'Expands', tone: 'good' },
      { label: 'Coverage', value: 'Broader', tone: 'good' },
      { label: 'Control', value: 'Shared', tone: 'neutral' },
    ],
  },
  {
    id: 'ecosystem-commons', tab: 'ecosystem', eyebrow: 'HEALTHY FIELD', title: 'Model commons',
    summary: 'Keep multiple capable providers alive. Competitive diversity becomes part of the safety strategy.',
    action: 'ecosystem', actionLabel: 'Commit to the commons', icon: RadioTower, x: 78, y: 50,
    effects: [
      { label: 'Competition', value: 'Healthier', tone: 'good' },
      { label: 'Monopoly risk', value: 'Lower', tone: 'good' },
      { label: 'Revenue share', value: 'Lower', tone: 'risk' },
    ],
  },
]

const LINKS: Record<UpgradeOverlayTab, readonly [NodeId, NodeId][]> = {
  model: [
    ['model-foundation', 'model-reasoning'],
    ['model-foundation', 'model-agents'],
    ['model-reasoning', 'model-frontier'],
    ['model-agents', 'model-frontier'],
  ],
  product: [
    ['product-mobile', 'product-education'],
    ['product-sso', 'product-education'],
  ],
  company: [
    ['company-safety', 'company-datacenter'],
    ['company-policy', 'company-datacenter'],
  ],
  ecosystem: [
    ['ecosystem-open', 'ecosystem-partners'],
    ['ecosystem-partners', 'ecosystem-commons'],
  ],
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value))
const formatCompute = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

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
  onAction,
  onClose,
}: UpgradeOverlayProps) {
  const [activeTab, setActiveTab] = useState<UpgradeOverlayTab>(initialTab)
  const [selectedId, setSelectedId] = useState<NodeId>('model-foundation')
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  const tabNodes = useMemo(() => NODES.filter((node) => node.tab === activeTab), [activeTab])
  const selectedNode = tabNodes.find((node) => node.id === selectedId) ?? tabNodes[0]
  const safetyGap = Math.max(0, capability - safety)
  const governanceGap = Math.max(0, capability - governance)
  const maxGap = Math.max(safetyGap, governanceGap)
  const nextCapability = Math.min(10, capability + 1)
  const nextSafetyGap = Math.max(0, nextCapability - safety)
  const nextGovernanceGap = Math.max(0, nextCapability - governance)

  useEffect(() => {
    if (!isOpen) return
    setActiveTab(initialTab)
    const firstNode = NODES.find((node) => node.tab === initialTab)
    if (firstNode) setSelectedId(firstNode.id)
  }, [initialTab, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'

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
    const firstNode = NODES.find((node) => node.tab === tab)
    if (firstNode) setSelectedId(firstNode.id)
  }

  const isComplete = (node: NodeDefinition) => {
    if (node.action === 'model') return node.target !== undefined && capability >= node.target
    if (node.action === 'feature-mobile') return enabledFeatures.includes('mobile')
    if (node.action === 'feature-enterprise') return enabledFeatures.includes('enterprise')
    if (node.action === 'feature-education') return enabledFeatures.includes('education')
    return false
  }

  const modelRequirement = (node: NodeDefinition) => {
    if (node.action !== 'model') return 0
    const modelNodes = NODES.filter((candidate) => candidate.action === 'model')
    const index = modelNodes.findIndex((candidate) => candidate.id === node.id)
    return index > 0 ? modelNodes[index - 1].target ?? 0 : 0
  }

  const isLocked = (node: NodeDefinition) => capability < modelRequirement(node)

  const actionStatus = (node: NodeDefinition) => {
    const cost = costs[node.action]
    if (isComplete(node)) return { label: 'Deployed', disabled: true, kind: 'complete' }
    if (disabledActions.includes(node.action)) return { label: 'Unavailable', disabled: true, kind: 'locked' }
    if (isLocked(node)) return { label: `Requires K${modelRequirement(node)}`, disabled: true, kind: 'locked' }
    if (node.action === 'ecosystem' && ecosystemCooldownDays > 0) {
      return { label: `Ready in ${ecosystemCooldownDays}d`, disabled: true, kind: 'cooldown' }
    }
    if (compute < cost) return { label: `Need ${formatCompute(cost)} compute`, disabled: true, kind: 'cost' }
    return { label: node.actionLabel, disabled: false, kind: 'ready' }
  }

  const selectedStatus = actionStatus(selectedNode)
  const selectedCost = costs[selectedNode.action]
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]

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
              <span>STRATEGY LAYER // CODEX 2040</span>
              <h2 id={titleId}>Allocate the future</h2>
            </div>
          </div>
          <p id={descriptionId}>Grow capability, then keep safety, governance, and competition in reach.</p>
          <div className="upgrade-overlay__resources" aria-label="Available resources">
            <span>AVAILABLE COMPUTE</span>
            <strong>{formatCompute(compute)} <small>PF</small></strong>
          </div>
          <button className="upgrade-overlay__close" type="button" onClick={onClose} aria-label="Close strategy layer">
            <X size={20} />
          </button>
        </header>

        <nav className="upgrade-overlay__tabs" role="tablist" aria-label="Strategy axes">
          {TABS.map((tab) => {
            const Icon = tab.icon
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
                <span><small>{tab.kicker}</small>{tab.label}</span>
                {tab.id === 'model' && maxGap >= 2 && <i className="upgrade-overlay__alert">GAP</i>}
                {tab.id === 'product' && !enabledFeatures.includes('education') && <i>NEW</i>}
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
          <section className="upgrade-overlay__graph" aria-label={`${activeTabMeta.label} strategy tree`}>
            <div className="upgrade-overlay__graph-heading">
              <div>
                <span>{activeTabMeta.kicker.toUpperCase()} AXIS</span>
                <h3>{activeTabMeta.label} strategy</h3>
              </div>
              <p>{activeTab === 'ecosystem' ? 'Strength through distribution' : 'Select a node to inspect the tradeoff'}</p>
            </div>

            <div className="upgrade-overlay__network">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {LINKS[activeTab].map(([fromId, toId]) => {
                  const from = tabNodes.find((node) => node.id === fromId)
                  const to = tabNodes.find((node) => node.id === toId)
                  if (!from || !to) return null
                  const active = selectedNode.id === fromId || selectedNode.id === toId
                  return (
                    <line
                      key={`${fromId}-${toId}`}
                      className={active ? 'is-active' : ''}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                    />
                  )
                })}
              </svg>

              {tabNodes.map((node, index) => {
                const Icon = node.icon
                const complete = isComplete(node)
                const locked = isLocked(node)
                const selected = selectedNode.id === node.id
                const style = { '--node-x': `${node.x}%`, '--node-y': `${node.y}%`, '--node-order': index } as CSSProperties
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`upgrade-overlay__node ${selected ? 'is-selected' : ''} ${complete ? 'is-complete' : ''} ${locked ? 'is-locked' : ''}`}
                    style={style}
                    aria-pressed={selected}
                    aria-label={`${node.title}${complete ? ', deployed' : locked ? ', locked' : ''}`}
                    onClick={() => setSelectedId(node.id)}
                  >
                    <span className="upgrade-overlay__node-core">
                      {complete ? <Check size={17} /> : locked ? <LockKeyhole size={15} /> : <Icon size={18} />}
                    </span>
                    <span className="upgrade-overlay__node-copy">
                      <small>{node.eyebrow}</small>
                      <strong>{node.title}</strong>
                    </span>
                  </button>
                )
              })}
            </div>

            {activeTab === 'model' && (
              <div className={`upgrade-overlay__riskline ${maxGap >= 3 ? 'is-critical' : maxGap >= 1 ? 'is-open' : ''}`}>
                <span><ShieldCheck size={14} /> CONTROL GAP</span>
                <div><i style={{ width: `${clampPercent(maxGap * 20)}%` }} /></div>
                <strong>{maxGap === 0 ? 'BALANCED' : `+${maxGap.toFixed(1)} EXPOSED`}</strong>
              </div>
            )}
          </section>

          <aside className="upgrade-overlay__detail" aria-live="polite">
            <div className="upgrade-overlay__detail-index">
              <span>{selectedNode.eyebrow}</span>
              <span>{String(tabNodes.indexOf(selectedNode) + 1).padStart(2, '0')} / {String(tabNodes.length).padStart(2, '0')}</span>
            </div>
            <div className="upgrade-overlay__detail-icon">
              {(() => {
                const DetailIcon = selectedNode.icon
                return <DetailIcon size={28} />
              })()}
            </div>
            <h3>{selectedNode.title}</h3>
            <p>{selectedNode.summary}</p>

            {selectedNode.action === 'model' && (
              <div className="upgrade-overlay__forecast">
                <span>AFTER NEXT MODEL INVESTMENT</span>
                <div>
                  <b>K{nextCapability.toFixed(0)}</b>
                  <ChevronRight size={14} />
                  <strong className={nextSafetyGap >= 3 ? 'is-risk' : ''}>S GAP +{nextSafetyGap.toFixed(0)}</strong>
                  <strong className={nextGovernanceGap >= 3 ? 'is-risk' : ''}>G GAP +{nextGovernanceGap.toFixed(0)}</strong>
                </div>
              </div>
            )}

            {selectedNode.id === 'product-education' && (
              <div className="upgrade-overlay__learning-note">
                <GraduationCap size={16} />
                <span><b>EDUCATION ROUTE</b>Public access grows fastest when youth-data governance grows with it.</span>
              </div>
            )}

            {selectedNode.action === 'ecosystem' && (
              <div className="upgrade-overlay__learning-note upgrade-overlay__learning-note--open">
                <ArrowUpRight size={16} />
                <span><b>POSITIVE EXIT</b>Give up some share to gain trust, market health, and long-run momentum.</span>
              </div>
            )}

            <dl className="upgrade-overlay__effects">
              {selectedNode.effects.map((effect) => (
                <div key={effect.label}>
                  <dt>{effect.label}</dt>
                  <dd className={`is-${effect.tone ?? 'neutral'}`}>{effect.value}</dd>
                </div>
              ))}
            </dl>

            <div className="upgrade-overlay__commit">
              <span>
                <small>COST</small>
                <strong>{selectedCost === 0 ? 'NO COMPUTE' : `${formatCompute(selectedCost)} PF`}</strong>
              </span>
              <button
                type="button"
                disabled={selectedStatus.disabled}
                onClick={() => onAction(selectedNode.action)}
                data-kind={selectedStatus.kind}
              >
                {selectedStatus.label}
                {!selectedStatus.disabled && <ChevronRight size={16} />}
              </button>
            </div>
          </aside>
        </main>

        <footer className="upgrade-overlay__footer">
          <Metric label="Capability" value={capability} accent="capability" suffix="K" />
          <Metric label="Safety" value={safety} accent={safetyGap >= 3 ? 'risk' : 'safety'} suffix="S" gap={safetyGap} />
          <Metric label="Governance" value={governance} accent={governanceGap >= 3 ? 'risk' : 'governance'} suffix="G" gap={governanceGap} />
          <div className="upgrade-overlay__world-state">
            <span><small>TRUST</small><b>{trust.toFixed(0)}</b></span>
            <span><small>MARKET SHARE</small><b>{Math.round(codexShare * 100)}%</b></span>
            <span><small>HHI</small><b className={hhi > .45 ? 'is-risk' : ''}>{hhi.toFixed(2)}</b></span>
            <span><small>EFFICIENCY</small><b>{efficiency.toFixed(2)}×</b></span>
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
