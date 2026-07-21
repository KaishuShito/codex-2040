import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import VoiceCallPanel from './VoiceCallPanel'

describe('VoiceCallPanel approval language', () => {
  it('renders an English fallback request and controls entirely in English', () => {
    const html = renderToStaticMarkup(<VoiceCallPanel
      open
      status="fallback"
      micPermission="unavailable"
      muted={false}
      subtitles={[]}
      operatorDraft=""
      pendingReset={{
        id: 'fallback-en',
        callId: 'fallback-en',
        playerRequest: 'Please reset my in-game Tibo token limit.',
        source: 'scripted-fallback',
        language: 'en',
      }}
      resetNotice="Scripted mode requested an in-game reset. Player approval is required."
      resetCooldownSeconds={0}
      onStart={vi.fn()}
      onEnd={vi.fn()}
      onClose={vi.fn()}
      onToggleMute={vi.fn()}
      onScriptedRequest={vi.fn()}
      onApproveReset={vi.fn()}
      onRejectReset={vi.fn()}
    />)

    expect(html).toContain('lang="en"')
    expect(html).toContain('Scripted fallback')
    expect(html).toContain('Approve in-game reset')
    expect(html).toContain('Reject')
    expect(html).not.toContain('ゲーム内リセットを承認')
  })
})
