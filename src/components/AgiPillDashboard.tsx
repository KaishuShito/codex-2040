import './AgiPillDashboard.css'

export type AgiPillLayer = 'earth' | 'orbit' | 'solar'
export type AgiPillSignal = 'stable' | 'accelerating' | 'constrained' | 'critical'

export type AgiPillMetric = {
  id: string
  label: string
  value: string
  detail: string
  signal?: AgiPillSignal
}

export type AgiPillCausalCard = {
  id: string
  cause: string
  effect: string
  explanation: string
  recovery?: string
  signal?: AgiPillSignal
}

export type AgiPillMilestone = {
  id: string
  label: string
  status: 'complete' | 'active' | 'locked'
}

export type AgiPillDashboardProps = {
  locale: 'ja' | 'en'
  activeLayer: AgiPillLayer
  unlockedLayers: readonly AgiPillLayer[]
  onLayerChange: (layer: AgiPillLayer) => void
  metrics: readonly AgiPillMetric[]
  causalCards: readonly AgiPillCausalCard[]
  milestones: readonly AgiPillMilestone[]
  dysonProgress: number
  frontierTitle: string
  frontierDetail: string
  timeLabel?: string
}

const COPY = {
  ja: {
    eyebrow: 'AGIピル // 文明スケール管制',
    layers: { earth: '地球', orbit: '軌道', solar: '太陽系' },
    layerHint: { earth: '産業基盤', orbit: '自律生産圏', solar: '分岐文明' },
    telemetry: '相互加速テレメトリ',
    industry: '地球産業ループ',
    rival: '競合圧力',
    rivalQuiet: '重大な競合シグナルなし',
    causal: '因果と回復可能な手',
    quiet: '現在、重大な因果シグナルはありません。',
    causes: 'が',
    dyson: '第一スウォーム点火閾値',
    dysonContext: 'これは終点ではない。地球文明の制約を抜け始めた序の口。',
    next: '次のフロンティア',
    trajectory: '文明軌道',
    locked: '未到達',
  },
  en: {
    eyebrow: 'AGI PILL // CIVILIZATION SCALE CONTROL',
    layers: { earth: 'Earth', orbit: 'Orbit', solar: 'Solar System' },
    layerHint: { earth: 'Industrial base', orbit: 'Autonomous production', solar: 'Branching civilization' },
    telemetry: 'Coupled acceleration telemetry',
    industry: 'Earth industry loop',
    rival: 'Rival pressure',
    rivalQuiet: 'No major rival signal',
    causal: 'Causes and recoverable moves',
    quiet: 'No major causal signals at present.',
    causes: 'drives',
    dyson: 'First swarm ignition threshold',
    dysonContext: 'This is not the end. It is the first release from Earth-bound constraints.',
    next: 'Next frontier',
    trajectory: 'Civilization trajectory',
    locked: 'Locked',
  },
} as const

const clampProgress = (value: number) => Math.min(100, Math.max(0, value))

function SpaceSchematic({
  activeLayer,
  dysonProgress,
  locale,
  metrics,
  causalCards,
}: Pick<AgiPillDashboardProps, 'activeLayer' | 'dysonProgress' | 'locale' | 'metrics' | 'causalCards'>) {
  const swarm = Array.from({ length: 24 }, (_, index) => index)
  const copy = COPY[locale]
  const industryMetrics = metrics.slice(0, 3)
  const rivalSignal = causalCards.find((card) => card.signal === 'critical')
    ?? causalCards.find((card) => card.signal === 'constrained')
    ?? causalCards[0]
  return (
    <div className="agi-pill-dashboard__schematic" data-layer={activeLayer} aria-hidden="true">
      <div className="agi-pill-dashboard__grid" />
      <div className="agi-pill-dashboard__sun"><i /></div>
      <div className="agi-pill-dashboard__orbit agi-pill-dashboard__orbit--inner" />
      <div className="agi-pill-dashboard__orbit agi-pill-dashboard__orbit--earth" />
      <div className="agi-pill-dashboard__orbit agi-pill-dashboard__orbit--outer" />
      <div className="agi-pill-dashboard__earth"><i /></div>
      <div className="agi-pill-dashboard__moon" />
      <div className="agi-pill-dashboard__mars" />
      <div className="agi-pill-dashboard__swarm" style={{ '--swarm-progress': `${clampProgress(dysonProgress)}%` } as React.CSSProperties}>
        {swarm.map((index) => <i key={index} style={{ '--particle': index } as React.CSSProperties} />)}
      </div>
      {activeLayer === 'earth' && (
        <div className="agi-pill-dashboard__earth-overlay">
          <section className="agi-pill-dashboard__industry-loop">
            <header><i />{copy.industry}</header>
            <ol>
              {industryMetrics.map((metric) => (
                <li key={metric.id} data-signal={metric.signal ?? 'stable'}>
                  <span>{metric.label}</span><strong>{metric.value}</strong>
                </li>
              ))}
            </ol>
          </section>
          <section className="agi-pill-dashboard__rival-pressure" data-signal={rivalSignal?.signal ?? 'stable'}>
            <header>{copy.rival}<i /></header>
            {rivalSignal
              ? <><strong>{rivalSignal.cause} → {rivalSignal.effect}</strong><small>{rivalSignal.explanation}</small></>
              : <strong>{copy.rivalQuiet}</strong>}
          </section>
        </div>
      )}
      <div className="agi-pill-dashboard__scanline" />
    </div>
  )
}

export default function AgiPillDashboard({
  locale,
  activeLayer,
  unlockedLayers,
  onLayerChange,
  metrics,
  causalCards,
  milestones,
  dysonProgress,
  frontierTitle,
  frontierDetail,
  timeLabel,
}: AgiPillDashboardProps) {
  const copy = COPY[locale]
  const progress = clampProgress(dysonProgress)

  return (
    <section className="agi-pill-dashboard" aria-label={copy.eyebrow} data-layer={activeLayer}>
      <header className="agi-pill-dashboard__header">
        <span><i />{copy.eyebrow}</span>
        {timeLabel && <time>{timeLabel}</time>}
      </header>

      <nav className="agi-pill-dashboard__layers" aria-label={locale === 'ja' ? '文明スケール' : 'Civilization scale'}>
        {(Object.keys(copy.layers) as AgiPillLayer[]).map((layer) => {
          const unlocked = unlockedLayers.includes(layer)
          return (
            <button
              key={layer}
              type="button"
              className={layer === activeLayer ? 'is-active' : ''}
              aria-pressed={layer === activeLayer}
              disabled={!unlocked}
              onClick={() => onLayerChange(layer)}
            >
              <small>0{layer === 'earth' ? 1 : layer === 'orbit' ? 2 : 3}</small>
              <b>{copy.layers[layer]}</b>
              <span>{unlocked ? copy.layerHint[layer] : copy.locked}</span>
            </button>
          )
        })}
      </nav>

      <div className="agi-pill-dashboard__main">
        <SpaceSchematic activeLayer={activeLayer} dysonProgress={progress} locale={locale} metrics={metrics} causalCards={causalCards} />
        <section className="agi-pill-dashboard__telemetry" aria-labelledby="agi-pill-telemetry-title">
          <h2 id="agi-pill-telemetry-title">{copy.telemetry}</h2>
          <div className="agi-pill-dashboard__metrics">
            {metrics.map((metric) => (
              <article key={metric.id} data-signal={metric.signal ?? 'stable'}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="agi-pill-dashboard__causality" aria-labelledby="agi-pill-causality-title">
        <h2 id="agi-pill-causality-title">{copy.causal}</h2>
        <div>
          {causalCards.length === 0 && <p>{copy.quiet}</p>}
          {causalCards.map((card) => (
            <article key={card.id} data-signal={card.signal ?? 'stable'}>
              <header><b>{card.cause}</b><i aria-hidden="true">→</i><strong>{card.effect}</strong></header>
              <p>{card.explanation}</p>
              {card.recovery && <footer><span>↳</span>{card.recovery}</footer>}
            </article>
          ))}
        </div>
      </section>

      <section className="agi-pill-dashboard__frontier" aria-label={copy.next}>
        <div className="agi-pill-dashboard__dyson">
          <span><b>{copy.dyson}</b><strong>{progress.toFixed(0)}%</strong></span>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
          <small>{copy.dysonContext}</small>
        </div>
        <article>
          <span>{copy.next}</span>
          <h2>{frontierTitle}</h2>
          <p>{frontierDetail}</p>
        </article>
      </section>

      <footer className="agi-pill-dashboard__trajectory">
        <span>{copy.trajectory}</span>
        <ol>
          {milestones.map((milestone) => <li key={milestone.id} data-status={milestone.status}><i /><span>{milestone.label}</span></li>)}
        </ol>
      </footer>
    </section>
  )
}
