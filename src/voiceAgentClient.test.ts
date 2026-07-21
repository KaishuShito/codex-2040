import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => {
  type Resolver = () => void
  class MockRealtimeSession {
    static instances: MockRealtimeSession[] = []
    closed = false
    transport = { requestResponse: vi.fn() }
    connectPromise: Promise<void>
    resolveConnect: Resolver = () => undefined

    constructor() {
      this.connectPromise = new Promise<void>((resolve) => { this.resolveConnect = resolve })
      MockRealtimeSession.instances.push(this)
    }

    on() { return this }
    connect() { return this.connectPromise }
    close() { this.closed = true }
    mute() { return undefined }
  }

  class MockRealtimeAgent {
    name: string
    instructions: string
    voice: string
    tools: unknown[]

    constructor(config: { name: string; instructions: string; voice: string; tools: unknown[] }) {
      this.name = config.name
      this.instructions = config.instructions
      this.voice = config.voice
      this.tools = config.tools
    }
  }

  return { MockRealtimeAgent, MockRealtimeSession }
})

vi.mock('@openai/agents/realtime', () => ({
  RealtimeAgent: sdk.MockRealtimeAgent,
  RealtimeSession: sdk.MockRealtimeSession,
  tool: (config: Record<string, unknown>) => ({ type: 'function', strict: true, ...config }),
}))

import { RealtimeVoiceClient } from './voiceAgent'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const tokenResponse = () => ({
  ok: true,
  json: async () => ({ value: 'ek_test_client_secret' }),
}) as Response

const callbacks = () => ({
  onStatus: vi.fn(),
  onMicPermission: vi.fn(),
  onTranscript: vi.fn(),
  onToolCall: vi.fn(async () => ({})),
  onFailure: vi.fn(),
})

describe('RealtimeVoiceClient connection lifetime', () => {
  beforeEach(() => {
    sdk.MockRealtimeSession.instances.length = 0
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
    vi.stubGlobal('RTCPeerConnection', class {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not create or reconnect a session when the call ends while fetching a client secret', async () => {
    const response = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => response.promise))
    const handlers = callbacks()
    const client = new RealtimeVoiceClient(handlers)

    const starting = client.start()
    client.end()
    response.resolve(tokenResponse())

    await expect(starting).resolves.toBe(false)
    expect(sdk.MockRealtimeSession.instances).toHaveLength(0)
    expect(handlers.onStatus).not.toHaveBeenCalledWith('connected')
    expect(handlers.onFailure).not.toHaveBeenCalled()
  })

  it('closes a stale session and never reports connected when the call ends during connect', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => tokenResponse()))
    const handlers = callbacks()
    const client = new RealtimeVoiceClient(handlers)

    const starting = client.start()
    await vi.waitFor(() => expect(sdk.MockRealtimeSession.instances).toHaveLength(1))
    const session = sdk.MockRealtimeSession.instances[0]
    client.end()
    session.resolveConnect()

    await expect(starting).resolves.toBe(false)
    expect(session.closed).toBe(true)
    expect(handlers.onStatus).not.toHaveBeenCalledWith('connected')
    expect(handlers.onFailure).not.toHaveBeenCalled()
  })

  it('ignores an older delayed start without closing the newer connected session', async () => {
    const firstResponse = deferred<Response>()
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockResolvedValueOnce(tokenResponse())
    vi.stubGlobal('fetch', fetchMock)
    const handlers = callbacks()
    const client = new RealtimeVoiceClient(handlers)

    const firstStart = client.start()
    const secondStart = client.start()
    await vi.waitFor(() => expect(sdk.MockRealtimeSession.instances).toHaveLength(1))
    const currentSession = sdk.MockRealtimeSession.instances[0]
    currentSession.resolveConnect()
    await expect(secondStart).resolves.toBe(true)

    firstResponse.resolve(tokenResponse())
    await expect(firstStart).resolves.toBe(false)
    expect(currentSession.closed).toBe(false)
    expect(handlers.onStatus).toHaveBeenCalledWith('connected')
    expect(handlers.onFailure).not.toHaveBeenCalled()
  })
})
