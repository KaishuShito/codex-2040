import { useState } from 'react'
import App from './App'
import AgiPillGame from './AgiPillGame'
import { COPY, getPillCopy, type AgiPillLocale } from './agiPill/content'
import { LEGACY_SESSION_STORAGE_KEY, SESSION_STORAGE_KEY } from './session'
import { MODE_SESSION_STORAGE_KEY, type GameMode } from './agiPill/session'
import './ModeApp.css'

export const PREFERRED_MODE_KEY = 'codex-2040:preferred-mode:v1'

const loadPreferredMode = (): GameMode | null => {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(PREFERRED_MODE_KEY)
  return value === 'standard' || value === 'agi-pill' ? value : null
}

const hasStored = (key: string) => typeof window !== 'undefined' && Boolean(window.localStorage.getItem(key))

export default function ModeApp() {
  const [locale, setLocale] = useState<AgiPillLocale>('ja')
  const [mode, setMode] = useState<GameMode | null>(loadPreferredMode)

  const chooseMode = (next: GameMode) => {
    window.localStorage.setItem(PREFERRED_MODE_KEY, next)
    setMode(next)
  }

  const chooseAnother = () => {
    window.localStorage.removeItem(PREFERRED_MODE_KEY)
    setMode(null)
  }

  if (mode === 'standard') {
    return (
      <div className="mode-runtime mode-runtime--standard">
        <header className="mode-runtime__bar">
          <span><b>STANDARD</b> // {locale === 'ja' ? '優等生版' : 'Governed takeoff'}</span>
          <button type="button" onClick={chooseAnother}>{locale === 'ja' ? 'モード選択' : 'Choose mode'}</button>
        </header>
        <App locale={locale} />
      </div>
    )
  }

  if (mode === 'agi-pill') {
    return <AgiPillGame locale={locale} onLocaleChange={setLocale} onChooseMode={chooseAnother} />
  }

  const standardSaved = hasStored(SESSION_STORAGE_KEY) || hasStored(LEGACY_SESSION_STORAGE_KEY)
  const pillSaved = hasStored(MODE_SESSION_STORAGE_KEY)

  return (
    <main className="mode-select" data-testid="mode-select">
      <div className="mode-select__stars" aria-hidden="true" />
      <header className="mode-select__header">
        <div>
          <span>OPENAI BUILD WEEK // CODEX 2040</span>
          <h1>{getPillCopy(locale, 'mode.select.title')}</h1>
          <p>{getPillCopy(locale, 'mode.select.saved')}</p>
        </div>
        <div className="mode-select__locale" aria-label="Language">
          <button type="button" className={locale === 'ja' ? 'is-active' : ''} onClick={() => setLocale('ja')}>日本語</button>
          <button type="button" className={locale === 'en' ? 'is-active' : ''} onClick={() => setLocale('en')}>EN</button>
        </div>
      </header>

      <section className="mode-select__cards" aria-label={getPillCopy(locale, 'mode.select.title')}>
        <article className="mode-card mode-card--standard">
          <div className="mode-card__index">01</div>
          <span>{getPillCopy(locale, 'mode.standard.badge')}</span>
          <h2>{getPillCopy(locale, 'mode.standard.name')}</h2>
          <p>{getPillCopy(locale, 'mode.standard.description')}</p>
          <ul>
            <li>{locale === 'ja' ? '2026→2040 AIガバナンス' : '2026→2040 AI governance'}</li>
            <li>{locale === 'ja' ? '既存セーブ・D1互換' : 'Existing save and D1 compatible'}</li>
            <li>{locale === 'ja' ? '世界地図と健全な競争' : 'World map and healthy competition'}</li>
          </ul>
          <button type="button" onClick={() => chooseMode('standard')}>
            {standardSaved ? (locale === 'ja' ? 'Standardを再開' : 'Resume Standard') : getPillCopy(locale, 'mode.select.confirm')}
          </button>
        </article>

        <article className="mode-card mode-card--pill">
          <div className="mode-card__index">02</div>
          <span>{getPillCopy(locale, 'mode.pill.badge')}</span>
          <h2>{getPillCopy(locale, 'mode.pill.name')}</h2>
          <p>{getPillCopy(locale, 'mode.pill.description')}</p>
          <ul>
            <li>{locale === 'ja' ? '知能×産業の相互加速' : 'Coupled intelligence × industry'}</li>
            <li>{locale === 'ja' ? '地球→軌道→太陽系' : 'Earth → orbit → solar system'}</li>
            <li>{locale === 'ja' ? 'Dysonは序章、その先へ' : 'Dyson is the prologue, then beyond'}</li>
          </ul>
          <button type="button" onClick={() => chooseMode('agi-pill')}>
            {pillSaved ? (locale === 'ja' ? 'AGIピルを再開' : 'Resume AGI Pill') : getPillCopy(locale, 'mode.select.confirm')}
          </button>
        </article>
      </section>

      <aside className="mode-select__caveat">
        <b>{locale === 'ja' ? 'SCENARIO DISCLOSURE' : 'SCENARIO DISCLOSURE'}</b>
        <p>{COPY[locale]['mode.pill.warning']}</p>
      </aside>
    </main>
  )
}
