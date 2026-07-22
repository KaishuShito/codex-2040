import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import LocaleApp from './LocaleApp'
import {
  addFeature,
  buyUpgrade,
  choose2029,
  choose2035,
  createInitialState,
  introduceRegion,
  openEcosystem,
  requestComputeLifeline,
  triggerReset,
  type NewsItem,
} from './engine'
import { WORLD_EVENTS } from './worldEvents/catalog'
import {
  STANDARD_COPY,
  STANDARD_TUTORIAL_STEPS,
  getStandardWorldEventCopy,
  localizeStandardNewsHeadline,
} from './standardI18n'

const japaneseText = /[ぁ-んァ-ヶ一-龠]/u

describe('Standard locale contract', () => {
  it('makes the public entrypoint English-first while keeping Japanese one click away', () => {
    const html = renderToStaticMarkup(<LocaleApp />)

    expect(html).toContain('You are the CEO of OpenAI.')
    expect(html).toContain('日本語')
    expect(html).toContain('aria-label="日本語に切り替える"')
    expect(html).not.toContain('あなたはOpenAIのCEOです。')
  })

  it('renders the English Standard start and representative runtime surfaces without Japanese chrome', () => {
    const html = renderToStaticMarkup(<App locale="en" />)

    expect(html).toContain('You are the CEO of OpenAI.')
    expect(html).toContain('Start with tutorial')
    expect(html).toContain('Compute budget')
    expect(html).toContain('World telemetry')
    expect(html).toContain('Human extinction risk')
    expect(html).toContain('Normal')
    expect(html).toContain('Fast')

    expect(html).not.toContain('あなたはOpenAIのCEOです。')
    expect(html).not.toContain('説明から始める')
    expect(html).not.toContain('計算予算')
    expect(html).not.toContain('世界テレメトリ')
    expect(html).not.toContain('人類絶滅リスク')
    expect(html).toContain('CODEX expansion protocol begins')
    expect(html).toContain('Development agents reach a new reliability threshold')
    expect(html).not.toContain('CODEX拡大プロトコルが始動')
    expect(html).not.toContain('開発エージェントが新たな信頼性水準へ')
  })

  it('preserves Japanese as the default and explicit locale', () => {
    const implicit = renderToStaticMarkup(<App />)
    const explicit = renderToStaticMarkup(<App locale="ja" />)

    for (const html of [implicit, explicit]) {
      expect(html).toContain('あなたはOpenAIのCEOです。')
      expect(html).toContain('説明から始める')
      expect(html).toContain('計算予算')
      expect(html).toContain('世界テレメトリ')
    }
  })

  it('keeps centralized Standard copy and tutorial steps bilingual', () => {
    for (const value of Object.values(STANDARD_COPY)) {
      expect(value.ja.trim()).not.toBe('')
      expect(value.en.trim()).not.toBe('')
    }
    for (const step of STANDARD_TUTORIAL_STEPS) {
      for (const value of Object.values(step)) {
        expect(value.ja.trim()).not.toBe('')
        expect(value.en.trim()).not.toBe('')
      }
    }
  })

  it('provides deterministic English copy for every authored world event and combo', () => {
    const headlines = new Set<string>()
    const causes = new Set<string>()
    const flavors = new Set<string>()
    for (const definition of WORLD_EVENTS) {
      const base = getStandardWorldEventCopy('en', definition)
      expect(base.headline, definition.id).not.toMatch(japaneseText)
      expect(base.cause, definition.id).not.toMatch(japaneseText)
      expect(base.flavor, definition.id).not.toMatch(japaneseText)
      headlines.add(base.headline)
      causes.add(base.cause)
      flavors.add(base.flavor)
      expect(base.headline.trim(), definition.id).not.toBe('')
      for (const combo of definition.combos ?? []) {
        const copy = getStandardWorldEventCopy('en', definition, combo)
        expect(copy.headline, combo.id).not.toMatch(japaneseText)
        expect(copy.comboLabel, combo.id).not.toMatch(japaneseText)
        if (copy.comboHeadline) expect(copy.comboHeadline, combo.id).not.toMatch(japaneseText)
      }
      expect(getStandardWorldEventCopy('ja', definition).headline).toBe(definition.headline)
    }
    expect(headlines.size).toBe(WORLD_EVENTS.length)
    expect(causes.size).toBe(WORLD_EVENTS.length)
    expect(flavors.size).toBe(WORLD_EVENTS.length)
  })

  it('localizes deterministic and player-action news while marking external GM copy explicitly', () => {
    const initial = createInitialState()
    const actionStates = [
      introduceRegion(initial, 'africa'),
      triggerReset(initial),
      openEcosystem(initial),
      requestComputeLifeline({ ...initial, compute: 0 }),
      buyUpgrade(initial, 'safety'),
      addFeature(initial, 'mobile access'),
      choose2029(initial, 'verified-slowdown'),
      choose2035(initial, 'hold-the-line'),
    ]
    const items = [...initial.news, ...actionStates.map((state) => state.news[0])]
    for (const item of items) {
      expect(localizeStandardNewsHeadline('en', item), item.headline).not.toMatch(japaneseText)
      expect(localizeStandardNewsHeadline('ja', item)).toBe(item.headline)
    }

    const gm: NewsItem = { id: 999, date: '2030-01-01', tone: 'neutral', headline: '外部から届いた速報', source: 'Live GM' }
    expect(localizeStandardNewsHeadline('en', gm)).toBe('LIVE GM // External briefing is available only in its source language')
    expect(localizeStandardNewsHeadline('en', gm)).not.toMatch(japaneseText)

    const unknownTimeline: NewsItem = { ...gm, id: 1000, source: 'Your Timeline', headline: '未登録のプレイヤー生成イベント' }
    const unknownRival: NewsItem = { ...unknownTimeline, id: 1001, kind: 'rival-strategy' }
    expect(localizeStandardNewsHeadline('en', unknownTimeline)).toBe('YOUR TIMELINE // Source-language update is unavailable in English')
    expect(localizeStandardNewsHeadline('en', unknownRival)).toBe('RIVAL STRATEGY // Authored update is unavailable in English')
    expect(localizeStandardNewsHeadline('en', unknownTimeline)).not.toMatch(japaneseText)
    expect(localizeStandardNewsHeadline('en', unknownRival)).not.toMatch(japaneseText)

    const englishExternal = { ...gm, id: 1002, headline: 'External operator update' }
    expect(localizeStandardNewsHeadline('en', englishExternal)).toBe(englishExternal.headline)
  })
})
