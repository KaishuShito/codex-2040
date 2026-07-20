import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  BarChart3,
  Blocks,
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
  Search,
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
  | 'feature-research'
  | 'feature-connectors'
  | 'feature-analysis'
  | 'safety'
  | 'governance'
  | 'datacenter'
  | 'ecosystem'

export type UpgradeOverlayFeature = 'mobile' | 'enterprise' | 'education' | 'research' | 'connectors' | 'analysis'

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
  | 'product-research'
  | 'product-connectors'
  | 'product-analysis'
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
  { id: 'model', label: 'モデル', kicker: '性能', icon: BrainCircuit },
  { id: 'product', label: 'プロダクト', kicker: '機能', icon: Sparkles },
  { id: 'company', label: '組織', kicker: '体制', icon: Building2 },
  { id: 'ecosystem', label: 'オープン', kicker: 'エコシステム', icon: Network },
]

const NODES: readonly NodeDefinition[] = [
  {
    id: 'model-foundation', tab: 'model', eyebrow: 'K3', title: '基盤モデル',
    summary: 'Kと普及の勢いを高める。運用費とS/Gギャップも広がる。',
    action: 'model', actionLabel: 'モデルへ投資', icon: Cpu, x: 18, y: 52, target: 3,
    effects: [
      { label: 'K（性能）', value: '+1.0', tone: 'good' },
      { label: 'Sギャップ', value: '+1.0', tone: 'risk' },
      { label: '運用費', value: '増加', tone: 'risk' },
    ],
  },
  {
    id: 'model-reasoning', tab: 'model', eyebrow: 'K5', title: '高度な推論',
    summary: '計画力を高め、製品需要を広げる。Sの強化が追いついてこそ安全。',
    action: 'model', actionLabel: 'Kを強化', icon: BrainCircuit, x: 45, y: 28, target: 5,
    effects: [
      { label: '普及力', value: '大', tone: 'good' },
      { label: '制御負荷', value: '高', tone: 'risk' },
      { label: '条件', value: 'K3', tone: 'neutral' },
    ],
  },
  {
    id: 'model-agents', tab: 'model', eyebrow: 'K7', title: '自律エージェント',
    summary: 'より長期の仕事を自律実行する。放置したK–S/Gギャップが事故につながる段階。',
    action: 'model', actionLabel: 'エージェント拡張', icon: RadioTower, x: 47, y: 73, target: 7,
    effects: [
      { label: '勢い', value: '非常に大', tone: 'good' },
      { label: '事故リスク', value: 'ギャップ依存', tone: 'risk' },
      { label: '条件', value: 'K5', tone: 'neutral' },
    ],
  },
  {
    id: 'model-frontier', tab: 'model', eyebrow: 'K10', title: '最前線の自律性',
    summary: '加速は最大、制御負荷も最大。SとGをKに近づけてから進める。',
    action: 'model', actionLabel: '最前線へ進む', icon: Zap, x: 78, y: 50, target: 10,
    effects: [
      { label: 'K（性能）', value: '最前線', tone: 'good' },
      { label: 'ギャップ圧力', value: '危険', tone: 'risk' },
      { label: '条件', value: 'K7', tone: 'neutral' },
    ],
  },
  {
    id: 'product-mobile', tab: 'product', eyebrow: 'アクセス', title: 'モバイルSDK',
    summary: 'モバイル中心の地域へ、低リスクで利用経路を広げる。',
    action: 'feature-mobile', actionLabel: 'SDKを公開', icon: Smartphone, x: 14, y: 29,
    effects: [
      { label: '地域適性', value: 'モバイル＋', tone: 'good' },
      { label: '主な対象', value: 'グローバルサウス', tone: 'neutral' },
      { label: 'リスク', value: '低', tone: 'good' },
    ],
  },
  {
    id: 'product-sso', tab: 'product', eyebrow: '信頼', title: '企業向けSSO',
    summary: '成熟市場の組織で、導入時の手間を減らす。',
    action: 'feature-enterprise', actionLabel: 'SSOを公開', icon: KeyRound, x: 14, y: 73,
    effects: [
      { label: '地域適性', value: '北米/EU＋', tone: 'good' },
      { label: '利用者', value: '組織', tone: 'neutral' },
      { label: 'リスク', value: '低', tone: 'good' },
    ],
  },
  {
    id: 'product-education', tab: 'product', eyebrow: 'PLAN A', title: '教育モード',
    summary: '教室での利用を軸に、公共的価値と若年層データ保護を両立する。',
    action: 'feature-education', actionLabel: '教育モードを公開', icon: GraduationCap, x: 84, y: 51,
    effects: [
      { label: '学習機会', value: '大幅＋', tone: 'good' },
      { label: '地域', value: 'インド/アフリカ', tone: 'good' },
      { label: 'ガバナンス', value: '若年層データ', tone: 'risk' },
    ],
  },
  {
    id: 'product-research', tab: 'product', eyebrow: '情報統合', title: '深掘り調査',
    summary: 'ウェブ・ファイル・連携先を横断し、出典付きレポートを作る。価値は高いが遅く、計算負荷も高い。',
    action: 'feature-research', actionLabel: '深掘り調査を公開', icon: Search, x: 42, y: 22,
    effects: [
      { label: '知的業務', value: '大幅＋', tone: 'good' },
      { label: '計算負荷', value: '高', tone: 'risk' },
      { label: '信頼条件', value: '出典', tone: 'neutral' },
    ],
  },
  {
    id: 'product-connectors', tab: 'product', eyebrow: '文脈', title: 'アプリ連携',
    summary: '許可済みの業務データと操作をつなぐ。普及するほど権限管理と保持方針が課題になる。',
    action: 'feature-connectors', actionLabel: 'アプリ連携を公開', icon: Blocks, x: 42, y: 73,
    effects: [
      { label: '業務適合', value: '大幅＋', tone: 'good' },
      { label: '企業需要', value: '強', tone: 'good' },
      { label: 'データ統治', value: '必須', tone: 'risk' },
    ],
  },
  {
    id: 'product-analysis', tab: 'product', eyebrow: '計算ツール', title: 'データ分析',
    summary: 'ファイル上でコードを実行し、数値分析やグラフ作成を行う。多様な専門職でKを活かせる。',
    action: 'feature-analysis', actionLabel: 'データ分析を公開', icon: BarChart3, x: 66, y: 73,
    effects: [
      { label: '専門利用', value: '広く＋', tone: 'good' },
      { label: '成果物', value: '図表/ファイル', tone: 'good' },
      { label: 'ツールリスク', value: '中', tone: 'risk' },
    ],
  },
  {
    id: 'company-safety', tab: 'company', eyebrow: '整合性', title: '安全対策チーム',
    summary: '安全対策を高め、事故が連鎖する前にK–Sギャップを縮める。',
    action: 'safety', actionLabel: '安全対策を強化', icon: ShieldCheck, x: 22, y: 31,
    effects: [
      { label: 'S（安全）', value: '+1.0', tone: 'good' },
      { label: 'Sギャップ', value: '−1.0', tone: 'good' },
      { label: '防止', value: '事故', tone: 'neutral' },
    ],
  },
  {
    id: 'company-policy', tab: 'company', eyebrow: 'ガバナンス', title: '政策・統治',
    summary: '規制で成長が止まる前に、検証・法令対応・国際連携を整える。',
    action: 'governance', actionLabel: '政策・統治に投資', icon: Landmark, x: 22, y: 72,
    effects: [
      { label: 'G（統治）', value: '+1.0', tone: 'good' },
      { label: 'Gギャップ', value: '−1.0', tone: 'good' },
      { label: '防止', value: '規制凍結', tone: 'neutral' },
    ],
  },
  {
    id: 'company-datacenter', tab: 'company', eyebrow: '運用', title: 'データセンター',
    summary: '計算効率を高め、安全な拡張を経済的に続けやすくする。',
    action: 'datacenter', actionLabel: '設備を強化', icon: Database, x: 67, y: 50,
    effects: [
      { label: '効率', value: '+0.25×', tone: 'good' },
      { label: '採算', value: '改善', tone: 'good' },
      { label: 'K（性能）', value: '不変', tone: 'neutral' },
    ],
  },
  {
    id: 'ecosystem-open', tab: 'ecosystem', eyebrow: '権限開放', title: 'APIを開放',
    summary: '意図的にシェアをパートナーへ渡す。信頼が上がり、集中が下がり、市場全体が育つ。',
    action: 'ecosystem', actionLabel: 'APIを開放', icon: GitFork, x: 21, y: 50,
    effects: [
      { label: 'Codexシェア', value: '−10%', tone: 'risk' },
      { label: '信頼', value: '+9', tone: 'good' },
      { label: 'HHI', value: '低下', tone: 'good' },
    ],
  },
  {
    id: 'ecosystem-partners', tab: 'ecosystem', eyebrow: '分散', title: '地域パートナー',
    summary: '展開を中央に集めず、地域の作り手が現地のニーズに合わせられるようにする。',
    action: 'ecosystem', actionLabel: '連携先に開放', icon: Network, x: 50, y: 28,
    effects: [
      { label: '市場規模', value: '拡大', tone: 'good' },
      { label: '対応地域', value: '拡大', tone: 'good' },
      { label: '管理', value: '共同', tone: 'neutral' },
    ],
  },
  {
    id: 'ecosystem-commons', tab: 'ecosystem', eyebrow: '健全市場', title: 'モデル・コモンズ',
    summary: '有力な提供者を複数残す。競争の多様性を安全戦略の一部にする。',
    action: 'ecosystem', actionLabel: 'コモンズへ参加', icon: RadioTower, x: 78, y: 50,
    effects: [
      { label: '競争', value: '健全化', tone: 'good' },
      { label: '独占リスク', value: '低下', tone: 'good' },
      { label: '収益シェア', value: '低下', tone: 'risk' },
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
    ['product-mobile', 'product-research'],
    ['product-sso', 'product-connectors'],
    ['product-research', 'product-education'],
    ['product-connectors', 'product-analysis'],
    ['product-analysis', 'product-education'],
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
    const firstNode = NODES.find((node) => node.tab === tab)
    if (firstNode) setSelectedId(firstNode.id)
  }

  const isComplete = (node: NodeDefinition) => {
    if (node.action === 'model') return node.target !== undefined && capability >= node.target
    if (node.action === 'feature-mobile') return enabledFeatures.includes('mobile')
    if (node.action === 'feature-enterprise') return enabledFeatures.includes('enterprise')
    if (node.action === 'feature-education') return enabledFeatures.includes('education')
    if (node.action === 'feature-research') return enabledFeatures.includes('research')
    if (node.action === 'feature-connectors') return enabledFeatures.includes('connectors')
    if (node.action === 'feature-analysis') return enabledFeatures.includes('analysis')
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
    if (isComplete(node)) return { label: '導入済み', disabled: true, kind: 'complete' }
    if (disabledActions.includes(node.action)) return { label: '利用不可', disabled: true, kind: 'locked' }
    if (isLocked(node)) return { label: `K${modelRequirement(node)}が必要`, disabled: true, kind: 'locked' }
    if (node.action === 'ecosystem' && ecosystemCooldownDays > 0) {
      return { label: `${ecosystemCooldownDays}日後に利用可`, disabled: true, kind: 'cooldown' }
    }
    if (compute < cost) return { label: `計算資源が${formatCompute(cost)}必要`, disabled: true, kind: 'cost' }
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
              <span>戦略レイヤー // CODEX 2040</span>
              <h2 id={titleId}>未来への投資</h2>
            </div>
          </div>
          <p id={descriptionId}>性能を伸ばしつつ、安全・統治・競争との均衡を保つ。</p>
          <div className="upgrade-overlay__resources" aria-label="利用可能なリソース">
            <span>利用可能な計算資源</span>
            <strong>{formatCompute(compute)} <small>PF</small></strong>
          </div>
          <button className="upgrade-overlay__close" type="button" onClick={onClose} aria-label="戦略画面を閉じる">
            <X size={20} />
          </button>
        </header>

        <nav className="upgrade-overlay__tabs" role="tablist" aria-label="戦略カテゴリ">
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
                {tab.id === 'model' && maxGap >= 2 && <i className="upgrade-overlay__alert">危険</i>}
                {tab.id === 'product' && !enabledFeatures.includes('education') && <i>新規</i>}
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
          <section className="upgrade-overlay__graph" aria-label={`${activeTabMeta.label}の戦略ツリー`}>
            <div className="upgrade-overlay__graph-heading">
              <div>
                <span>{activeTabMeta.kicker}軸</span>
                <h3>{activeTabMeta.label}戦略</h3>
              </div>
              <p>{activeTab === 'ecosystem' ? '分散が強さを生む' : 'ノードを選んで得失を確認'}</p>
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
                    aria-label={`${node.title}${complete ? '、導入済み' : locked ? '、ロック中' : ''}`}
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
                <span><ShieldCheck size={14} /> 制御ギャップ</span>
                <div><i style={{ width: `${clampPercent(maxGap * 20)}%` }} /></div>
                <strong>{maxGap === 0 ? '均衡' : `Kが+${maxGap.toFixed(1)}超過`}</strong>
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
                <span>次のモデル投資後</span>
                <div>
                  <b>K{nextCapability.toFixed(0)}</b>
                  <ChevronRight size={14} />
                  <strong className={nextSafetyGap >= 3 ? 'is-risk' : ''}>S差 +{nextSafetyGap.toFixed(0)}</strong>
                  <strong className={nextGovernanceGap >= 3 ? 'is-risk' : ''}>G差 +{nextGovernanceGap.toFixed(0)}</strong>
                </div>
              </div>
            )}

            {selectedNode.id === 'product-education' && (
              <div className="upgrade-overlay__learning-note">
                <GraduationCap size={16} />
                <span><b>教育ルート</b>若年層データの統治を整えるほど、教育アクセスは伸びる。</span>
              </div>
            )}

            {selectedNode.action === 'ecosystem' && (
              <div className="upgrade-overlay__learning-note upgrade-overlay__learning-note--open">
                <ArrowUpRight size={16} />
                <span><b>好循環</b>シェアを一部手放し、信頼・市場健全性・長期の勢いを得る。</span>
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
                <small>費用</small>
                <strong>{selectedCost === 0 ? '計算資源不要' : `${formatCompute(selectedCost)} PF`}</strong>
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
          <Metric label="性能" value={capability} accent="capability" suffix="K" />
          <Metric label="安全" value={safety} accent={safetyGap >= 3 ? 'risk' : 'safety'} suffix="S" gap={safetyGap} />
          <Metric label="統治" value={governance} accent={governanceGap >= 3 ? 'risk' : 'governance'} suffix="G" gap={governanceGap} />
          <div className="upgrade-overlay__world-state">
            <span><small>信頼</small><b>{trust.toFixed(0)}</b></span>
            <span><small>市場シェア</small><b>{Math.round(codexShare * 100)}%</b></span>
            <span><small>HHI</small><b className={hhi > .45 ? 'is-risk' : ''}>{hhi.toFixed(2)}</b></span>
            <span><small>効率</small><b>{efficiency.toFixed(2)}×</b></span>
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
        {gap !== undefined && gap > 0 && <small>差 +{gap.toFixed(1)}</small>}
      </div>
      <i><span style={{ width: `${clampPercent(value * 10)}%` }} /></i>
    </div>
  )
}

export default UpgradeOverlay
