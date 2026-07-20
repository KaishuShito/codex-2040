import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import './ScenarioUI.css'

export type ScenarioSourceLabel = 'AI 2027' | 'AI 2040 / Plan A' | 'Your Timeline' | 'Live GM'

export type ScenarioSource = {
  label: ScenarioSourceLabel
  href: string
  linkLabel?: string
}

export type ScenarioDecisionOption = {
  id: string
  title: string
  summary: string
  consequence: string
}

export type ScenarioDecisionOptions = readonly [
  ScenarioDecisionOption,
  ScenarioDecisionOption,
  ...ScenarioDecisionOption[],
]

export type ScenarioDecisionProps = {
  open: boolean
  milestone: 'choose-path-2029' | 'hold-the-line-2035'
  source: ScenarioSource
  title: string
  context: string
  options: ScenarioDecisionOptions
  selectedOptionId: string | null
  whyThisMatters: string
  onSelect: (optionId: string) => void
  onConfirm: (optionId: string) => void
  confirmLabel?: string
  isSubmitting?: boolean
}

const milestoneCopy = {
  'choose-path-2029': {
    year: '2029',
    eyebrow: '進路選択',
    prompt: '能力開発競争のルールを決めてください。',
  },
  'hold-the-line-2035': {
    year: '2035',
    eyebrow: '方針を堅持',
    prompt: '競争圧力の中でも、計画的な停止を維持するか決めてください。',
  },
} as const

export function ScenarioDecision({
  open,
  milestone,
  source,
  title,
  context,
  options,
  selectedOptionId,
  whyThisMatters,
  onSelect,
  onConfirm,
  confirmLabel = '決定して再開',
  isSubmitting = false,
}: ScenarioDecisionProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const copy = milestoneCopy[milestone]

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selectedIndex = Math.max(0, options.findIndex((option) => option.id === selectedOptionId))
    optionRefs.current[selectedIndex]?.focus()

    const keepFocusInside = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), a[href], summary, [tabindex]:not([tabindex="-1"])'),
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

    document.addEventListener('keydown', keepFocusInside)
    return () => {
      document.removeEventListener('keydown', keepFocusInside)
      previouslyFocused?.focus()
    }
  }, [open, options, selectedOptionId])

  if (!open) return null

  const moveOptionFocus = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const keyDirection: Partial<Record<KeyboardEvent['key'], number>> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    }
    let nextIndex: number | undefined

    if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = options.length - 1
    else if (keyDirection[event.key]) {
      nextIndex = (currentIndex + keyDirection[event.key]! + options.length) % options.length
    }

    if (nextIndex === undefined) return
    event.preventDefault()
    onSelect(options[nextIndex].id)
    optionRefs.current[nextIndex]?.focus()
  }

  const selectedOption = options.find((option) => option.id === selectedOptionId)

  return (
    <div className="scenario-overlay scenario-overlay--decision" role="presentation">
      <div
        ref={dialogRef}
        className="scenario-dialog scenario-decision"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="scenario-dialog__signal" aria-hidden="true" />
        <header className="scenario-decision__header">
          <div className="scenario-year" aria-label={`${copy.year}年`}>
            <span>{copy.year}</span>
            <small>{copy.eyebrow}</small>
          </div>
          <div className="scenario-decision__heading">
            <div className="scenario-kicker">
              <span className="scenario-pause"><i /> シミュレーション一時停止</span>
              <span className="scenario-source">出典 · {source.label}</span>
            </div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{context}</p>
          </div>
        </header>

        <div className="scenario-decision__prompt">
          <span>判断が必要</span>
          <strong>{copy.prompt}</strong>
        </div>

        <div className="scenario-options" role="radiogroup" aria-label={`${copy.year}年の選択肢`}>
          {options.map((option, index) => {
            const selected = option.id === selectedOptionId
            return (
              <button
                key={option.id}
                ref={(node) => { optionRefs.current[index] = node }}
                type="button"
                className={`scenario-option${selected ? ' is-selected' : ''}`}
                role="radio"
                aria-checked={selected}
                tabIndex={selected || (!selectedOption && index === 0) ? 0 : -1}
                onClick={() => onSelect(option.id)}
                onKeyDown={(event) => moveOptionFocus(event, index)}
              >
                <span className="scenario-option__marker" aria-hidden="true"><i /></span>
                <span className="scenario-option__copy">
                  <strong>{option.title}</strong>
                  <span>{option.summary}</span>
                  <small><b>影響</b>{option.consequence}</small>
                </span>
              </button>
            )
          })}
        </div>

        <div className="scenario-learning">
          <details>
            <summary>なぜ重要か <span aria-hidden="true">+</span></summary>
            <p>{whyThisMatters}</p>
          </details>
          <a href={source.href} target="_blank" rel="noreferrer">
            {source.linkLabel ?? `${source.label} の出典を開く`} <span aria-hidden="true">↗</span>
          </a>
        </div>

        <footer className="scenario-decision__footer">
          <p aria-live="polite">
            {selectedOption ? <><span>選択中</span>{selectedOption.title}</> : '選択肢を選ぶとシミュレーションを再開できます。'}
          </p>
          <button
            type="button"
            className="scenario-primary-action"
            disabled={!selectedOption || isSubmitting}
            onClick={() => selectedOption && onConfirm(selectedOption.id)}
          >
            {isSubmitting ? '反映中…' : confirmLabel}<span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ScenarioDecision
