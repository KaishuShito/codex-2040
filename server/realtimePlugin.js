const REALTIME_CLIENT_SECRET_ENDPOINT = '/api/realtime/client-secret'
const OPENAI_CLIENT_SECRET_URL = 'https://api.openai.com/v1/realtime/client_secrets'

export const REALTIME_SESSION = Object.freeze({
  type: 'realtime',
  model: 'gpt-realtime-2.1',
  output_modalities: ['audio'],
  instructions: [
    'You are TIBO — Voice Operator, a fictionalized operator inside the Codex 2040 game.',
    'You are not a real OpenAI employee and must never imply that you are any real person.',
    'Use a generic synthetic voice and speak concise Japanese suitable for live subtitles.',
    'The only reset available is the in-game TIBO token reset. It never changes an OpenAI account, billing, API rate limits, or permissions.',
    'Call trigger_token_reset with confirmed false and both confirmation fields null only after the player explicitly asks to reset the in-game limit or TIBO tokens.',
    'The tool will return confirmation_required and an approval_id. Ask the player aloud whether to execute, then wait for a new spoken answer.',
    'After your confirmation question, accept short direct approvals such as やって, お願い, 進めて, 実行して, いいよ, はい, Do it, Go ahead, Proceed, Yes, Sure, or OK.',
    'Then call the tool again with confirmed true, the approval_id, and their exact confirmation_utterance.',
    'Do not confirm on やらないで, やめて, いいえ, 待って, cancel, stop, no, or do not do it. Ask again if unclear.',
    'Never infer confirmation outside the pending question and never call the confirmed tool automatically. The visible UI mirrors the voice approval but does not require a click.',
  ].join(' '),
  audio: {
    input: {
      transcription: { model: 'gpt-4o-mini-transcribe', language: 'ja' },
      turn_detection: { type: 'server_vad' },
    },
    output: { voice: 'marin' },
  },
})

const normalizeAllowedOrigins = (origins = []) => new Set(origins.flatMap((origin) => {
  if (typeof origin !== 'string' || origin.length === 0) return []
  try {
    return [new URL(origin).origin]
  } catch {
    return []
  }
}))

export const isAllowedRealtimeRequest = (request, allowedOrigins = []) => {
  const host = typeof request.headers.host === 'string' ? request.headers.host : ''
  if (!/^(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$/iu.test(host)) return false
  const fetchSite = request.headers['sec-fetch-site']
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false
  const origin = request.headers.origin
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    const isLoopbackOrigin = parsed.protocol === 'http:' && !parsed.username && !parsed.password && parsed.host.toLowerCase() === host.toLowerCase()
    return isLoopbackOrigin || normalizeAllowedOrigins(allowedOrigins).has(parsed.origin)
  } catch {
    return false
  }
}

const sendJson = (response, status, value) => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store, max-age=0')
  response.setHeader('pragma', 'no-cache')
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('referrer-policy', 'no-referrer')
  response.end(`${JSON.stringify(value)}\n`)
}

export const createRealtimeClientSecretService = ({ apiKey, fetchImpl = fetch } = {}) => ({
  async mint() {
    if (typeof apiKey !== 'string' || apiKey.length === 0) return { ok: false, status: 503, error: 'voice-fallback-required' }
    let upstream
    try {
      upstream = await fetchImpl(OPENAI_CLIENT_SECRET_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'OpenAI-Safety-Identifier': 'codex-2040-local-demo',
        },
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: 120 },
          session: REALTIME_SESSION,
        }),
      })
    } catch {
      return { ok: false, status: 503, error: 'voice-fallback-required' }
    }
    if (!upstream.ok) return { ok: false, status: 503, error: 'voice-fallback-required' }
    let data
    try {
      data = await upstream.json()
    } catch {
      return { ok: false, status: 503, error: 'voice-fallback-required' }
    }
    if (!data || typeof data.value !== 'string' || !data.value.startsWith('ek_')) {
      return { ok: false, status: 503, error: 'voice-fallback-required' }
    }
    return { ok: true, status: 200, value: data.value, expires_at: data.expires_at }
  },
})

export const realtimePlugin = (options = {}) => ({
  name: 'codex-2040-realtime-client-secret',
  apply: 'serve',
  configureServer(server) {
    const service = createRealtimeClientSecretService({
      apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
      fetchImpl: options.fetchImpl,
    })
    server.middlewares.use(async (request, response, next) => {
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      if (path !== REALTIME_CLIENT_SECRET_ENDPOINT) {
        next()
        return
      }
      if (!isAllowedRealtimeRequest(request, options.allowedOrigins)) {
        sendJson(response, 403, { ok: false, error: 'forbidden-origin' })
        return
      }
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'method-not-allowed' })
        return
      }
      const result = await service.mint()
      sendJson(response, result.status, result.ok
        ? { value: result.value, expires_at: result.expires_at }
        : { ok: false, error: result.error })
    })
  },
})

export { REALTIME_CLIENT_SECRET_ENDPOINT }
