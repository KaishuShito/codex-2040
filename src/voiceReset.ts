export const RESET_TOOL_NAME = 'trigger_token_reset'

export type VoiceResetSource = 'realtime' | 'scripted-fallback'
export type VoiceLanguage = 'ja' | 'en'

export type VoiceResetRequest = {
  id: string
  callId: string
  playerRequest: string
  source: VoiceResetSource
  language: VoiceLanguage
}

export type VoiceResetState = {
  pending: VoiceResetRequest | null
  completedCallIds: readonly string[]
  notice: string
}

export type RealtimeFunctionCall = {
  type?: unknown
  name?: unknown
  call_id?: unknown
  arguments?: unknown
}

export type ParsedResetToolCall = {
  callId: string
  playerRequest: string
  confirmed: boolean
  approvalId: string | null
  confirmationUtterance: string | null
}

export const createVoiceResetState = (): VoiceResetState => ({
  pending: null,
  completedCallIds: [],
  notice: '保留中のリセット要求はありません。',
})

const resetIntent = /(?:reset|リセット).{0,18}(?:limit|token|tibo|リミット|トークン)|(?:limit|token|tibo|リミット|トークン).{0,18}(?:reset|リセット)/iu
const confirmationDenial = /(?:やらない|しないで|やめて|止めて|キャンセル|取り消|待って|だめ|ダメ|いや|いいえ|不要|(?:do\s+not|don't|dont|never|cancel|stop|wait|no|nope|not)\b)/iu
const confirmationIntent = /(?:やって|実行して|進めて|リセットして|お願い(?:します)?|どうぞ|いいよ|オッケー|はい|うん|ええ|(?:do\s+it|go\s+ahead|proceed|execute\s+it|reset\s+it|yes|yeah|yep|sure|confirm|approve|ok|okay)\b)/iu

export const detectVoiceLanguage = (text: string): VoiceLanguage => /[\u3040-\u30ff\u3400-\u9fff]/u.test(text) ? 'ja' : 'en'

export const isExplicitResetConfirmation = (utterance: string) => {
  const normalized = utterance.normalize('NFKC').trim().slice(0, 120)
  return normalized.length > 0 && !confirmationDenial.test(normalized) && confirmationIntent.test(normalized)
}

export const parseResetToolCall = (raw: RealtimeFunctionCall): ParsedResetToolCall | null => {
  if (raw.type !== 'function_call' || raw.name !== RESET_TOOL_NAME) return null
  if (typeof raw.call_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(raw.call_id)) return null
  if (typeof raw.arguments !== 'string' || raw.arguments.length > 500) return null
  let args: unknown
  try {
    args = JSON.parse(raw.arguments)
  } catch {
    return null
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null
  const keys = Object.keys(args).sort()
  const playerRequest = Reflect.get(args, 'player_request')
  const confirmed = Reflect.get(args, 'confirmed')
  const approvalId = Reflect.get(args, 'approval_id')
  const confirmationUtterance = Reflect.get(args, 'confirmation_utterance')
  const allowedKeys = new Set(['approval_id', 'confirmation_utterance', 'confirmed', 'player_request'])
  if (keys.some((key) => !allowedKeys.has(key)) || typeof playerRequest !== 'string' || typeof confirmed !== 'boolean') return null
  const normalized = playerRequest.trim().slice(0, 120)
  if (!normalized || !resetIntent.test(normalized)) return null
  if (!confirmed) {
    if (keys.length !== 4 || approvalId !== null || confirmationUtterance !== null) return null
    return { callId: raw.call_id, playerRequest: normalized, confirmed: false, approvalId: null, confirmationUtterance: null }
  }
  if (keys.length !== 4
    || typeof approvalId !== 'string'
    || !/^approval-[A-Za-z0-9_-]{1,128}$/u.test(approvalId)
    || typeof confirmationUtterance !== 'string'
    || !isExplicitResetConfirmation(confirmationUtterance)) return null
  return {
    callId: raw.call_id,
    playerRequest: normalized,
    confirmed: true,
    approvalId,
    confirmationUtterance: confirmationUtterance.trim().slice(0, 120),
  }
}

export const requestRealtimeReset = (state: VoiceResetState, raw: RealtimeFunctionCall): VoiceResetState => {
  const parsed = parseResetToolCall(raw)
  if (!parsed || parsed.confirmed) return { ...state, notice: '無効な初回リセット要求を拒否しました。' }
  if (state.pending?.callId === parsed.callId || state.completedCallIds.includes(parsed.callId)) {
    return { ...state, notice: '重複したリセット要求を無視しました。' }
  }
  if (state.pending) return { ...state, notice: '別のリセット承認が保留中です。' }
  const language = detectVoiceLanguage(parsed.playerRequest)
  return {
    ...state,
    pending: {
      id: `approval-${parsed.callId}`,
      callId: parsed.callId,
      playerRequest: parsed.playerRequest,
      source: 'realtime',
      language,
    },
    notice: language === 'en'
      ? 'The voice operator requested an in-game reset. Approve explicitly in a new utterance.'
      : 'ボイス・オペレーターがゲーム内リセットを要求しました。別の発話で明示的に承認してください。',
  }
}

export type RealtimeResetToolResolution = {
  state: VoiceResetState
  outcome: 'confirmation-required' | 'executed' | 'cooldown' | 'invalid' | 'duplicate'
  request: VoiceResetRequest | null
  replyCallId: string | null
  shouldExecute: boolean
}

export const handleRealtimeResetToolCall = (
  state: VoiceResetState,
  raw: RealtimeFunctionCall,
  resetCooldownSeconds: number,
): RealtimeResetToolResolution => {
  const parsed = parseResetToolCall(raw)
  if (!parsed) return { state: { ...state, notice: '無効なリセット要求を拒否しました。' }, outcome: 'invalid', request: state.pending, replyCallId: typeof raw.call_id === 'string' ? raw.call_id : null, shouldExecute: false }
  if (state.completedCallIds.includes(parsed.callId)) {
    return { state: { ...state, notice: '重複したリセット要求を無視しました。' }, outcome: 'duplicate', request: state.pending, replyCallId: parsed.callId, shouldExecute: false }
  }
  if (!parsed.confirmed) {
    const next = requestRealtimeReset(state, raw)
    const accepted = next.pending !== null && next.pending !== state.pending
    return {
      state: next,
      outcome: accepted ? 'confirmation-required' : next.notice.startsWith('重複') ? 'duplicate' : 'invalid',
      request: next.pending,
      replyCallId: parsed.callId,
      shouldExecute: false,
    }
  }
  const pending = state.pending
  if (!pending || parsed.approvalId !== pending.id) {
    return { state: { ...state, notice: '音声確認のapproval_idが保留中の承認と一致しません。' }, outcome: 'invalid', request: pending, replyCallId: parsed.callId, shouldExecute: false }
  }
  if (resetCooldownSeconds > 0) {
    const seconds = Math.ceil(resetCooldownSeconds)
    return {
      state: {
        pending: null,
        completedCallIds: [...state.completedCallIds, pending.callId, parsed.callId],
        notice: pending.language === 'en'
          ? `Reset is cooling down. Ask again in ${seconds} seconds.`
          : `リセットのクールダウン中です。${seconds}秒後にもう一度依頼してください。`,
      },
      outcome: 'cooldown', request: pending, replyCallId: parsed.callId, shouldExecute: false,
    }
  }
  return {
    state: {
      pending: null,
      completedCallIds: [...state.completedCallIds, pending.callId, parsed.callId],
      notice: pending.language === 'en'
        ? 'Voice approval accepted. The in-game Tibo reset ran once.'
        : '音声での承認を受け付け、ゲーム内Tiboリセットを1回実行しました。',
    },
    outcome: 'executed', request: pending, replyCallId: parsed.callId, shouldExecute: true,
  }
}

export const requestFallbackReset = (state: VoiceResetState, id: string, language: VoiceLanguage = 'ja'): VoiceResetState => {
  const callId = `fallback-${id.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 80)}`
  if (!callId || state.pending || state.completedCallIds.includes(callId)) {
    return { ...state, notice: state.pending ? '別のリセット承認が保留中です。' : '重複した台本モードの要求を無視しました。' }
  }
  return {
    ...state,
    pending: {
      id: callId,
      callId,
      playerRequest: language === 'en'
        ? 'Please reset my in-game Tibo token limit.'
        : 'ゲーム内Tiboトークンのリミットをリセットして',
      source: 'scripted-fallback',
      language,
    },
    notice: language === 'en'
      ? 'Scripted mode requested an in-game reset. Player approval is required.'
      : '台本モードがゲーム内リセットを要求しました。プレイヤーの承認が必要です。',
  }
}

export type VoiceResetResolution = {
  state: VoiceResetState
  outcome: 'executed' | 'rejected' | 'cooldown' | 'missing' | 'duplicate'
  request: VoiceResetRequest | null
  shouldExecute: boolean
}

export const resolveVoiceReset = (
  state: VoiceResetState,
  approved: boolean,
  resetCooldownSeconds: number,
): VoiceResetResolution => {
  const request = state.pending
  if (!request) return { state: { ...state, notice: '保留中のリセット承認はありませんでした。' }, outcome: 'missing', request: null, shouldExecute: false }
  if (state.completedCallIds.includes(request.callId)) {
    return { state: { ...state, pending: null, notice: '重複したリセット実行をブロックしました。' }, outcome: 'duplicate', request, shouldExecute: false }
  }
  if (!approved) {
    return {
      state: {
        ...state,
        pending: null,
        completedCallIds: [...state.completedCallIds, request.callId],
        notice: request.language === 'en' ? 'The player rejected the in-game reset.' : 'プレイヤーがゲーム内リセットを拒否しました。',
      },
      outcome: 'rejected', request, shouldExecute: false,
    }
  }
  if (resetCooldownSeconds > 0) {
    const seconds = Math.ceil(resetCooldownSeconds)
    return {
      state: { ...state, notice: request.language === 'en' ? `Reset is cooling down. Try again in ${seconds} seconds.` : `リセットのクールダウン中です。残り${seconds}秒です。` },
      outcome: 'cooldown', request, shouldExecute: false,
    }
  }
  return {
    state: {
      pending: null,
      completedCallIds: [...state.completedCallIds, request.callId],
      notice: request.language === 'en'
        ? 'The player approved and the in-game Tibo reset ran once.'
        : 'プレイヤーが承認し、ゲーム内Tiboリセットを1回実行しました。',
    },
    outcome: 'executed',
    request,
    shouldExecute: true,
  }
}
