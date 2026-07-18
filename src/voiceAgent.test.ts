import { describe, expect, it, vi } from 'vitest'
import { createKiboRealtimeAgent, REALTIME_MODEL, REALTIME_TRANSPORT } from './voiceAgent'

describe('official OpenAI Voice Agent configuration', () => {
  it('pins the Realtime model, WebRTC transport, fictional identity, and SDK function tool', async () => {
    const onToolCall = vi.fn(async () => ({ status: 'validated' }))
    const agent = createKiboRealtimeAgent(onToolCall)
    expect(REALTIME_MODEL).toBe('gpt-realtime-2.1')
    expect(REALTIME_TRANSPORT).toBe('webrtc')
    expect(agent.name).toBe('Kibo — Demo Operator')
    expect(agent.instructions).toContain('fictionalized demo operator')
    expect(agent.instructions).toContain('never call the confirmed tool automatically')

    const resetTool = agent.tools.find((candidate) => candidate.type === 'function' && candidate.name === 'trigger_token_reset')
    expect(resetTool).toMatchObject({ type: 'function', name: 'trigger_token_reset', strict: true })
    if (!resetTool || resetTool.type !== 'function') throw new Error('missing SDK reset tool')
    const result = await resetTool.invoke({} as never, JSON.stringify({
      player_request: 'ゲーム内Tiboトークンをリセットして',
      confirmed: false,
      approval_id: null,
      confirmation_utterance: null,
    }), { toolCall: { callId: 'call_sdk_1' } as never })
    expect(result).toEqual({ status: 'validated' })
    expect(onToolCall).toHaveBeenCalledWith(expect.objectContaining({
      type: 'function_call',
      name: 'trigger_token_reset',
      call_id: 'call_sdk_1',
    }))
  })
})
