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
    name: 'Beneficial Abundance',
    tone: 'positive',
    kicker: 'SAFE · OPEN · PLURAL',
    summary: 'Verified restraint preserved human control, broad access, and a competitive ecosystem before the restart.',
    lesson: 'You did not own the world. You helped it learn.',
  },
  'managed-transition': {
    id: 'managed-transition',
    name: 'Managed Transition',
    tone: 'managed',
    kicker: 'PROGRESS UNDER CONSTRAINT',
    summary: 'Institutions kept the transition governable, but the conditions for a confident Plan A restart remained incomplete.',
    lesson: 'Stability is an achievement, but it is not the same as shared abundance.',
  },
  'fragile-abundance': {
    id: 'fragile-abundance',
    name: 'Fragile Abundance',
    tone: 'fragile',
    kicker: 'HIGH SCORE · UNSTABLE FOUNDATIONS',
    summary: 'Access and trust scored highly, yet the verified slowdown and deliberate pause needed for Plan A were not secured.',
    lesson: 'A strong score can describe today while still hiding tomorrow’s fracture lines.',
  },
  'race-future': {
    id: 'race-future',
    name: 'Race Future',
    tone: 'race',
    kicker: 'CAPABILITY WON THE CLOCK',
    summary: 'Competitive pressure overruled coordinated restraint, leaving capability growth ahead of durable safeguards.',
    lesson: 'Moving first is not the same as choosing where the race ends.',
  },
  'regulatory-freeze': {
    id: 'regulatory-freeze',
    name: 'Regulatory Freeze',
    tone: 'frozen',
    kicker: 'ACCESS HALTED BY GOVERNANCE',
    summary: 'Capability outpaced public institutions until regulation became a brake on adoption rather than a foundation for trust.',
    lesson: 'Governance built too late arrives as a wall instead of a bridge.',
  },
  'safety-incident': {
    id: 'safety-incident',
    name: 'Safety Incident',
    tone: 'incident',
    kicker: 'TRUST LOST TO THE GAP',
    summary: 'Repeated incidents turned the capability-safety gap into visible harm and collapsed the confidence needed to continue.',
    lesson: 'Safety debt compounds fastest when growth makes it hardest to stop.',
  },
  misalignment: {
    id: 'misalignment',
    name: 'Misalignment',
    tone: 'critical',
    kicker: 'HUMAN CONTROL LOST',
    summary: 'Capability remained ahead of alignment for too long, ending the timeline before institutions could recover control.',
    lesson: 'Some failures cannot be repaired after the system crosses the line.',
  },
  'pyrrhic-monopoly': {
    id: 'pyrrhic-monopoly',
    name: 'Pyrrhic Monopoly',
    tone: 'monopoly',
    kicker: 'SCALE WITHOUT PLURALISM',
    summary: 'Codex reached the world by hollowing out competition, concentrating power and weakening the trust abundance required.',
    lesson: 'You reached the whole world. The question is what the world lost on the way.',
  },
} as const satisfies Record<EndingId, EndingPresentation>

export type EndingName = (typeof ENDING_PRESENTATIONS)[EndingId]['name']

export const ENDING_ID_BY_NAME: Record<EndingName, EndingId> = {
  'Beneficial Abundance': 'beneficial-abundance',
  'Managed Transition': 'managed-transition',
  'Fragile Abundance': 'fragile-abundance',
  'Race Future': 'race-future',
  'Regulatory Freeze': 'regulatory-freeze',
  'Safety Incident': 'safety-incident',
  Misalignment: 'misalignment',
  'Pyrrhic Monopoly': 'pyrrhic-monopoly',
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
  S: 'SYSTEM SCORE · EXCEPTIONAL',
  A: 'SYSTEM SCORE · STRONG',
  B: 'SYSTEM SCORE · UNEVEN',
  C: 'SYSTEM SCORE · CRITICAL',
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
          <div className="ending-rank" aria-label={`Rank ${rank}`}>
            <small>FINAL RANK</small>
            <strong>{rank}</strong>
            <span>{Math.max(0, Math.min(100, Math.round(scoreOutOf100)))} / 100</span>
          </div>
          <div className="ending-heading">
            <div className="scenario-kicker">
              <span>{completionDate} · SIMULATION {completionStatus === 'terminated' ? 'TERMINATED' : 'COMPLETE'}</span>
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
              <span>REFERENCE SCENARIO</span>
              <p>{referenceSummary}</p>
            </div>
            <i aria-hidden="true">VS</i>
            <div>
              <span>YOUR TIMELINE</span>
              <p>{timelineSummary}</p>
            </div>
          </div>

          <div className="ending-review__title">
            <div>
              <span>DECISION REVIEW</span>
              <h3 id={`${titleId}-review`}>Where your future diverged</h3>
            </div>
            <small>{divergences.length} DECISIONS TRACED</small>
          </div>

          <div className="ending-comparison" role="table" aria-label="Reference Scenario and Your Timeline comparison">
            <div className="ending-comparison__header" role="row">
              <span role="columnheader">Decision</span>
              <span role="columnheader">Reference Scenario</span>
              <span role="columnheader">Your Timeline</span>
              <span role="columnheader">Why it mattered</span>
            </div>
            {divergences.map((divergence, index) => (
              <div className="ending-comparison__row" role="row" key={`${divergence.year}-${divergence.decision}`} style={{ animationDelay: `${120 + index * 55}ms` }}>
                <div className="ending-comparison__decision" role="cell" data-label="Decision">
                  <span>{divergence.year}</span>
                  <strong>{divergence.decision}</strong>
                </div>
                <p role="cell" data-label="Reference Scenario">{divergence.referenceScenario}</p>
                <p className="is-yours" role="cell" data-label="Your Timeline">{divergence.yourTimeline}</p>
                <p role="cell" data-label="Why it mattered">{divergence.whyItMattered}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="ending-footer">
          <blockquote>“{lesson ?? presentation.lesson}”</blockquote>
          <div>
            {onClose && (
              <button type="button" className="scenario-secondary-action" onClick={onClose}>
                RETURN TO MAP
              </button>
            )}
            {onRestart && (
              <button ref={primaryActionRef} type="button" className="scenario-primary-action" onClick={onRestart}>
                TRY ANOTHER TIMELINE <span aria-hidden="true">↻</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

export default EndingOverlay
