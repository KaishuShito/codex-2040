import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import { STANDARD_COPY, STANDARD_TUTORIAL_STEPS } from './standardI18n'

describe('Standard locale contract', () => {
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
})
