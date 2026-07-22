import { describe, expect, it, vi } from 'vitest'
import { createTiboRealtimeAgent, REALTIME_MODEL, REALTIME_TRANSPORT } from './voiceAgent'

describe('OpenAI公式ボイス・オペレーターの設定', () => {
  it('Realtimeモデル、WebRTC、架空のバイリンガル話者、SDK function toolを固定する', async () => {
    const onToolCall = vi.fn(async () => ({ status: 'validated' }))
    const agent = createTiboRealtimeAgent(onToolCall)
    expect(REALTIME_MODEL).toBe('gpt-realtime-2.1')
    expect(REALTIME_TRANSPORT).toBe('webrtc')
    expect(agent.name).toBe('TIBO — ボイス・オペレーター')
    expect(agent.instructions).toContain('プレイヤーが日本語なら日本語、英語なら英語で返答')
    expect(agent.instructions).toContain('現在の会話言語で短く尋ね')
    expect(agent.instructions).toContain('実在する人物やOpenAI社員を名乗ったり、模倣したりしない')
    expect(agent.instructions).toContain('Do it')
    expect(agent.instructions).toContain('やって')
    expect(agent.instructions).toContain('do not do it')
    expect(agent.instructions).toContain('返された同一のapproval_id')
    expect(agent.instructions).toContain('confirmed=trueのツールを自動実行せず')

    const resetTool = agent.tools.find((candidate) => candidate.type === 'function' && candidate.name === 'trigger_token_reset')
    expect(resetTool).toMatchObject({ type: 'function', name: 'trigger_token_reset', strict: true })
    if (!resetTool || resetTool.type !== 'function') throw new Error('missing SDK reset tool')
    expect(resetTool.description).toContain('ゲーム内TIBOトークンリセットだけ')
    expect(resetTool.description).toContain('「Do it」')
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
