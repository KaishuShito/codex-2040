import { Check, Mic, MicOff, Phone, PhoneOff, Radio, X } from 'lucide-react'
import type { MicPermissionStatus, VoiceConnectionStatus } from '../voiceAgent'
import type { VoiceResetRequest } from '../voiceReset'

export type VoiceSubtitle = {
  id: string
  speaker: 'player' | 'operator' | 'system'
  text: string
}

const statusLabel: Record<VoiceConnectionStatus, { ja: string; en: string }> = {
  idle: { ja: '待機中', en: 'Idle' }, connecting: { ja: '接続中', en: 'Connecting' },
  connected: { ja: 'リアルタイム接続済み', en: 'Realtime connected' }, fallback: { ja: '台本モード', en: 'Scripted mode' }, ended: { ja: '通話終了', en: 'Call ended' },
}

const micLabel: Record<MicPermissionStatus, { ja: string; en: string }> = {
  unknown: { ja: 'マイク未要求', en: 'Microphone not requested' }, requesting: { ja: 'マイク許可を確認中', en: 'Requesting microphone' },
  granted: { ja: 'マイク許可済み', en: 'Microphone granted' }, denied: { ja: 'マイク拒否', en: 'Microphone denied' }, unavailable: { ja: 'マイク利用不可', en: 'Microphone unavailable' },
}

type VoiceCallPanelProps = {
  locale?: 'ja' | 'en'
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
  onScriptedRequest: (language: 'ja' | 'en') => void
  onApproveReset: () => void
  onRejectReset: () => void
}

export default function VoiceCallPanel({
  locale = 'ja',
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
  const approvalInEnglish = pendingReset?.language === 'en'
  return (
    <aside className="voice-call" role="dialog" aria-modal="false" aria-labelledby="voice-call-title">
      <header>
        <div><span className="voice-call__avatar"><Radio size={17} /></span><span><b id="voice-call-title">TIBO — {locale === 'ja' ? 'ボイス・オペレーター' : 'Voice Operator'}</b><small>{locale === 'ja' ? '架空のデモオペレーター · 汎用合成音声' : 'Fictional demo operator · generic synthetic voice'}</small></span></div>
        <button className="voice-call__close" onClick={onClose} aria-label={locale === 'ja' ? '音声通話パネルを閉じる' : 'Close voice call panel'}><X size={16} /></button>
      </header>

      <div className="voice-call__status" data-status={status} aria-live="polite">
        <span><i /> {statusLabel[status][locale]}</span><span>{micLabel[micPermission][locale]}{muted ? ` · ${locale === 'ja' ? 'ミュート中' : 'Muted'}` : ''}</span>
      </div>

      <div className="voice-call__scope">
        {locale === 'ja' ? 'ゲーム内限定：Codex 2040のTIBOトークンだけをリセットします。OpenAIアカウント、請求、API上限、権限は変更できません。' : 'In-game only: resets only Codex 2040 TIBO tokens. It cannot change your OpenAI account, billing, API limits, or permissions.'}
      </div>

      <div className="voice-call__transcript" aria-label={locale === 'ja' ? '音声通話の字幕' : 'Voice call transcript'} aria-live="polite">
        {subtitles.length === 0 && <p className="voice-call__empty">{locale === 'ja' ? '通話を開始して「リミットをリセットして」と話してください。' : 'Start the call and ask to reset the limit.'}</p>}
        {subtitles.map((subtitle, index) => (
          <p key={`${subtitle.id}-${index}`} data-speaker={subtitle.speaker}><b>{subtitle.speaker === 'player' ? (locale === 'ja' ? 'あなた' : 'You') : subtitle.speaker === 'operator' ? `TIBO — ${locale === 'ja' ? 'ボイス・オペレーター' : 'Voice Operator'}` : (locale === 'ja' ? 'システム' : 'System')}</b><span>{subtitle.text}</span></p>
        ))}
        {operatorDraft && <p data-speaker="operator"><b>TIBO — {locale === 'ja' ? 'ボイス・オペレーター' : 'Voice Operator'}</b><span>{operatorDraft}</span></p>}
      </div>

      {status === 'fallback' && !pendingReset && (
        <div className="voice-call__scripts" aria-label={locale === 'ja' ? '台本の言語を選択' : 'Choose scripted-request language'}>
          <button className="voice-call__script" onClick={() => onScriptedRequest('ja')}>日本語で依頼</button>
          <button className="voice-call__script" lang="en" onClick={() => onScriptedRequest('en')}>Request in English</button>
        </div>
      )}

      {pendingReset && (
        <section className="voice-call__approval" lang={approvalInEnglish ? 'en' : 'ja'} aria-label={approvalInEnglish ? 'Approve in-game reset' : 'ゲーム内リセットの承認'}>
          <small>{approvalInEnglish ? 'Tool request' : 'ツール要求'} · {pendingReset.source === 'realtime' ? (approvalInEnglish ? 'Realtime' : 'リアルタイム') : (approvalInEnglish ? 'Scripted fallback' : '台本モード')}</small>
          <b>trigger_token_reset</b>
          <p>“{pendingReset.playerRequest}”</p>
          <strong>{approvalInEnglish
            ? (pendingReset.source === 'realtime' ? 'Say “Do it” or another explicit approval. You can also use the buttons.' : 'Approval runs the existing in-game TIBO reset exactly once.')
            : (pendingReset.source === 'realtime' ? '「やって！」「お願い」など、実行の意思を声で伝えてください。ボタンでも操作できます。' : '承認すると、既存のゲーム内TIBOリセットを1回だけ実行します。')}</strong>
          <div>
            <button onClick={onRejectReset}><X size={14} /> {approvalInEnglish ? 'Reject' : '拒否'}</button>
            <button className="is-confirm" onClick={onApproveReset} disabled={resetCooldownSeconds > 0}>
              <Check size={14} /> {resetCooldownSeconds > 0
                ? (approvalInEnglish ? `Retry in ${Math.ceil(resetCooldownSeconds)}s` : `再実行まで ${Math.ceil(resetCooldownSeconds)}秒`)
                : (approvalInEnglish ? 'Approve in-game reset' : 'ゲーム内リセットを承認')}
            </button>
          </div>
        </section>
      )}

      <p className="voice-call__notice" aria-live="polite">{resetNotice}</p>

      <footer>
        {!active && <button className="voice-call__primary" onClick={onStart}><Phone size={15} /> {locale === 'ja' ? '通話を開始' : 'Start call'}</button>}
        {active && <button className="voice-call__hangup" onClick={onEnd}><PhoneOff size={15} /> {locale === 'ja' ? '通話を終了' : 'End call'}</button>}
        {status === 'connected' && <button aria-pressed={muted} onClick={onToggleMute}>{muted ? <MicOff size={15} /> : <Mic size={15} />}{muted ? (locale === 'ja' ? 'ミュート解除' : 'Unmute') : (locale === 'ja' ? 'ミュート' : 'Mute')}</button>}
        <small>{locale === 'ja' ? '⌥V 開く・開始 · ⌥M ミュート · ⌥↵ 承認 · Esc 終了' : '⌥V open/start · ⌥M mute · ⌥↵ approve · Esc end'}</small>
      </footer>
    </aside>
  )
}
