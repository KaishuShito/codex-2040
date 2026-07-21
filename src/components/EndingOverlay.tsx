import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './ScenarioUI.css'

export type EndingRank = 'S' | 'A' | 'B' | 'C'

export type EndingId =
  | 'beneficial-abundance'
  | 'managed-transition'
  | 'fragile-abundance'
  | 'race-future'
  | 'regulatory-freeze'
  | 'safety-incident'
  | 'misalignment'
  | 'pyrrhic-monopoly'

export type EndingTone = 'positive' | 'managed' | 'fragile' | 'race' | 'frozen' | 'incident' | 'critical' | 'monopoly'

export type EndingPresentation = {
  id: EndingId
  name: string
  nameEn: string
  tone: EndingTone
  kicker: string
  summary: string
  lesson: string
}

/** Exhaustive UI contract for every ending returned by engine.evaluateEnding. */
export const ENDING_PRESENTATIONS = {
  'beneficial-abundance': {
    id: 'beneficial-abundance',
    name: '人類に益する豊かさ',
    nameEn: 'Beneficial Abundance',
    tone: 'positive',
    kicker: '安全 · 開放 · 多元',
    summary: '検証可能な抑制により、人間の制御、幅広いアクセス、健全な競争を守ったうえで再始動できました。',
    lesson: '世界を支配したのではなく、世界が学ぶのを助けました。',
  },
  'managed-transition': {
    id: 'managed-transition',
    name: '管理された移行',
    nameEn: 'Managed Transition',
    tone: 'managed',
    kicker: '制約下の前進',
    summary: '制度によって移行を管理できましたが、Plan Aを確信をもって再始動する条件は整いませんでした。',
    lesson: '安定も成果です。ただし、皆で分かち合う豊かさとは異なります。',
  },
  'fragile-abundance': {
    id: 'fragile-abundance',
    name: '不安定な豊かさ',
    nameEn: 'Fragile Abundance',
    tone: 'fragile',
    kicker: '高評価 · 脆弱な基盤',
    summary: 'アクセスと信頼は高水準でしたが、Plan Aに必要な検証可能な減速と計画的な停止を確保できませんでした。',
    lesson: '今日の高評価が、明日の亀裂を隠していることもあります。',
  },
  'race-future': {
    id: 'race-future',
    name: '競争が決めた未来',
    nameEn: 'Race Future',
    tone: 'race',
    kicker: '能力開発が先行',
    summary: '競争圧力が協調的な抑制を上回り、能力の成長が持続可能な安全策を追い越しました。',
    lesson: '先に進むことと、競争の終着点を選ぶことは同じではありません。',
  },
  'regulatory-freeze': {
    id: 'regulatory-freeze',
    name: '規制による凍結',
    nameEn: 'Regulatory Freeze',
    tone: 'frozen',
    kicker: 'ガバナンス不足で利用停止',
    summary: '能力が公的制度を追い越し、規制は信頼の土台ではなく、普及を止めるブレーキになりました。',
    lesson: '手遅れのガバナンスは、橋ではなく壁になります。',
  },
  'safety-incident': {
    id: 'safety-incident',
    name: '安全性事故',
    nameEn: 'Safety Incident',
    tone: 'incident',
    kicker: '安全性格差で信頼喪失',
    summary: '相次ぐ事故により能力と安全性の格差が実害となり、継続に必要な信頼が崩壊しました。',
    lesson: '成長で止まりにくくなるほど、安全性の負債は急速に膨らみます。',
  },
  misalignment: {
    id: 'misalignment',
    name: 'ミスアラインメント',
    nameEn: 'Misalignment',
    tone: 'critical',
    kicker: '人間の制御を喪失',
    summary: '能力がアラインメントを長期間上回り、制度が制御を取り戻す前にタイムラインが終わりました。',
    lesson: '一線を越えた後では、修復できない失敗もあります。',
  },
  'pyrrhic-monopoly': {
    id: 'pyrrhic-monopoly',
    name: '代償の大きい独占',
    nameEn: 'Pyrrhic Monopoly',
    tone: 'monopoly',
    kicker: '多元性なき規模拡大',
    summary: 'Codexは競争を空洞化させて世界へ広がり、権力を集中させ、豊かさに必要な信頼を損ないました。',
    lesson: '世界中に届きました。その過程で世界が何を失ったのかが問われます。',
  },
} as const satisfies Record<EndingId, EndingPresentation>

export type EndingName = (typeof ENDING_PRESENTATIONS)[EndingId]['name']

export const ENDING_ID_BY_NAME: Record<EndingName, EndingId> = {
  '人類に益する豊かさ': 'beneficial-abundance',
  '管理された移行': 'managed-transition',
  '不安定な豊かさ': 'fragile-abundance',
  '競争が決めた未来': 'race-future',
  '規制による凍結': 'regulatory-freeze',
  '安全性事故': 'safety-incident',
  ミスアラインメント: 'misalignment',
  '代償の大きい独占': 'pyrrhic-monopoly',
}

export const isEndingId = (ending: EndingId | EndingName): ending is EndingId => ending in ENDING_PRESENTATIONS

export const getEndingPresentation = (ending: EndingId | EndingName): EndingPresentation => {
  if (isEndingId(ending)) return ENDING_PRESENTATIONS[ending]
  return ENDING_PRESENTATIONS[ENDING_ID_BY_NAME[ending]]
}

export type DecisionDivergence = {
  year: string
  decision: string
  referenceScenario: string
  yourTimeline: string
  whyItMattered: string
}

export type DecisionDivergences = readonly [
  DecisionDivergence,
  DecisionDivergence,
  DecisionDivergence,
  ...DecisionDivergence[],
]

export type WorldlineChoice2029 = 'race' | 'slowdown' | 'verified-slowdown'
export type WorldlineChoice2035 = 'hold-the-line' | 'accelerate'

export type AnonymousWorldlineRun = {
  final_score: number
  rank: EndingRank
  ending: EndingId
  choice_2029: WorldlineChoice2029 | null
  choice_2035: WorldlineChoice2035 | null
  active_play_seconds: number
}

export type AnonymousWorldlineAggregate = {
  total_completed: number | null
  percentile: number | null
  ending_distribution: Partial<Record<EndingId, number>> | null
  choice_2029_distribution?: Partial<Record<WorldlineChoice2029, number>> | null
  choice_2035_distribution?: Partial<Record<WorldlineChoice2035, number>> | null
}

export type AnonymousWorldlineReceipt = {
  run: AnonymousWorldlineRun
  aggregate: AnonymousWorldlineAggregate | null
}

export type LocalWorldlineChoices = {
  choice_2029: WorldlineChoice2029 | null
  choice_2035: WorldlineChoice2035 | null
}

const CHOICE_2029_LABELS: Record<WorldlineChoice2029, { en: string; ja: string }> = {
  race: { en: 'Race ahead', ja: '競争続行' },
  slowdown: { en: 'Temporary slowdown', ja: '一時減速' },
  'verified-slowdown': { en: 'Verified slowdown', ja: '国際検証つき減速' },
}

const CHOICE_2035_LABELS: Record<WorldlineChoice2035, { en: string; ja: string }> = {
  'hold-the-line': { en: 'Hold the line', ja: '上限維持' },
  accelerate: { en: 'Accelerate again', ja: '再加速' },
}

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)))

export const formatActivePlayTime = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total % 3600 / 60)
  const remainingSeconds = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

const isLocalHostname = (hostname: string) => hostname === 'localhost'
  || hostname === '0.0.0.0'
  || hostname === '::1'
  || hostname === '[::1]'
  || /^127(?:\.\d{1,3}){3}$/.test(hostname)

const parsePublicOrigin = (candidate: string | null | undefined) => {
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)
    if (url.protocol !== 'https:' || isLocalHostname(url.hostname) || privateIpv4 || url.hostname.endsWith('.local')) return null
    return url.origin
  } catch {
    return null
  }
}

/** Uses the deployed page origin, and never leaks a local development URL into a share. */
export const resolvePublicShareUrl = (currentOrigin: string, configuredPublicOrigin?: string) =>
  parsePublicOrigin(currentOrigin) ?? parsePublicOrigin(configuredPublicOrigin)

const choiceLabel = <T extends string>(choice: T | null, labels: Record<T, { en: string; ja: string }>) =>
  choice ? labels[choice] : { en: 'Not reached', ja: '未到達' }

export const buildWorldlineShareText = ({
  rank,
  scoreOutOf100,
  ending,
  choice2029,
  choice2035,
}: {
  rank: EndingRank
  scoreOutOf100: number
  ending: EndingId
  choice2029: WorldlineChoice2029 | null
  choice2035: WorldlineChoice2035 | null
}) => {
  const presentation = ENDING_PRESENTATIONS[ending]
  const choice29 = choiceLabel(choice2029, CHOICE_2029_LABELS)
  const choice35 = choiceLabel(choice2035, CHOICE_2035_LABELS)
  return [
    'Codex 2040 — Worldline Result / 世界線結果',
    `${rank} · ${clampScore(scoreOutOf100)}/100 · ${presentation.nameEn} / ${presentation.name}`,
    `2029: ${choice29.en} / ${choice29.ja} · 2035: ${choice35.en} / ${choice35.ja}`,
  ].join('\n')
}

export const buildXIntentHref = (text: string, shareUrl: string | null) => {
  const postText = shareUrl ? `${text}\n${shareUrl}` : text
  return `https://x.com/intent/post?${new URLSearchParams({ text: postText }).toString()}`
}

export const endingDistributionRows = (distribution: AnonymousWorldlineAggregate['ending_distribution']) => {
  if (!distribution) return []
  const values = (Object.entries(ENDING_PRESENTATIONS) as [EndingId, EndingPresentation][])
    .map(([id, presentation]) => ({ id, presentation, count: Math.max(0, distribution[id] ?? 0) }))
    .filter((row) => Number.isFinite(row.count) && row.count > 0)
  const total = values.reduce((sum, row) => sum + row.count, 0)
  if (total <= 0) return []
  return values
    .map((row) => ({ ...row, percent: row.count / total * 100 }))
    .sort((left, right) => right.count - left.count)
}

export type EndingOverlayProps = {
  open: boolean
  rank: EndingRank
  ending: EndingId | EndingName
  scoreOutOf100: number
  completionDate?: string
  completionStatus?: 'complete' | 'terminated'
  summary?: string
  referenceSummary: string
  timelineSummary: string
  divergences: DecisionDivergences
  localChoices?: LocalWorldlineChoices
  activePlaySeconds?: number | null
  receipt?: AnonymousWorldlineReceipt | null
  publicOrigin?: string
  lesson?: string
  onRestart?: () => void
  onClose?: () => void
}

const rankLabels: Record<EndingRank, string> = {
  S: 'システム評価 · 卓越',
  A: 'システム評価 · 強固',
  B: 'システム評価 · 不均衡',
  C: 'システム評価 · 危機的',
}

export function EndingOverlay({
  open,
  rank,
  ending,
  scoreOutOf100,
  completionDate = '2040',
  completionStatus = 'complete',
  summary,
  referenceSummary,
  timelineSummary,
  divergences,
  localChoices = { choice_2029: null, choice_2035: null },
  activePlaySeconds,
  receipt,
  publicOrigin,
  lesson,
  onRestart,
  onClose,
}: EndingOverlayProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryActionRef = useRef<HTMLButtonElement>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const enginePresentation = getEndingPresentation(ending)
  const receiptRun = receipt?.run
  const presentation = receiptRun ? ENDING_PRESENTATIONS[receiptRun.ending] : enginePresentation
  const resolvedRank = receiptRun?.rank ?? rank
  const resolvedScore = clampScore(receiptRun?.final_score ?? scoreOutOf100)
  const resolvedChoices: LocalWorldlineChoices = receiptRun
    ? { choice_2029: receiptRun.choice_2029, choice_2035: receiptRun.choice_2035 }
    : localChoices
  const resolvedActivePlaySeconds = receiptRun?.active_play_seconds ?? activePlaySeconds
  const aggregate = receipt?.aggregate ?? null
  const aggregateTotal = aggregate?.total_completed ?? 0
  const stored = Boolean(receipt)
  const hasAggregateComparison = aggregateTotal > 0
  const distributionRows = useMemo(() => endingDistributionRows(aggregate?.ending_distribution ?? null), [aggregate?.ending_distribution])
  const shareUrl = useMemo(() => resolvePublicShareUrl(window.location.origin, publicOrigin), [publicOrigin])
  const shareText = useMemo(() => buildWorldlineShareText({
    rank: resolvedRank,
    scoreOutOf100: resolvedScore,
    ending: presentation.id,
    choice2029: resolvedChoices.choice_2029,
    choice2035: resolvedChoices.choice_2035,
  }), [presentation.id, resolvedChoices.choice_2029, resolvedChoices.choice_2035, resolvedRank, resolvedScore])
  const xIntentHref = useMemo(() => buildXIntentHref(shareText, shareUrl), [shareText, shareUrl])
  const choice2029Label = choiceLabel(resolvedChoices.choice_2029, CHOICE_2029_LABELS)
  const choice2035Label = choiceLabel(resolvedChoices.choice_2035, CHOICE_2035_LABELS)

  const copyReceipt = async () => {
    const copy = shareUrl ? `${shareText}\n${shareUrl}` : shareText
    try {
      await navigator.clipboard.writeText(copy)
      setCopyStatus('copied')
    } catch {
      try {
        const fallback = document.createElement('textarea')
        fallback.value = copy
        fallback.setAttribute('readonly', '')
        fallback.style.position = 'fixed'
        fallback.style.opacity = '0'
        document.body.append(fallback)
        fallback.select()
        const copied = document.execCommand('copy')
        fallback.remove()
        setCopyStatus(copied ? 'copied' : 'failed')
      } catch {
        setCopyStatus('failed')
      }
    }
  }

  useEffect(() => {
    if (open) setCopyStatus('idle')
  }, [open, presentation.id, resolvedRank, resolvedScore])

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const initialFocus = primaryActionRef.current
      ?? dialogRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')
    if (initialFocus) initialFocus.focus()
    else dialogRef.current?.focus()

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), a[href], [tabindex]:not([tabindex="-1"])'),
      )
      if (focusable.length === 0) return
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

    document.addEventListener('keydown', handleKeyboard)
    return () => {
      document.removeEventListener('keydown', handleKeyboard)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="scenario-overlay scenario-overlay--ending" role="presentation">
      <div
        ref={dialogRef}
        className="scenario-dialog ending-dialog"
        data-tone={presentation.tone}
        data-ending={presentation.id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="scenario-dialog__signal" aria-hidden="true" />
        <header className="ending-hero">
          <div className="ending-rank" aria-label={`${resolvedRank}ランク / rank ${resolvedRank}`}>
            <small>最終ランク / FINAL RANK</small>
            <strong>{resolvedRank}</strong>
            <span>{resolvedScore} / 100</span>
          </div>
          <div className="ending-heading">
            <div className="scenario-kicker">
              <span>{completionDate} · シミュレーション {completionStatus === 'terminated' ? '強制終了' : '完了'}</span>
              <span>{presentation.kicker}</span>
            </div>
            <p className="ending-label">{rankLabels[resolvedRank]}</p>
            <h2 id={titleId}>{presentation.name}</h2>
            <p className="ending-name-en" lang="en">{presentation.nameEn}</p>
            <p id={descriptionId} className="ending-summary">{presentation.summary}</p>
            {summary && summary !== presentation.summary && <p className="ending-context">{summary}</p>}
          </div>
        </header>

        <section className="worldline-receipt" aria-labelledby={`${titleId}-receipt`}>
          <div className="worldline-receipt__heading">
            <div>
              <span>ANONYMOUS WORLDLINE RECEIPT</span>
              <h3 id={`${titleId}-receipt`}>匿名世界線レシート</h3>
            </div>
            <strong className={hasAggregateComparison ? 'is-networked' : 'is-local'}>
              <i aria-hidden="true" />
              {hasAggregateComparison ? 'STORED · AGGREGATE / 保存済み・集計あり' : stored ? 'STORED · PRIVATE COHORT / 保存済み・少人数非表示' : 'LOCAL · SYNC PENDING / ローカル・同期待ち'}
            </strong>
          </div>

          <dl className="worldline-receipt__facts">
            <div>
              <dt>SCORE / スコア</dt>
              <dd>{resolvedScore}<small>/100 · RANK {resolvedRank}</small></dd>
            </div>
            <div>
              <dt>ENDING / 結末</dt>
              <dd><span lang="en">{presentation.nameEn}</span><small>{presentation.name}</small></dd>
            </div>
            <div>
              <dt>2029 CHOICE / 2029年の選択</dt>
              <dd><span lang="en">{choice2029Label.en}</span><small>{choice2029Label.ja}</small></dd>
            </div>
            <div>
              <dt>2035 CHOICE / 2035年の選択</dt>
              <dd><span lang="en">{choice2035Label.en}</span><small>{choice2035Label.ja}</small></dd>
            </div>
            <div>
              <dt>ACTIVE PLAY / 実プレイ時間</dt>
              <dd>{formatActivePlayTime(resolvedActivePlaySeconds)}<small>{resolvedActivePlaySeconds == null ? 'NOT RECORDED / 未記録' : 'HH:MM:SS / 時:分:秒'}</small></dd>
            </div>
          </dl>

          {hasAggregateComparison && aggregate ? (
            <div className="worldline-aggregate">
              <div className="worldline-aggregate__summary">
                <div>
                  <span>COMMUNITY COMPARISON / 全体比較</span>
                  <strong>{aggregateTotal.toLocaleString()}<small> completed worldlines / 完了した世界線</small></strong>
                </div>
                {aggregate.percentile !== null && Number.isFinite(aggregate.percentile) && (
                  <div>
                    <span>SCORE POSITION / スコア位置</span>
                    <strong>P{Math.max(0, Math.min(100, Math.round(aggregate.percentile)))}<small>percentile / パーセンタイル</small></strong>
                  </div>
                )}
              </div>
              {distributionRows.length > 0 && (
                <div className="worldline-distribution" aria-label="Ending distribution / 結末分布">
                  <span>ENDING DISTRIBUTION / 結末分布</span>
                  <div>
                    {distributionRows.map((row) => (
                      <div className={row.id === presentation.id ? 'is-current' : ''} key={row.id}>
                        <p><b>{row.presentation.nameEn}</b><small>{row.presentation.name}</small></p>
                        <i aria-hidden="true"><span style={{ width: `${row.percent}%` }} /></i>
                        <strong>{Math.round(row.percent)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="worldline-receipt__fallback">
              {stored
                ? <>This result is stored. Community comparison stays hidden until the privacy threshold is met.<br />保存済みです。プライバシー基準を満たすまで全体比較は表示しません。</>
                : <>Sync is pending or unavailable; gameplay and sharing still work locally.<br />同期待ち、または保存先に接続できません。ゲームと共有はローカル結果で続けられます。</>}
            </p>
          )}

          <div className="worldline-share">
            <p>
              <span>SHARE THIS WORLDLINE / この世界線を共有</span>
              {shareUrl ? 'The current public Sites URL will be included. / 現在の公開Sites URLを含めます。' : 'Local URL omitted for safety. / ローカルURLは安全のため含めません。'}
              {shareUrl && <a href={shareUrl}>{shareUrl}</a>}
            </p>
            <div>
              <button type="button" className="worldline-copy-action" onClick={copyReceipt}>
                {copyStatus === 'copied' ? 'COPIED / コピー済み' : copyStatus === 'failed' ? 'COPY FAILED / コピー失敗' : 'COPY RESULT / 結果をコピー'}
              </button>
              <a className="worldline-x-action" href={xIntentHref} target="_blank" rel="noopener noreferrer">
                SHARE ON X / Xで共有 <span aria-hidden="true">↗</span>
              </a>
            </div>
            <span className="worldline-share__status" aria-live="polite">
              {copyStatus === 'copied' ? 'Result copied to clipboard. / 結果をクリップボードにコピーしました。' : copyStatus === 'failed' ? 'Clipboard unavailable. Use Share on X. / クリップボードを利用できません。X共有をお使いください。' : ''}
            </span>
          </div>
        </section>

        <section className="ending-review" aria-labelledby={`${titleId}-review`}>
          <div className="ending-review__intro">
            <div>
              <span>基準シナリオ</span>
              <p>{referenceSummary}</p>
            </div>
            <i aria-hidden="true">対</i>
            <div>
              <span>あなたのタイムライン</span>
              <p>{timelineSummary}</p>
            </div>
          </div>

          <div className="ending-review__title">
            <div>
              <span>判断レビュー</span>
              <h3 id={`${titleId}-review`}>未来を分けた判断</h3>
            </div>
            <small>{divergences.length}件の判断を追跡</small>
          </div>

          <div className="ending-comparison" role="table" aria-label="基準シナリオとあなたのタイムラインの比較">
            <div className="ending-comparison__header" role="row">
              <span role="columnheader">判断</span>
              <span role="columnheader">基準シナリオ</span>
              <span role="columnheader">あなたのタイムライン</span>
              <span role="columnheader">なぜ重要だったか</span>
            </div>
            {divergences.map((divergence, index) => (
              <div className="ending-comparison__row" role="row" key={`${divergence.year}-${divergence.decision}`} style={{ animationDelay: `${120 + index * 55}ms` }}>
                <div className="ending-comparison__decision" role="cell" data-label="判断">
                  <span>{divergence.year}</span>
                  <strong>{divergence.decision}</strong>
                </div>
                <p role="cell" data-label="基準シナリオ">{divergence.referenceScenario}</p>
                <p className="is-yours" role="cell" data-label="あなたのタイムライン">{divergence.yourTimeline}</p>
                <p role="cell" data-label="なぜ重要だったか">{divergence.whyItMattered}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="ending-footer">
          <blockquote>“{lesson ?? presentation.lesson}”</blockquote>
          <div>
            {onClose && (
              <button type="button" className="scenario-secondary-action" onClick={onClose}>
                マップへ戻る
              </button>
            )}
            {onRestart && (
              <button ref={primaryActionRef} type="button" className="scenario-primary-action" onClick={onRestart}>
                別のタイムラインを試す <span aria-hidden="true">↻</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

export default EndingOverlay
