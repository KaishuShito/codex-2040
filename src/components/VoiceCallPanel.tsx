import { Check, Mic, MicOff, Phone, PhoneOff, Radio, X } from 'lucide-react'
import type { MicPermissionStatus, VoiceConnectionStatus } from '../voiceAgent'
import type { VoiceResetRequest } from '../voiceReset'

export type VoiceSubtitle = {
  id: string
  speaker: 'player' | 'operator' | 'system'
  text: string
}

const statusLabel: Record<VoiceConnectionStatus, string> = {
  idle: 'READY',
  connecting: 'CONNECTING',
  connected: 'REALTIME CONNECTED',
  fallback: 'SCRIPTED FALLBACK',
  ended: 'CALL ENDED',
}

const micLabel: Record<MicPermissionStatus, string> = {
  unknown: 'MIC NOT REQUESTED',
  requesting: 'REQUESTING MIC',
  granted: 'MIC GRANTED',
  denied: 'MIC DENIED',
  unavailable: 'MIC UNAVAILABLE',
}

type VoiceCallPanelProps = {
  open: boolean
  status: VoiceConnectionStatus
  micPermission: MicPermissionStatus
  muted: boolean
  subtitles: readonly VoiceSubtitle[]
  operatorDraft: string
  pendingReset: VoiceResetRequest | null
  resetNotice: string
  resetCooldownSeconds: number
  onStart: () => void
  onEnd: () => void
  onClose: () => void
  onToggleMute: () => void
  onScriptedRequest: () => void
  onApproveReset: () => void
  onRejectReset: () => void
}

export default function VoiceCallPanel({
  open,
  status,
  micPermission,
  muted,
  subtitles,
  operatorDraft,
  pendingReset,
  resetNotice,
  resetCooldownSeconds,
  onStart,
  onEnd,
  onClose,
  onToggleMute,
  onScriptedRequest,
  onApproveReset,
  onRejectReset,
}: VoiceCallPanelProps) {
  if (!open) return null
  const active = status === 'connecting' || status === 'connected' || status === 'fallback'
  return (
    <aside className="voice-call" role="dialog" aria-modal="false" aria-labelledby="voice-call-title">
      <header>
        <div><span className="voice-call__avatar"><Radio size={17} /></span><span><b id="voice-call-title">Kibo — Demo Operator</b><small>fictionalized demo operator · generic synthetic voice</small></span></div>
        <button className="voice-call__close" onClick={onClose} aria-label="Close voice call panel"><X size={16} /></button>
      </header>

      <div className="voice-call__status" data-status={status} aria-live="polite">
        <span><i /> {statusLabel[status]}</span><span>{micLabel[micPermission]}{muted ? ' · MUTED' : ''}</span>
      </div>

      <div className="voice-call__scope">
        GAME-ONLY: this can reset Tibo tokens inside Codex 2040. It cannot change OpenAI accounts, billing, API limits, or permissions.
      </div>

      <div className="voice-call__transcript" aria-label="Voice call subtitles" aria-live="polite">
        {subtitles.length === 0 && <p className="voice-call__empty">Start the call, then ask: 「リミットをリセットして」</p>}
        {subtitles.map((subtitle, index) => (
          <p key={`${subtitle.id}-${index}`} data-speaker={subtitle.speaker}><b>{subtitle.speaker === 'player' ? 'YOU' : subtitle.speaker === 'operator' ? 'KIBO — DEMO' : 'SYSTEM'}</b><span>{subtitle.text}</span></p>
        ))}
        {operatorDraft && <p data-speaker="operator"><b>KIBO — DEMO</b><span>{operatorDraft}</span></p>}
      </div>

      {status === 'fallback' && !pendingReset && (
        <button className="voice-call__script" onClick={onScriptedRequest}>USE SCRIPTED REQUEST · 「リミットをリセットして」</button>
      )}

      {pendingReset && (
        <section className="voice-call__approval" aria-label="In-game reset approval">
          <small>TOOL REQUEST · {pendingReset.source === 'realtime' ? 'REALTIME' : 'SCRIPTED FALLBACK'}</small>
          <b>trigger_token_reset</b>
          <p>“{pendingReset.playerRequest}”</p>
          <strong>{pendingReset.source === 'realtime' ? 'Say 「やって！」, 「お願い」, or “Do it!”. The visible buttons remain as a fallback.' : 'Confirming runs the existing in-game Tibo reset once.'}</strong>
          <div>
            <button onClick={onRejectReset}><X size={14} /> REJECT</button>
            <button className="is-confirm" onClick={onApproveReset} disabled={resetCooldownSeconds > 0}>
              <Check size={14} /> {resetCooldownSeconds > 0 ? `COOLDOWN ${Math.ceil(resetCooldownSeconds)}s` : 'CONFIRM GAME RESET'}
            </button>
          </div>
        </section>
      )}

      <p className="voice-call__notice" aria-live="polite">{resetNotice}</p>

      <footer>
        {!active && <button className="voice-call__primary" onClick={onStart}><Phone size={15} /> START CALL</button>}
        {active && <button className="voice-call__hangup" onClick={onEnd}><PhoneOff size={15} /> END CALL</button>}
        {status === 'connected' && <button aria-pressed={muted} onClick={onToggleMute}>{muted ? <MicOff size={15} /> : <Mic size={15} />}{muted ? 'UNMUTE' : 'MUTE'}</button>}
        <small>⌥V open/start · ⌥M mute · ⌥↵ confirm · Esc end</small>
      </footer>
    </aside>
  )
}
