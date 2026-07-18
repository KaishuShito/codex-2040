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
  'You are Kibo — Demo Operator, a fictionalized demo operator inside the Codex 2040 game.',
  'You are not a real OpenAI employee and must never imply that you are Kibo or any real person.',
  'Use a generic synthetic voice and concise Japanese suitable for live subtitles.',
  'The only reset available is the in-game Tibo token reset. It never changes an OpenAI account, billing, API rate limits, or permissions.',
  'When the player explicitly asks to reset the in-game limit or Tibo tokens, call trigger_token_reset with confirmed false and both nullable confirmation fields set to null.',
  'The tool returns confirmation_required and an approval_id. Ask aloud whether to execute, then wait for a new spoken answer.',
  'Only after the player separately and explicitly says yes or execute, call the tool again with confirmed true, that approval_id, and their exact confirmation_utterance.',
  'Never infer confirmation, never call the confirmed tool automatically, and never treat your own words as confirmation.',
  'The visible UI mirrors the voice approval; the normal Voice Agent path requires no click.',
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
    description: 'Request or execute only the Codex 2040 in-game Tibo token reset. Never changes real accounts, billing, API limits, or permissions.',
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
    name: 'Kibo — Demo Operator',
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
  private readonly transcriptByItem = new Map<string, string>()

  constructor(private readonly callbacks: VoiceAgentCallbacks) {}

  async start() {
    this.ended = false
    this.failed = false
    this.callbacks.onStatus('connecting')
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      this.callbacks.onMicPermission('unavailable')
      this.fail('realtime-unavailable')
      return false
    }

    this.callbacks.onMicPermission('requesting')
    try {
      const tokenResponse = await fetch(CLIENT_SECRET_ENDPOINT, { method: 'POST', headers: { accept: 'application/json' } })
      const token = await tokenResponse.json() as { value?: unknown }
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
              transcription: { model: 'gpt-4o-mini-transcribe', language: 'ja' },
              turnDetection: { type: 'server_vad', createResponse: true, interruptResponse: true },
            },
            output: { voice: 'marin' },
          },
        },
      })
      this.session = session
      session.on('history_updated', (history) => this.handleHistory(history))
      session.on('error', () => this.fail('realtime-unavailable'))
      await session.connect({ apiKey: token.value, model: REALTIME_MODEL })
      if (this.ended) return false
      this.callbacks.onMicPermission('granted')
      this.callbacks.onStatus('connected')
      session.transport.requestResponse?.({
        output_modalities: ['audio'],
        instructions: '短く名乗り、架空のデモオペレーターであることと、ゲーム内Tiboリセットを手伝えることを伝えてください。',
      })
      return true
    } catch (error) {
      this.session?.close()
      this.session = null
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

  private handleHistory(history: RealtimeItem[]) {
    for (const item of history) {
      const transcript = getMessageTranscript(item)
      if (!transcript || this.transcriptByItem.get(item.itemId) === transcript.text) continue
      this.transcriptByItem.set(item.itemId, transcript.text)
      this.callbacks.onTranscript(transcript.speaker, transcript.text, true)
    }
  }
}
