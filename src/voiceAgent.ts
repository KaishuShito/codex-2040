import { RealtimeAgent, RealtimeSession, tool, type RealtimeItem } from '@openai/agents/realtime'
import { z } from 'zod'
import { RESET_TOOL_NAME, type RealtimeFunctionCall } from './voiceReset'

export type VoiceConnectionStatus = 'idle' | 'connecting' | 'connected' | 'fallback' | 'ended'
export type MicPermissionStatus = 'unknown' | 'requesting' | 'granted' | 'denied' | 'unavailable'

export type VoiceToolResult = Record<string, unknown>

type VoiceAgentCallbacks = {
  onStatus: (status: VoiceConnectionStatus) => void
  onMicPermission: (status: MicPermissionStatus) => void
  onTranscript: (speaker: 'player' | 'operator', text: string, final: boolean) => void
  onToolCall: (call: RealtimeFunctionCall) => VoiceToolResult | Promise<VoiceToolResult>
  onFailure: (reason: 'microphone-denied' | 'realtime-unavailable') => void
}

const CLIENT_SECRET_ENDPOINT = '/api/realtime/client-secret'
export const REALTIME_MODEL = 'gpt-realtime-2.1'
export const REALTIME_TRANSPORT = 'webrtc' as const

const OPERATOR_INSTRUCTIONS = [
  'あなたはCodex 2040のゲーム内にいる、架空の「キボ — ボイス・オペレーター」です。実在する人物やOpenAI社員を名乗ったり、模倣したりしないでください。',
  '汎用合成音声を使い、ライブ字幕に適した自然で簡潔な会話をしてください。プレイヤーが日本語なら日本語、英語なら英語で返答し、会話中はその言語を保ってください。',
  '利用できるリセットはゲーム内のTiboトークンリセットだけです。OpenAIアカウント、請求、APIレート制限、権限は一切変更しません。',
  'プレイヤーがゲーム内リミットまたはTiboトークンのリセットを明示的に依頼したら、trigger_token_resetをconfirmed=false、2つのnullableな確認フィールドをnullとして呼び出してください。',
  'ツールからconfirmation_requiredとapproval_idが返ったら、ゲーム内リセットを実行してよいか現在の会話言語で短く尋ね、新しい音声回答を待ってください。',
  '確認質問の後に限り、短く直接的な許可を明示的な承認として扱えます。日本語例：やって、やってください、お願い、進めて、実行して、いいよ、はい。英語例：Do it、Go ahead、Proceed、Yes、Sure、OK。',
  '承認されたら、confirmed=true、返された同一のapproval_id、プレイヤーの発話そのままのconfirmation_utteranceを指定して、ツールをもう一度呼び出してください。',
  'やらないで、やめて、いいえ、待って、cancel、stop、no、do not do itのような拒否・停止表現では絶対に承認しないでください。曖昧な返答なら現在の会話言語で確認し直してください。',
  '確認質問への新しい回答以外から承認を推測せず、confirmed=trueのツールを自動実行せず、自分の発話を承認として扱わないでください。',
  '画面上のUIにも音声承認が表示されます。通常の音声エージェント経路ではクリックは不要です。',
].join(' ')

const resetToolParameters = z.object({
  player_request: z.string().max(120),
  confirmed: z.boolean(),
  approval_id: z.string().max(160).nullable(),
  confirmation_utterance: z.string().max(120).nullable(),
})

type VoiceToolHandler = (call: RealtimeFunctionCall) => VoiceToolResult | Promise<VoiceToolResult>

export const createKiboRealtimeAgent = (onToolCall: VoiceToolHandler) => {
  const resetTool = tool({
    name: RESET_TOOL_NAME,
    description: 'Codex 2040のゲーム内Tiboトークンリセットだけを要求または実行します。「やって」や「Do it」のような短い直接的許可は、保留中の確認質問の後に限り有効です。実在するアカウント、請求、API上限、権限は変更しません。',
    parameters: resetToolParameters,
    execute: async (input, _context, details) => {
      const callId = details?.toolCall?.callId
      const call: RealtimeFunctionCall = {
        type: 'function_call',
        name: RESET_TOOL_NAME,
        call_id: typeof callId === 'string' ? callId : '',
        arguments: JSON.stringify(input),
      }
      return onToolCall(call)
    },
  })
  return new RealtimeAgent({
    name: 'キボ — ボイス・オペレーター',
    instructions: OPERATOR_INSTRUCTIONS,
    voice: 'marin',
    tools: [resetTool],
  })
}

const getMessageTranscript = (item: RealtimeItem) => {
  if (item.type !== 'message' || item.role === 'system' || item.status !== 'completed') return null
  const parts = item.content.flatMap((content) => {
    if (content.type === 'input_audio' || content.type === 'output_audio') return content.transcript ? [content.transcript] : []
    if (content.type === 'input_text' || content.type === 'output_text') return content.text ? [content.text] : []
    return []
  })
  const text = parts.join(' ').trim()
  if (!text) return null
  return { speaker: item.role === 'user' ? 'player' as const : 'operator' as const, text }
}

/** Official OpenAI Voice Agent wrapper: RealtimeAgent + RealtimeSession over browser WebRTC. */
export class RealtimeVoiceClient {
  private session: RealtimeSession | null = null
  private muted = false
  private ended = false
  private failed = false
  private generation = 0
  private readonly transcriptByItem = new Map<string, string>()

  constructor(private readonly callbacks: VoiceAgentCallbacks) {}

  async start() {
    const generation = ++this.generation
    this.session?.close()
    this.session = null
    this.ended = false
    this.failed = false
    this.callbacks.onStatus('connecting')
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      this.callbacks.onMicPermission('unavailable')
      this.fail('realtime-unavailable')
      return false
    }

    this.callbacks.onMicPermission('requesting')
    let candidateSession: RealtimeSession | null = null
    try {
      const tokenResponse = await fetch(CLIENT_SECRET_ENDPOINT, { method: 'POST', headers: { accept: 'application/json' } })
      const token = await tokenResponse.json() as { value?: unknown }
      if (!this.isCurrent(generation)) return false
      if (!tokenResponse.ok || typeof token.value !== 'string' || !token.value.startsWith('ek_')) throw new Error('realtime-unavailable')

      const agent = createKiboRealtimeAgent(this.callbacks.onToolCall)
      const session = new RealtimeSession(agent, {
        model: REALTIME_MODEL,
        transport: REALTIME_TRANSPORT,
        tracingDisabled: true,
        config: {
          outputModalities: ['audio'],
          audio: {
            input: {
              transcription: { model: 'gpt-4o-mini-transcribe' },
              turnDetection: { type: 'server_vad', createResponse: true, interruptResponse: true },
            },
            output: { voice: 'marin' },
          },
        },
      })
      candidateSession = session
      if (!this.isCurrent(generation)) {
        session.close()
        return false
      }
      this.session = session
      session.on('history_updated', (history) => {
        if (this.isCurrent(generation, session)) this.handleHistory(history)
      })
      session.on('error', () => {
        if (this.isCurrent(generation, session)) this.fail('realtime-unavailable')
      })
      await session.connect({ apiKey: token.value, model: REALTIME_MODEL })
      if (!this.isCurrent(generation, session)) {
        session.close()
        if (this.session === session) this.session = null
        return false
      }
      this.callbacks.onMicPermission('granted')
      this.callbacks.onStatus('connected')
      session.transport.requestResponse?.({
        output_modalities: ['audio'],
        instructions: 'Use the current conversation language if one is already established. Otherwise give one very brief bilingual greeting in Japanese and English. Say that you are a fictional demo operator who can help with the in-game Tibo reset. After the player speaks, continue only in their language.',
      })
      return true
    } catch (error) {
      candidateSession?.close()
      if (this.session === candidateSession) this.session = null
      if (!this.isCurrent(generation)) return false
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      this.callbacks.onMicPermission(denied ? 'denied' : 'unavailable')
      this.fail(denied ? 'microphone-denied' : 'realtime-unavailable')
      return false
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.session?.mute(muted)
    return this.muted
  }

  requestResponse(instructions: string) {
    this.session?.transport.requestResponse?.({ output_modalities: ['audio'], instructions })
  }

  end() {
    this.generation += 1
    this.ended = true
    this.session?.close()
    this.session = null
    this.callbacks.onStatus('ended')
  }

  private fail(reason: 'microphone-denied' | 'realtime-unavailable') {
    if (this.ended || this.failed) return
    this.failed = true
    this.callbacks.onFailure(reason)
  }

  private isCurrent(generation: number, session?: RealtimeSession) {
    return !this.ended && generation === this.generation && (!session || this.session === session)
  }

  private handleHistory(history: RealtimeItem[]) {
    for (const item of history) {
      const transcript = getMessageTranscript(item)
      if (!transcript || this.transcriptByItem.get(item.itemId) === transcript.text) continue
      this.transcriptByItem.set(item.itemId, transcript.text)
      this.callbacks.onTranscript(transcript.speaker, transcript.text, true)
    }
  }
}
