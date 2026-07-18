export const RESET_TOOL_NAME = 'trigger_token_reset'

export type VoiceResetSource = 'realtime' | 'scripted-fallback'

export type VoiceResetRequest = {
  id: string
  callId: string
  playerRequest: string
  source: VoiceResetSource
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
  notice: 'No reset tool request is pending.',
})

const resetIntent = /(?:reset|リセット).{0,18}(?:limit|token|tibo|リミット|トークン)|(?:limit|token|tibo|リミット|トークン).{0,18}(?:reset|リセット)/iu
const confirmationDenial = /(?:やらない|しないで|やめて|止めて|キャンセル|取り消|待って|だめ|ダメ|いや|いいえ|不要|(?:do\s+not|don't|dont|never|cancel|stop|wait|no|nope|not)\b)/iu
const confirmationIntent = /(?:やって|実行して|進めて|リセットして|お願い(?:します)?|どうぞ|いいよ|オッケー|はい|うん|ええ|(?:do\s+it|go\s+ahead|proceed|execute\s+it|reset\s+it|yes|yeah|yep|sure|confirm|approve|ok|okay)\b)/iu

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
  if (!parsed || parsed.confirmed) return { ...state, notice: 'Invalid initial reset tool request rejected.' }
  if (state.pending?.callId === parsed.callId || state.completedCallIds.includes(parsed.callId)) {
    return { ...state, notice: 'Duplicate reset tool request ignored.' }
  }
  if (state.pending) return { ...state, notice: 'Another reset approval is already pending.' }
  return {
    ...state,
    pending: {
      id: `approval-${parsed.callId}`,
      callId: parsed.callId,
      playerRequest: parsed.playerRequest,
      source: 'realtime',
    },
    notice: 'Voice Agent requested the in-game reset. A separate spoken confirmation is required.',
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
  if (!parsed) return { state: { ...state, notice: 'Invalid reset tool request rejected.' }, outcome: 'invalid', request: state.pending, replyCallId: typeof raw.call_id === 'string' ? raw.call_id : null, shouldExecute: false }
  if (state.completedCallIds.includes(parsed.callId)) {
    return { state: { ...state, notice: 'Duplicate reset tool request ignored.' }, outcome: 'duplicate', request: state.pending, replyCallId: parsed.callId, shouldExecute: false }
  }
  if (!parsed.confirmed) {
    const next = requestRealtimeReset(state, raw)
    const accepted = next.pending !== null && next.pending !== state.pending
    return {
      state: next,
      outcome: accepted ? 'confirmation-required' : next.notice.startsWith('Duplicate') ? 'duplicate' : 'invalid',
      request: next.pending,
      replyCallId: parsed.callId,
      shouldExecute: false,
    }
  }
  const pending = state.pending
  if (!pending || parsed.approvalId !== pending.id) {
    return { state: { ...state, notice: 'Spoken confirmation did not match a pending approval.' }, outcome: 'invalid', request: pending, replyCallId: parsed.callId, shouldExecute: false }
  }
  if (resetCooldownSeconds > 0) {
    return {
      state: {
        pending: null,
        completedCallIds: [...state.completedCallIds, pending.callId, parsed.callId],
        notice: `Reset cooldown active for ${Math.ceil(resetCooldownSeconds)}s. Ask again after cooldown.`,
      },
      outcome: 'cooldown', request: pending, replyCallId: parsed.callId, shouldExecute: false,
    }
  }
  return {
    state: {
      pending: null,
      completedCallIds: [...state.completedCallIds, pending.callId, parsed.callId],
      notice: 'Spoken confirmation accepted. In-game Tibo reset executed once.',
    },
    outcome: 'executed', request: pending, replyCallId: parsed.callId, shouldExecute: true,
  }
}

export const requestFallbackReset = (state: VoiceResetState, id: string): VoiceResetState => {
  const callId = `fallback-${id.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 80)}`
  if (!callId || state.pending || state.completedCallIds.includes(callId)) {
    return { ...state, notice: state.pending ? 'Another reset approval is already pending.' : 'Duplicate fallback request ignored.' }
  }
  return {
    ...state,
    pending: {
      id: callId,
      callId,
      playerRequest: 'ゲーム内Tiboトークンのリミットをリセットして',
      source: 'scripted-fallback',
    },
    notice: 'Scripted fallback requested the in-game reset. Player confirmation is required.',
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
  if (!request) return { state: { ...state, notice: 'No reset approval was pending.' }, outcome: 'missing', request: null, shouldExecute: false }
  if (state.completedCallIds.includes(request.callId)) {
    return { state: { ...state, pending: null, notice: 'Duplicate reset execution blocked.' }, outcome: 'duplicate', request, shouldExecute: false }
  }
  if (!approved) {
    return { state: { ...state, pending: null, completedCallIds: [...state.completedCallIds, request.callId], notice: 'Player rejected the in-game reset.' }, outcome: 'rejected', request, shouldExecute: false }
  }
  if (resetCooldownSeconds > 0) {
    return { state: { ...state, notice: `Reset cooldown active for ${Math.ceil(resetCooldownSeconds)}s.` }, outcome: 'cooldown', request, shouldExecute: false }
  }
  return {
    state: {
      pending: null,
      completedCallIds: [...state.completedCallIds, request.callId],
      notice: 'Player confirmed. In-game Tibo reset executed once.',
    },
    outcome: 'executed',
    request,
    shouldExecute: true,
  }
}
