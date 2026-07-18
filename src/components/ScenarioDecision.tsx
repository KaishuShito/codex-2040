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
    eyebrow: 'CHOOSE A PATH',
    prompt: 'Set the rules for the capability race.',
  },
  'hold-the-line-2035': {
    year: '2035',
    eyebrow: 'HOLD THE LINE',
    prompt: 'Decide whether a deliberate pause can survive competitive pressure.',
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
  confirmLabel = 'COMMIT DECISION',
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
          <div className="scenario-year" aria-label={`Year ${copy.year}`}>
            <span>{copy.year}</span>
            <small>{copy.eyebrow}</small>
          </div>
          <div className="scenario-decision__heading">
            <div className="scenario-kicker">
              <span className="scenario-pause"><i /> SIMULATION PAUSED</span>
              <span className="scenario-source">SOURCE · {source.label}</span>
            </div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{context}</p>
          </div>
        </header>

        <div className="scenario-decision__prompt">
          <span>DECISION REQUIRED</span>
          <strong>{copy.prompt}</strong>
        </div>

        <div className="scenario-options" role="radiogroup" aria-label={`${copy.year} decision options`}>
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
                  <small><b>CONSEQUENCE</b>{option.consequence}</small>
                </span>
              </button>
            )
          })}
        </div>

        <div className="scenario-learning">
          <details>
            <summary>WHY THIS MATTERS <span aria-hidden="true">+</span></summary>
            <p>{whyThisMatters}</p>
          </details>
          <a href={source.href} target="_blank" rel="noreferrer">
            {source.linkLabel ?? `Read the ${source.label} source`} <span aria-hidden="true">↗</span>
          </a>
        </div>

        <footer className="scenario-decision__footer">
          <p aria-live="polite">
            {selectedOption ? <><span>SELECTED</span>{selectedOption.title}</> : 'Choose a path to continue the simulation.'}
          </p>
          <button
            type="button"
            className="scenario-primary-action"
            disabled={!selectedOption || isSubmitting}
            onClick={() => selectedOption && onConfirm(selectedOption.id)}
          >
            {isSubmitting ? 'APPLYING…' : confirmLabel}<span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ScenarioDecision
