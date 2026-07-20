import { useEffect, useId, useRef } from 'react'
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
    tone: 'positive',
    kicker: '安全 · 開放 · 多元',
    summary: '検証可能な抑制により、人間の制御、幅広いアクセス、健全な競争を守ったうえで再始動できました。',
    lesson: '世界を支配したのではなく、世界が学ぶのを助けました。',
  },
  'managed-transition': {
    id: 'managed-transition',
    name: '管理された移行',
    tone: 'managed',
    kicker: '制約下の前進',
    summary: '制度によって移行を管理できましたが、Plan Aを確信をもって再始動する条件は整いませんでした。',
    lesson: '安定も成果です。ただし、皆で分かち合う豊かさとは異なります。',
  },
  'fragile-abundance': {
    id: 'fragile-abundance',
    name: '不安定な豊かさ',
    tone: 'fragile',
    kicker: '高評価 · 脆弱な基盤',
    summary: 'アクセスと信頼は高水準でしたが、Plan Aに必要な検証可能な減速と計画的な停止を確保できませんでした。',
    lesson: '今日の高評価が、明日の亀裂を隠していることもあります。',
  },
  'race-future': {
    id: 'race-future',
    name: '競争が決めた未来',
    tone: 'race',
    kicker: '能力開発が先行',
    summary: '競争圧力が協調的な抑制を上回り、能力の成長が持続可能な安全策を追い越しました。',
    lesson: '先に進むことと、競争の終着点を選ぶことは同じではありません。',
  },
  'regulatory-freeze': {
    id: 'regulatory-freeze',
    name: '規制による凍結',
    tone: 'frozen',
    kicker: 'ガバナンス不足で利用停止',
    summary: '能力が公的制度を追い越し、規制は信頼の土台ではなく、普及を止めるブレーキになりました。',
    lesson: '手遅れのガバナンスは、橋ではなく壁になります。',
  },
  'safety-incident': {
    id: 'safety-incident',
    name: '安全性事故',
    tone: 'incident',
    kicker: '安全性格差で信頼喪失',
    summary: '相次ぐ事故により能力と安全性の格差が実害となり、継続に必要な信頼が崩壊しました。',
    lesson: '成長で止まりにくくなるほど、安全性の負債は急速に膨らみます。',
  },
  misalignment: {
    id: 'misalignment',
    name: 'ミスアラインメント',
    tone: 'critical',
    kicker: '人間の制御を喪失',
    summary: '能力がアラインメントを長期間上回り、制度が制御を取り戻す前にタイムラインが終わりました。',
    lesson: '一線を越えた後では、修復できない失敗もあります。',
  },
  'pyrrhic-monopoly': {
    id: 'pyrrhic-monopoly',
    name: '代償の大きい独占',
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
  lesson,
  onRestart,
  onClose,
}: EndingOverlayProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryActionRef = useRef<HTMLButtonElement>(null)
  const presentation = getEndingPresentation(ending)

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
          <div className="ending-rank" aria-label={`${rank}ランク`}>
            <small>最終ランク</small>
            <strong>{rank}</strong>
            <span>{Math.max(0, Math.min(100, Math.round(scoreOutOf100)))} / 100</span>
          </div>
          <div className="ending-heading">
            <div className="scenario-kicker">
              <span>{completionDate} · シミュレーション {completionStatus === 'terminated' ? '強制終了' : '完了'}</span>
              <span>{presentation.kicker}</span>
            </div>
            <p className="ending-label">{rankLabels[rank]}</p>
            <h2 id={titleId}>{presentation.name}</h2>
            <p id={descriptionId} className="ending-summary">{presentation.summary}</p>
            {summary && summary !== presentation.summary && <p className="ending-context">{summary}</p>}
          </div>
        </header>

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
