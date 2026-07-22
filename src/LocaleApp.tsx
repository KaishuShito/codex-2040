import { useEffect, useState } from 'react'
import App from './App'
import type { StandardLocale } from './standardI18n'

export const STANDARD_LOCALE_STORAGE_KEY = 'codex-2040:locale:v1'

const isLocale = (value: string | null): value is StandardLocale => value === 'en' || value === 'ja'

export const loadStandardLocale = (): StandardLocale => {
  if (typeof window === 'undefined') return 'en'
  const queryLocale = new URLSearchParams(window.location.search).get('lang')
  if (isLocale(queryLocale)) return queryLocale
  let storedLocale: string | null = null
  try { storedLocale = window.localStorage.getItem(STANDARD_LOCALE_STORAGE_KEY) } catch { /* English remains the safe public default. */ }
  return isLocale(storedLocale) ? storedLocale : 'en'
}

const metadata = {
  en: {
    title: 'Codex 2040 — AI Governance Simulation',
    description: 'A playable AI-governance simulation about expanding access while protecting safety, trust, governance, and healthy competition.',
  },
  ja: {
    title: 'Codex 2040 — AIガバナンス・シミュレーション',
    description: '安全性・信頼・健全な競争を守りながらAIを世界へ届ける、プレイ可能なAIガバナンス・シミュレーション。',
  },
} as const

export default function LocaleApp() {
  const [locale, setLocale] = useState<StandardLocale>(loadStandardLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = metadata[locale].title
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', metadata[locale].description)
    try { window.localStorage.setItem(STANDARD_LOCALE_STORAGE_KEY, locale) } catch { /* The switch still works for this session. */ }
  }, [locale])

  const chooseLocale = (next: StandardLocale) => {
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.history.replaceState(null, '', url)
    setLocale(next)
  }

  return <App locale={locale} onLocaleChange={chooseLocale} />
}
