import { Check, Mic, MicOff, Phone, PhoneOff, Radio, X } from 'lucide-react'
import type { MicPermissionStatus, VoiceConnectionStatus } from '../voiceAgent'
import type { VoiceResetRequest } from '../voiceReset'

export type VoiceSubtitle = {
  id: string
  speaker: 'player' | 'operator' | 'system'
  text: string
}

const statusLabel: Record<VoiceConnectionStatus, string> = {
  idle: '待機中',
  connecting: '接続中',
  connected: 'リアルタイム接続済み',
  fallback: '台本モード',
  ended: '通話終了',
}

const micLabel: Record<MicPermissionStatus, string> = {
  unknown: 'マイク未要求',
  requesting: 'マイク許可を確認中',
  granted: 'マイク許可済み',
  denied: 'マイク拒否',
  unavailable: 'マイク利用不可',
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
        <div><span className="voice-call__avatar"><Radio size={17} /></span><span><b id="voice-call-title">キボ — ボイス・オペレーター</b><small>架空のデモオペレーター · 汎用合成音声</small></span></div>
        <button className="voice-call__close" onClick={onClose} aria-label="音声通話パネルを閉じる"><X size={16} /></button>
      </header>

      <div className="voice-call__status" data-status={status} aria-live="polite">
        <span><i /> {statusLabel[status]}</span><span>{micLabel[micPermission]}{muted ? ' · ミュート中' : ''}</span>
      </div>

      <div className="voice-call__scope">
        ゲーム内限定：Codex 2040のTiboトークンだけをリセットします。OpenAIアカウント、請求、API上限、権限は変更できません。
      </div>

      <div className="voice-call__transcript" aria-label="音声通話の字幕" aria-live="polite">
        {subtitles.length === 0 && <p className="voice-call__empty">通話を開始して「リミットをリセットして」と話してください。</p>}
        {subtitles.map((subtitle, index) => (
          <p key={`${subtitle.id}-${index}`} data-speaker={subtitle.speaker}><b>{subtitle.speaker === 'player' ? 'あなた' : subtitle.speaker === 'operator' ? 'キボ — ボイス・オペレーター' : 'システム'}</b><span>{subtitle.text}</span></p>
        ))}
        {operatorDraft && <p data-speaker="operator"><b>キボ — ボイス・オペレーター</b><span>{operatorDraft}</span></p>}
      </div>

      {status === 'fallback' && !pendingReset && (
        <button className="voice-call__script" onClick={onScriptedRequest}>台本で依頼 · 「リミットをリセットして」</button>
      )}

      {pendingReset && (
        <section className="voice-call__approval" aria-label="ゲーム内リセットの承認">
          <small>ツール要求 · {pendingReset.source === 'realtime' ? 'リアルタイム' : '台本モード'}</small>
          <b>trigger_token_reset</b>
          <p>“{pendingReset.playerRequest}”</p>
          <strong>{pendingReset.source === 'realtime' ? '「やって！」「お願い」など、実行の意思を声で伝えてください。ボタンでも操作できます。' : '承認すると、既存のゲーム内Tiboリセットを1回だけ実行します。'}</strong>
          <div>
            <button onClick={onRejectReset}><X size={14} /> 拒否</button>
            <button className="is-confirm" onClick={onApproveReset} disabled={resetCooldownSeconds > 0}>
              <Check size={14} /> {resetCooldownSeconds > 0 ? `再実行まで ${Math.ceil(resetCooldownSeconds)}秒` : 'ゲーム内リセットを承認'}
            </button>
          </div>
        </section>
      )}

      <p className="voice-call__notice" aria-live="polite">{resetNotice}</p>

      <footer>
        {!active && <button className="voice-call__primary" onClick={onStart}><Phone size={15} /> 通話を開始</button>}
        {active && <button className="voice-call__hangup" onClick={onEnd}><PhoneOff size={15} /> 通話を終了</button>}
        {status === 'connected' && <button aria-pressed={muted} onClick={onToggleMute}>{muted ? <MicOff size={15} /> : <Mic size={15} />}{muted ? 'ミュート解除' : 'ミュート'}</button>}
        <small>⌥V 開く・開始 · ⌥M ミュート · ⌥↵ 承認 · Esc 終了</small>
      </footer>
    </aside>
  )
}
