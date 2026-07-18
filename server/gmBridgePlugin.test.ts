// @ts-expect-error Test-only Node built-ins run under Vitest.
import { mkdtemp, mkdir, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
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
const RUN_A = 'run-12345678-1234-4123-8123-123456789abc'
const RUN_B = 'run-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const makeRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), 'codex-2040-gm-bridge-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const snapshot = (runId = RUN_A) => ({
  runId,
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

const turn = (runId = RUN_A, sentAtMs = SENT_AT_MS) => ({
  version: GM_BRIDGE_PROTOCOL_VERSION,
  runId,
  kind: 'heartbeat',
  sentAtMs,
  snapshot: snapshot(runId),
})

const validEvent = (
  runId = RUN_A,
  id = 'evt-12345678-1234-4123-8123-123456789abc',
) => ({
  runId,
  id,
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

describe('run-isolated GM bridge filesystem service', () => {
  it('atomically consumes an inbox turn into that run processed archive', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    const result = await service.submitTurn({ ...turn(), ignored: 'not persisted' })
    expect(result).toMatchObject({ ok: true, runId: RUN_A })
    if (!result.ok) return

    const runDirectories = service.getRunDirectories(RUN_A)
    expect(await readdir(runDirectories.inbox)).toEqual([result.fileName])
    expect((await readdir(runDirectories.inbox)).some((name: string) => name.endsWith('.tmp'))).toBe(false)
    expect(JSON.parse(await readFile(join(runDirectories.inbox, result.fileName), 'utf8'))).toEqual(turn())

    const consumed = await service.consumeTurns(RUN_A, 1)
    expect(consumed).toMatchObject({ ok: true, runId: RUN_A, turns: [{ fileName: result.fileName }] })
    expect(await readdir(runDirectories.inbox)).toEqual([])
    expect(await readdir(runDirectories.processedTurns)).toEqual([result.fileName])
    await expect(service.consumeTurns(RUN_A, 1)).resolves.toMatchObject({ turns: [] })
  })

  it('delivers two simultaneous runs only their own events', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    await Promise.all([service.submitTurn(turn(RUN_A)), service.submitTurn(turn(RUN_B))])
    const eventA = validEvent(RUN_A)
    const eventB = validEvent(RUN_B, 'evt-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    await Promise.all([service.submitEvent(eventA), service.submitEvent(eventB)])

    await expect(Promise.all([service.pollEvents(RUN_A), service.pollEvents(RUN_B)]))
      .resolves.toEqual([[eventA], [eventB]])
    await expect(Promise.all([service.pollEvents(RUN_A), service.pollEvents(RUN_B)]))
      .resolves.toEqual([[], []])
    expect(await readdir(service.getRunDirectories(RUN_A).processedEvents)).toEqual([`${eventA.id}.json`])
    expect(await readdir(service.getRunDirectories(RUN_B).processedEvents)).toEqual([`${eventB.id}.json`])
  })

  it('leaves partial JSON for retry and quarantines complete legacy or cross-run events', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    await service.submitTurn(turn(RUN_A))
    const runDirectories = service.getRunDirectories(RUN_A)
    const event = validEvent(RUN_A)
    const fileName = `${event.id}.json`
    const eventPath = join(runDirectories.events, fileName)
    await writeFile(eventPath, '{"id":"evt-', 'utf8')

    await expect(service.pollEvents(RUN_A)).resolves.toEqual([])
    expect(await readFile(eventPath, 'utf8')).toBe('{"id":"evt-')
    await writeFile(eventPath, JSON.stringify({ ...event, runId: undefined }), 'utf8')
    await expect(service.pollEvents(RUN_A)).resolves.toEqual([])
    expect(await readdir(runDirectories.quarantineEvents)).toEqual([fileName])

    const crossRun = validEvent(RUN_B, 'evt-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    await writeFile(join(runDirectories.events, `${crossRun.id}.json`), JSON.stringify(crossRun), 'utf8')
    await expect(service.pollEvents(RUN_A)).resolves.toEqual([])
    expect(await readdir(runDirectories.quarantineEvents)).toContain(`${crossRun.id}.json`)
  })

  it('uses the existing parser to clamp huge effects before returning an event', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
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
    await expect(service.submitEvent(event)).resolves.toMatchObject({ ok: true })
    const [parsed] = await service.pollEvents(RUN_A)
    expect(parsed.effect.users_delta_pct).toBe(GM_CONSTANTS.effectBounds.users_delta_pct.max)
    expect(parsed.effect.share_delta).toBe(GM_CONSTANTS.effectBounds.share_delta.min)
    expect(parsed.effect.trust_delta).toBe(GM_CONSTANTS.effectBounds.trust_delta.max)
    expect(parsed.ttl_days).toBe(GM_CONSTANTS.ttlDays.max)
  })

  it('dedupes by event ID inside a run without affecting another run', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    const eventA = validEvent(RUN_A)
    const eventB = validEvent(RUN_B)
    await expect(service.submitEvent(eventA)).resolves.toMatchObject({ ok: true })
    await expect(service.submitEvent(eventA)).resolves.toMatchObject({ ok: false, status: 409 })
    await expect(service.submitEvent(eventB)).resolves.toMatchObject({ ok: true })
    await expect(service.pollEvents(RUN_A)).resolves.toEqual([eventA])
    await expect(service.pollEvents(RUN_B)).resolves.toEqual([eventB])
    await expect(service.submitEvent(eventA)).resolves.toMatchObject({ ok: false, status: 409 })
  })

  it('compacts repeated heartbeats per run so an abandoned demo does not hit 429', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root, maxInboxFiles: 4 })
    for (let index = 0; index < 200; index += 1) {
      await expect(service.submitTurn(turn(RUN_A, SENT_AT_MS + index))).resolves.toMatchObject({ ok: true })
    }
    const runDirectories = service.getRunDirectories(RUN_A)
    expect((await readdir(runDirectories.inbox)).length).toBeLessThanOrEqual(4)
    expect((await readdir(runDirectories.expiredTurns)).length).toBeGreaterThan(0)
  })

  it('moves TTL-expired actions to a recoverable per-run archive', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root, inboxTtlMs: 1_000, now: () => 10_000 })
    const actionTurn = {
      ...turn(),
      kind: 'action',
      action: {
        runId: RUN_A,
        id: 'feature-1',
        kind: 'feature',
        input: '教育モード',
        receivedAtMs: 1_000,
      },
    }
    const result = await service.submitTurn(actionTurn)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const runDirectories = service.getRunDirectories(RUN_A)
    await utimes(join(runDirectories.inbox, result.fileName), new Date(0), new Date(0))
    await service.submitTurn(turn(RUN_A, SENT_AT_MS + 1))
    expect(await readdir(runDirectories.expiredTurns)).toContain(result.fileName)
  })

  it('rejects traversal, huge IDs, cross-run nesting, and unsafe timestamps', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    for (const runId of ['../events', `run-${'a'.repeat(10_000)}`, RUN_B]) {
      await expect(service.submitTurn({
        ...turn(),
        runId,
        snapshot: snapshot(RUN_A),
      })).resolves.toMatchObject({ ok: false, status: 400 })
    }
    for (const sentAtMs of [SENT_AT_MS + 0.25, 1e100, 1e3, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(service.submitTurn({ ...turn(), sentAtMs })).resolves.toMatchObject({
        ok: false,
        status: 400,
        error: 'invalid-turn',
      })
    }
    expect(() => service.getRunDirectories('../events')).toThrow('invalid-run-id')
  })

  it('moves protocol v1 root events and inbox turns into explicit legacy quarantine', async () => {
    const root = await makeRoot()
    const service = createGmBridgeService({ rootDirectory: root })
    await Promise.all([
      mkdir(service.directories.legacyEvents, { recursive: true }),
      mkdir(service.directories.legacyInbox, { recursive: true }),
    ])
    const legacy = { ...validEvent(), runId: undefined }
    const legacyTurnName = 'turn-1800000000000-11111111-1111-4111-8111-111111111111.json'
    await writeFile(join(service.directories.legacyEvents, `${legacy.id}.json`), JSON.stringify(legacy), 'utf8')
    await writeFile(join(service.directories.legacyInbox, legacyTurnName), '{"version":1}', 'utf8')
    await service.submitTurn(turn())
    expect(await readdir(service.directories.legacyEvents)).not.toContain(`${legacy.id}.json`)
    expect(await readdir(service.directories.legacyInbox)).not.toContain(legacyTurnName)
    expect(await readdir(service.directories.legacyQuarantine)).toContain(`${legacy.id}.json`)
    expect(await readdir(service.directories.legacyTurnQuarantine)).toContain(legacyTurnName)
  })
})

describe('GM bridge HTTP boundary', () => {
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
    expect(isAuthorizedGmBridgeRequest({ headers: { ...base.headers, host: 'attacker.example:5173' } })).toBe(false)
    expect(isAuthorizedGmBridgeRequest({
      headers: { ...base.headers, host: 'attacker@127.0.0.1:5173' },
    })).toBe(false)
    expect(isAuthorizedGmBridgeRequest({
      headers: { ...base.headers, origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    })).toBe(false)
  })

  it('does not let a stray cross-origin or run-less GET drain an event', async () => {
    const root = await makeRoot()
    let middleware
    gmBridgePlugin({ rootDirectory: root }).configureServer({
      middlewares: { use(handler) { middleware = handler } },
    })
    expect(middleware).toBeTypeOf('function')

    const service = createGmBridgeService({ rootDirectory: root })
    const event = validEvent()
    await service.submitEvent(event)
    const eventPath = join(service.getRunDirectories(RUN_A).events, `${event.id}.json`)

    const invoke = async (url: string, headers: Record<string, string>) => {
      let body = ''
      const response = {
        statusCode: 0,
        setHeader() {},
        end(value = '') { body = value },
      }
      await middleware({ method: 'GET', url, headers }, response, () => {})
      return { status: response.statusCode, body: JSON.parse(body) }
    }
    const baseHeaders = {
      host: '127.0.0.1:5173',
      origin: 'http://127.0.0.1:5173',
      'sec-fetch-site': 'same-origin',
      [GM_BRIDGE_REQUEST_HEADER]: GM_BRIDGE_REQUEST_HEADER_VALUE,
    }
    const hostile = await invoke(`${GM_BRIDGE_ENDPOINTS.events}?runId=${RUN_A}`, {
      ...baseHeaders,
      origin: 'https://attacker.example',
      'sec-fetch-site': 'cross-site',
    })
    expect(hostile).toEqual({ status: 403, body: { ok: false, error: 'forbidden-origin' } })
    expect(await readFile(eventPath, 'utf8')).toContain(RUN_A)

    await expect(invoke(GM_BRIDGE_ENDPOINTS.events, baseHeaders)).resolves.toMatchObject({ status: 400 })
    expect(await readFile(eventPath, 'utf8')).toContain(RUN_A)
    const local = await invoke(`${GM_BRIDGE_ENDPOINTS.events}?runId=${RUN_A}`, baseHeaders)
    expect(local).toMatchObject({ status: 200, body: { ok: true, runId: RUN_A, events: [event] } })
    await expect(readFile(eventPath, 'utf8')).rejects.toThrow()
  })
})
