import { describe, expect, it } from 'vitest'
import { analyzePillWorldlines } from './analyze'
import { renderPillReportMarkdown } from './report'

describe('AGI Pill report rendering', () => {
  it('labels synthetic evidence and preserves the browser verifier boundary', () => {
    const report = analyzePillWorldlines([], { generatedAt: 'fixed' })
    const markdown = renderPillReportMarkdown(report)
    expect(markdown).toContain('synthetic worldline report')
    expect(markdown).toContain('Browser E2E remains the primary verifier')
    expect(markdown).toContain('single-optimum')
  })
})
