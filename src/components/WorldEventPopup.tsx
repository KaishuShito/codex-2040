import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './WorldEventPopup.css'

export type WorldEventEffectTone = 'positive' | 'negative' | 'neutral'

export type WorldEventEffectChip = {
  label: string
  amount: string
  /** Overrides the event-level duration for this effect. */
  duration?: string
  tone?: WorldEventEffectTone
}

export type WorldEventCombo = {
  /** The previously shipped feature or policy that activated this combo. */
  priorFeature: string
  outcome?: string
}

/** Presentation-only shape. Map engine-owned WorldEventNotice data into this at the integration boundary. */
export type WorldEventPopupNotice = {
  id: string
  source: string
  category: string
  date: string
  dateTime?: string
  headline: string
  cause: string
  flavor: string
  duration: string
  effects: readonly WorldEventEffectChip[]
  combo?: WorldEventCombo
}

export type WorldEventPopupProps = {
  locale?: 'ja' | 'en'
  notice: WorldEventPopupNotice
  onAcknowledge: () => void
  open?: boolean
  advisorCopy?: string
}

const DEFAULT_ADVISOR_COPY = '原因と次に重要なリスクを聞けます。判断するのはあなたです。'

export function WorldEventPopup({
  locale = 'ja',
  notice,
  onAcknowledge,
  open = true,
  advisorCopy = DEFAULT_ADVISOR_COPY,
}: WorldEventPopupProps) {
  const titleId = useId()
  const descriptionId = useId()
  const acknowledgeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const keepFocusOnAcknowledge = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !acknowledgeRef.current) return
      event.preventDefault()
      acknowledgeRef.current.focus()
    }

    document.addEventListener('keydown', keepFocusOnAcknowledge)
    return () => {
      document.removeEventListener('keydown', keepFocusOnAcknowledge)
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal((
    <div className="world-event-overlay" role="presentation">
      <dialog
        className="world-event-popup"
        data-category={notice.category.toLowerCase()}
        lang={locale}
        open
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="world-event-popup__scanline" aria-hidden="true" />

        <header className="world-event-popup__header">
          <div className="world-event-popup__metadata">
            <span className="world-event-source" data-source={notice.source}>{notice.source}</span>
            <span className="world-event-category">{notice.category}</span>
            <time dateTime={notice.dateTime}>{notice.date}</time>
          </div>
          <span className="world-event-popup__paused"><i aria-hidden="true" /> {locale === 'ja' ? 'シミュレーション停止中' : 'Simulation paused'}</span>
        </header>

        <div className="world-event-popup__body">
          <p className="world-event-popup__eyebrow">{locale === 'ja' ? '世界イベント · 緊急速報' : 'WORLD EVENT · BREAKING'}</p>
          <h2 id={titleId}>{notice.headline}</h2>

          <div id={descriptionId} className="world-event-popup__narrative">
            <div className="world-event-popup__cause">
              <span>{locale === 'ja' ? '原因' : 'Cause'}</span>
              <p>{notice.cause}</p>
            </div>
            <p className="world-event-popup__flavor">{notice.flavor}</p>
          </div>

          {notice.combo && (
            <div className="world-event-popup__combo" role="status">
              <span>{locale === 'ja' ? 'コンボ発動' : 'Combo triggered'}</span>
              <strong>{notice.combo.priorFeature}</strong>
              {notice.combo.outcome && <p>{notice.combo.outcome}</p>}
            </div>
          )}

          <section className="world-event-popup__impact" aria-labelledby={`${titleId}-impact`}>
            <div className="world-event-popup__section-heading">
              <span id={`${titleId}-impact`}>{locale === 'ja' ? 'タイムラインへの影響' : 'Timeline impact'}</span>
              <small>{locale === 'ja' ? '反映済み · 時間停止中' : 'Applied · time paused'}</small>
            </div>
            <dl className="world-event-popup__effects">
              {notice.effects.map((effect, index) => (
                <div
                  key={`${effect.label}-${index}`}
                  className="world-event-effect"
                  data-tone={effect.tone ?? 'neutral'}
                >
                  <dt>{effect.label}</dt>
                  <dd>{effect.amount}</dd>
                  <small>{effect.duration ?? notice.duration}</small>
                </div>
              ))}
            </dl>
          </section>

          <aside className="world-event-popup__advisor">
            <span>{locale === 'ja' ? 'アドバイザーに聞く' : 'Ask the advisor'}</span>
            <p>{advisorCopy}</p>
          </aside>
        </div>

        <footer className="world-event-popup__footer">
          <button ref={acknowledgeRef} type="button" autoFocus onClick={onAcknowledge}>
            {locale === 'ja' ? '確認して再開' : 'Acknowledge and resume'} <span aria-hidden="true">→</span>
          </button>
        </footer>
      </dialog>
    </div>
  ), document.body)
}

export default WorldEventPopup
