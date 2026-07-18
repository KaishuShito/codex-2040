// @ts-expect-error Test-only Node built-ins run under Vitest.
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
// @ts-expect-error Test-only Node built-ins run under Vitest.
import { tmpdir } from 'node:os'
// @ts-expect-error Test-only Node built-ins run under Vitest.
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GM_CONSTANTS } from '../src/gm'
import {
  GM_BRIDGE_ENDPOINTS,
  GM_BRIDGE_PROTOCOL_VERSION,
  GM_BRIDGE_REQUEST_HEADER,
  GM_BRIDGE_REQUEST_HEADER_VALUE,
} from '../src/gmBridgeClient'
import {
  createGmBridgeService,
  gmBridgePlugin,
  isAuthorizedGmBridgeRequest,
} from './gmBridgePlugin.js'

const temporaryRoots: string[] = []
const SENT_AT_MS = 1_800_000_000_000

const makeRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), 'codex-2040-gm-bridge-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const snapshot = () => ({
  date: '2028-04-10',
  A_world: 0.22,
  S_c: 0.31,
  HHI: 0.28,
  T: 72,
  K: 4,
  S: 4,
  G: 3,
  topRegions: ['india'],
  recentEvents: [],
  playerInbox: [],
})

const turn = () => ({
  version: GM_BRIDGE_PROTOCOL_VERSION,
  kind: 'heartbeat',
  sentAtMs: SENT_AT_MS,
  snapshot: snapshot(),
})

const validEvent = () => ({
  id: 'evt-12345678-1234-4123-8123-123456789abc',
  date: '2028-04-10',
  type: 'news',
  headline: '世界のAIアクセスが拡大',
  region: 'global',
  effect: {
    users_delta_pct: 10,
    share_delta: 0.02,
    growth_rate_delta: 0.05,
    trust_delta: 1,
    target: 'codex',
  },
  flavor: '公開アクセスが新しい学習機会を生む。',
  ttl_days: 5,
})

describe('local GM bridge filesystem service', () => {
  it('writes one bounded inbox turn through a same-directory tmp rename', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root, maxInboxFiles: 1 })
    const result = await service.submitTurn({ ...turn(), ignored: 'not persisted' })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const inboxFiles = await readdir(service.directories.inbox)
    expect(inboxFiles).toEqual([result.fileName])
    expect(inboxFiles.some((fileName: string) => fileName.endsWith('.tmp'))).toBe(false)
    const saved = JSON.parse(await readFile(join(service.directories.inbox, result.fileName), 'utf8'))
    expect(saved).toEqual(turn())

    await expect(service.submitTurn(turn())).resolves.toMatchObject({
      ok: false,
      status: 429,
      error: 'inbox-full',
    })
  })

  it('leaves partial JSON in place and retries it successfully on the next poll', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    await mkdir(service.directories.events, { recursive: true })
    const fileName = `${validEvent().id}.json`
    const eventPath = join(service.directories.events, fileName)
    await writeFile(eventPath, '{"id":"evt-', 'utf8')

    await expect(service.pollEvents()).resolves.toEqual([])
    expect(await readFile(eventPath, 'utf8')).toBe('{"id":"evt-')

    await writeFile(eventPath, JSON.stringify(validEvent()), 'utf8')
    await expect(service.pollEvents()).resolves.toEqual([validEvent()])
    expect(await readdir(service.directories.events)).not.toContain(fileName)
    expect(await readdir(service.directories.processed)).toContain(fileName)
  })

  it('uses the existing parser to clamp huge effects before returning an event', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    await mkdir(service.directories.events, { recursive: true })
    const event = {
      ...validEvent(),
      effect: {
        ...validEvent().effect,
        users_delta_pct: 1e100,
        share_delta: -1e100,
        trust_delta: 1e100,
      },
      ttl_days: 1e100,
    }
    await writeFile(join(service.directories.events, `${event.id}.json`), JSON.stringify(event), 'utf8')

    const [parsed] = await service.pollEvents()
    expect(parsed.effect.users_delta_pct).toBe(GM_CONSTANTS.effectBounds.users_delta_pct.max)
    expect(parsed.effect.share_delta).toBe(GM_CONSTANTS.effectBounds.share_delta.min)
    expect(parsed.effect.trust_delta).toBe(GM_CONSTANTS.effectBounds.trust_delta.max)
    expect(parsed.ttl_days).toBe(GM_CONSTANTS.ttlDays.max)
  })

  it('archives by event ID and does not redeliver a duplicate file', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    await mkdir(service.directories.events, { recursive: true })
    const fileName = `${validEvent().id}.json`
    const eventPath = join(service.directories.events, fileName)
    await writeFile(eventPath, JSON.stringify(validEvent()), 'utf8')
    expect(await service.pollEvents()).toHaveLength(1)

    await writeFile(eventPath, JSON.stringify(validEvent()), 'utf8')
    await expect(service.pollEvents()).resolves.toEqual([])
    expect(await readdir(service.directories.events)).not.toContain(fileName)
    expect(await readdir(service.directories.processed)).toEqual([fileName])
  })

  it('rejects unsafe turn timestamps before creating an inbox filename', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    for (const sentAtMs of [SENT_AT_MS + 0.25, 1e100, 1e3, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(service.submitTurn({ ...turn(), sentAtMs })).resolves.toMatchObject({
        ok: false,
        status: 400,
        error: 'invalid-turn',
      })
    }
  })

  it('rejects non-loopback, missing-marker, and cross-origin request headers', () => {
    const base = {
      headers: {
        host: '127.0.0.1:5173',
        [GM_BRIDGE_REQUEST_HEADER]: GM_BRIDGE_REQUEST_HEADER_VALUE,
      },
    }
    expect(isAuthorizedGmBridgeRequest(base)).toBe(true)
    expect(isAuthorizedGmBridgeRequest({
      headers: { ...base.headers, origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'same-origin' },
    })).toBe(true)
    expect(isAuthorizedGmBridgeRequest({ headers: { host: '127.0.0.1:5173' } })).toBe(false)
    expect(isAuthorizedGmBridgeRequest({
      headers: { ...base.headers, host: 'attacker.example:5173' },
    })).toBe(false)
    expect(isAuthorizedGmBridgeRequest({
      headers: { ...base.headers, host: 'attacker@127.0.0.1:5173' },
    })).toBe(false)
    expect(isAuthorizedGmBridgeRequest({
      headers: { ...base.headers, origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    })).toBe(false)
  })

  it('does not let a stray cross-origin GET drain an event file', async () => {
    const root = await makeRoot()
    let middleware
    gmBridgePlugin({ rootDirectory: root }).configureServer({
      middlewares: { use(handler) { middleware = handler } },
    })
    expect(middleware).toBeTypeOf('function')

    const eventsDirectory = join(root, 'events')
    await mkdir(eventsDirectory, { recursive: true })
    const fileName = `${validEvent().id}.json`
    const eventPath = join(eventsDirectory, fileName)
    await writeFile(eventPath, JSON.stringify(validEvent()), 'utf8')

    const invoke = async (headers) => {
      let body = ''
      const response = {
        statusCode: 0,
        setHeader() {},
        end(value = '') { body = value },
      }
      await middleware({ method: 'GET', url: GM_BRIDGE_ENDPOINTS.events, headers }, response, () => {})
      return { status: response.statusCode, body: JSON.parse(body) }
    }

    const hostile = await invoke({
      host: '127.0.0.1:5173',
      origin: 'https://attacker.example',
      'sec-fetch-site': 'cross-site',
      [GM_BRIDGE_REQUEST_HEADER]: GM_BRIDGE_REQUEST_HEADER_VALUE,
    })
    expect(hostile).toEqual({ status: 403, body: { ok: false, error: 'forbidden-origin' } })
    expect(await readdir(eventsDirectory)).toContain(fileName)

    const local = await invoke({
      host: '127.0.0.1:5173',
      origin: 'http://127.0.0.1:5173',
      'sec-fetch-site': 'same-origin',
      [GM_BRIDGE_REQUEST_HEADER]: GM_BRIDGE_REQUEST_HEADER_VALUE,
    })
    expect(local.status).toBe(200)
    expect(local.body.events).toHaveLength(1)
    expect(await readdir(eventsDirectory)).not.toContain(fileName)
  })

  it('rejects a cross-origin POST before it can create an inbox file', async () => {
    const root = await makeRoot()
    let middleware
    gmBridgePlugin({ rootDirectory: root }).configureServer({
      middlewares: { use(handler) { middleware = handler } },
    })
    let responseBody = ''
    const response = {
      statusCode: 0,
      setHeader() {},
      end(value = '') { responseBody = value },
    }
    await middleware({
      method: 'POST',
      url: GM_BRIDGE_ENDPOINTS.turns,
      headers: {
        host: '127.0.0.1:5173',
        origin: 'https://attacker.example',
        'sec-fetch-site': 'cross-site',
        'content-type': 'application/json',
        [GM_BRIDGE_REQUEST_HEADER]: GM_BRIDGE_REQUEST_HEADER_VALUE,
      },
    }, response, () => {})

    expect(response.statusCode).toBe(403)
    expect(JSON.parse(responseBody)).toEqual({ ok: false, error: 'forbidden-origin' })
    await expect(readdir(join(root, 'gm-bridge', 'inbox'))).rejects.toThrow()
  })
})
