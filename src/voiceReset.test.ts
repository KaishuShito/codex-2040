import { describe, expect, it } from 'vitest'
import {
  createVoiceResetState,
  handleRealtimeResetToolCall,
  isExplicitResetConfirmation,
  parseResetToolCall,
  requestFallbackReset,
  resolveVoiceReset,
} from './voiceReset'

const validCall = (callId = 'call_reset_1') => ({
  type: 'function_call',
  name: 'trigger_token_reset',
  call_id: callId,
  arguments: JSON.stringify({
    player_request: 'ゲーム内Tiboトークンのリミットをリセットして',
    confirmed: false,
    approval_id: null,
    confirmation_utterance: null,
  }),
})

const confirmedCall = (approvalId: string, callId = 'call_confirm_1', utterance = 'はい、実行して') => ({
  ...validCall(callId),
  arguments: JSON.stringify({
    player_request: 'ゲーム内Tiboトークンのリミットをリセットして',
    confirmed: true,
    approval_id: approvalId,
    confirmation_utterance: utterance,
  }),
})

describe('voice reset tool approval contract', () => {
  it('uses Japanese notices without changing the reset state contract', () => {
    expect(createVoiceResetState()).toEqual({
      pending: null,
      completedCallIds: [],
      notice: '保留中のリセット要求はありません。',
    })
  })

  it('accepts only the exact strict tool schema with bounded reset intent', () => {
    expect(parseResetToolCall(validCall())).toMatchObject({ callId: 'call_reset_1', confirmed: false })
    expect(parseResetToolCall({ ...validCall(), name: 'reset_openai_account' })).toBeNull()
    expect(parseResetToolCall({ ...validCall(), arguments: JSON.stringify({ player_request: 'こんにちは', confirmed: false, approval_id: null, confirmation_utterance: null }) })).toBeNull()
    expect(parseResetToolCall({ ...validCall(), arguments: JSON.stringify({ player_request: 'limit reset', confirmed: false, approval_id: null, confirmation_utterance: null, extra: true }) })).toBeNull()
    expect(parseResetToolCall({ ...validCall(), arguments: '{' })).toBeNull()
  })

  it('requires a second explicit spoken confirmation before execution', () => {
    const requested = handleRealtimeResetToolCall(createVoiceResetState(), validCall(), 0)
    expect(requested.outcome).toBe('confirmation-required')
    expect(requested.shouldExecute).toBe(false)
    expect(requested.request?.id).toBe('approval-call_reset_1')
    expect(requested.state.notice).toContain('別の発話で明示的に承認')

    const mismatched = handleRealtimeResetToolCall(requested.state, confirmedCall('approval-wrong'), 0)
    expect(mismatched.outcome).toBe('invalid')
    expect(mismatched.shouldExecute).toBe(false)

    const confirmed = handleRealtimeResetToolCall(requested.state, confirmedCall('approval-call_reset_1'), 0)
    expect(confirmed.outcome).toBe('executed')
    expect(confirmed.shouldExecute).toBe(true)
    expect(confirmed.state.pending).toBeNull()
    expect(confirmed.state.notice).toBe('音声での承認を受け付け、ゲーム内Tiboリセットを1回実行しました。')
  })

  it('rejects missing or non-explicit spoken confirmation evidence', () => {
    const requested = handleRealtimeResetToolCall(createVoiceResetState(), validCall(), 0)
    expect(parseResetToolCall(confirmedCall('approval-call_reset_1', 'call_bad', 'たぶん'))).toBeNull()
    const missing = {
      ...confirmedCall('approval-call_reset_1'),
      arguments: JSON.stringify({
        player_request: 'Tibo token reset', confirmed: true, approval_id: 'approval-call_reset_1', confirmation_utterance: null,
      }),
    }
    expect(handleRealtimeResetToolCall(requested.state, missing, 0).outcome).toBe('invalid')
  })

  it.each([
    'やって！',
    'やってください',
    'お願い',
    'うん、進めて',
    'いいよ',
    'Do it!',
    'Go ahead.',
    'Sure, proceed',
    'OK',
    'Yes, do it',
  ])('accepts a short direct approval: %s', (utterance) => {
    expect(isExplicitResetConfirmation(utterance)).toBe(true)
    const requested = handleRealtimeResetToolCall(createVoiceResetState(), validCall(), 0)
    const confirmed = handleRealtimeResetToolCall(requested.state, confirmedCall('approval-call_reset_1', `call_${utterance.length}`, utterance), 0)
    expect(confirmed.outcome).toBe('executed')
    expect(confirmed.shouldExecute).toBe(true)
  })

  it.each([
    'やらないで',
    'やって、いや、やめて',
    '実行しないで',
    'いいえ',
    '待って',
    "Don't do it!",
    'Do not proceed',
    'No, cancel it',
    'No, do it',
    'Maybe later',
  ])('rejects a negative or unclear reply: %s', (utterance) => {
    expect(isExplicitResetConfirmation(utterance)).toBe(false)
    expect(parseResetToolCall(confirmedCall('approval-call_reset_1', `call_no_${utterance.length}`, utterance))).toBeNull()
  })

  it('blocks duplicate execution after a confirmed tool call', () => {
    const requested = handleRealtimeResetToolCall(createVoiceResetState(), validCall(), 0)
    const call = confirmedCall('approval-call_reset_1')
    const executed = handleRealtimeResetToolCall(requested.state, call, 0)
    expect(executed.shouldExecute).toBe(true)
    const duplicate = handleRealtimeResetToolCall(executed.state, call, 0)
    expect(duplicate.outcome).toBe('duplicate')
    expect(duplicate.shouldExecute).toBe(false)
  })

  it('blocks reset during cooldown and consumes stale approval', () => {
    const requested = handleRealtimeResetToolCall(createVoiceResetState(), validCall('call_cooldown'), 0)
    const blocked = handleRealtimeResetToolCall(requested.state, confirmedCall('approval-call_cooldown', 'call_cooldown_confirm'), 12.2)
    expect(blocked.outcome).toBe('cooldown')
    expect(blocked.shouldExecute).toBe(false)
    expect(blocked.state.pending).toBeNull()
    expect(handleRealtimeResetToolCall(blocked.state, confirmedCall('approval-call_cooldown', 'call_late'), 0).outcome).toBe('invalid')
  })

  it('makes scripted fallback visible and never automatic', () => {
    const requested = requestFallbackReset(createVoiceResetState(), 'demo-1')
    expect(requested.pending).toMatchObject({ source: 'scripted-fallback', callId: 'fallback-demo-1' })
    expect(requested.completedCallIds).toEqual([])
    const rejected = resolveVoiceReset(requested, false, 0)
    expect(rejected.shouldExecute).toBe(false)
    expect(rejected.outcome).toBe('rejected')
  })

  it('keeps English scripted fallback localized through approval, cooldown, rejection, and completion', () => {
    const requested = requestFallbackReset(createVoiceResetState(), 'demo-en', 'en')
    expect(requested.pending).toMatchObject({
      language: 'en',
      playerRequest: 'Please reset my in-game Tibo token limit.',
      source: 'scripted-fallback',
    })
    expect(requested.notice).toBe('Scripted mode requested an in-game reset. Player approval is required.')

    const cooldown = resolveVoiceReset(requested, true, 4.2)
    expect(cooldown.outcome).toBe('cooldown')
    expect(cooldown.state.notice).toBe('Reset is cooling down. Try again in 5 seconds.')

    const rejected = resolveVoiceReset(requested, false, 0)
    expect(rejected.state.notice).toBe('The player rejected the in-game reset.')

    const completed = resolveVoiceReset(requested, true, 0)
    expect(completed.shouldExecute).toBe(true)
    expect(completed.state.notice).toBe('The player approved and the in-game Tibo reset ran once.')
  })

  it('detects an English realtime request and keeps its confirmation notice in English', () => {
    const englishCall = {
      ...validCall('call_en'),
      arguments: JSON.stringify({
        player_request: 'Please reset my in-game Tibo token limit.',
        confirmed: false,
        approval_id: null,
        confirmation_utterance: null,
      }),
    }
    const requested = handleRealtimeResetToolCall(createVoiceResetState(), englishCall, 0)
    expect(requested.request?.language).toBe('en')
    expect(requested.state.notice).toBe('The voice operator requested an in-game reset. Approve explicitly in a new utterance.')
  })
})
