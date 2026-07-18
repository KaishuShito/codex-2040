import { randomUUID } from 'node:crypto'
import { mkdir, open, readdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { cwd } from 'node:process'
import { GM_CONSTANTS, isGmRunId, parseGmEvent, parseGmEventCycle } from '../src/gm'
import {
  GM_BRIDGE_ENDPOINTS,
  GM_BRIDGE_REQUEST_HEADER,
  GM_BRIDGE_REQUEST_HEADER_VALUE,
  sanitizeGmBridgeTurn,
} from '../src/gmBridgeClient'

// Kept as runtime JavaScript so vite.config's composite TypeScript project does
// not pull browser source files into its separate compilation boundary.
export const GM_BRIDGE_FILE_PROTOCOL = {
  runsDirectory: GM_CONSTANTS.runDirectory,
  legacyInboxDirectory: 'gm-bridge/inbox',
  legacyEventDirectory: GM_CONSTANTS.eventDirectory,
  legacyTurnQuarantineDirectory: 'gm-bridge/quarantine/legacy-turns',
  legacyQuarantineDirectory: 'gm-bridge/quarantine/legacy-events',
  inboxDirectory: 'inbox',
  eventDirectory: 'events',
  processedTurnDirectory: 'processed/turns',
  processedEventDirectory: 'processed/events',
  expiredTurnDirectory: 'processed/expired-turns',
  quarantineEventDirectory: 'quarantine/events',
  turnPrefix: 'turn-',
  turnSuffix: '.json',
}

const EVENT_FILE = /^evt-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/iu
const TURN_FILE = /^turn-[0-9]{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/iu
const MAX_REQUEST_BYTES = 64 * 1024
const DEFAULT_MAX_INBOX_FILES = 64
const DEFAULT_INBOX_TTL_MS = 15 * 60_000
const MAX_TURNS_PER_CONSUME = 16

const atomicWriteJson = async (directory, fileName, value) => {
  const finalPath = join(directory, fileName)
  const temporaryPath = join(directory, `.${fileName}.${randomUUID()}${GM_CONSTANTS.temporaryFileSuffix}`)
  const handle = await open(temporaryPath, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temporaryPath, finalPath)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

const destinationExists = async (path) => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const archiveFile = async (sourcePath, destinationDirectory, fileName) => {
  await mkdir(destinationDirectory, { recursive: true })
  const destinationPath = join(destinationDirectory, fileName)
  if (await destinationExists(destinationPath)) {
    await unlink(sourcePath).catch(() => undefined)
    return false
  }
  try {
    await rename(sourcePath, destinationPath)
    return true
  } catch {
    return false
  }
}

const parseJsonObject = (raw) => {
  try {
    const value = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/** Filesystem core, split from Vite middleware so atomic/retry behavior is integration-testable. */
export const createGmBridgeService = (options = {}) => {
  const rootDirectory = resolve(options.rootDirectory ?? cwd())
  const maxInboxFiles = Math.max(2, Math.floor(options.maxInboxFiles ?? DEFAULT_MAX_INBOX_FILES))
  const inboxTtlMs = Math.max(1_000, Math.floor(options.inboxTtlMs ?? DEFAULT_INBOX_TTL_MS))
  const now = options.now ?? Date.now
  const directories = {
    runs: resolve(rootDirectory, GM_BRIDGE_FILE_PROTOCOL.runsDirectory),
    legacyInbox: resolve(rootDirectory, GM_BRIDGE_FILE_PROTOCOL.legacyInboxDirectory),
    legacyEvents: resolve(rootDirectory, GM_BRIDGE_FILE_PROTOCOL.legacyEventDirectory),
    legacyTurnQuarantine: resolve(rootDirectory, GM_BRIDGE_FILE_PROTOCOL.legacyTurnQuarantineDirectory),
    legacyQuarantine: resolve(rootDirectory, GM_BRIDGE_FILE_PROTOCOL.legacyQuarantineDirectory),
  }
  const runTails = new Map()
  let legacyTail = Promise.resolve()

  const getRunDirectories = (runId) => {
    if (!isGmRunId(runId)) throw new Error('invalid-run-id')
    const runRoot = resolve(directories.runs, runId)
    return {
      root: runRoot,
      inbox: join(runRoot, GM_BRIDGE_FILE_PROTOCOL.inboxDirectory),
      events: join(runRoot, GM_BRIDGE_FILE_PROTOCOL.eventDirectory),
      processedTurns: join(runRoot, GM_BRIDGE_FILE_PROTOCOL.processedTurnDirectory),
      processedEvents: join(runRoot, GM_BRIDGE_FILE_PROTOCOL.processedEventDirectory),
      expiredTurns: join(runRoot, GM_BRIDGE_FILE_PROTOCOL.expiredTurnDirectory),
      quarantineEvents: join(runRoot, GM_BRIDGE_FILE_PROTOCOL.quarantineEventDirectory),
    }
  }

  const ensureRunDirectories = async (runId) => {
    const runDirectories = getRunDirectories(runId)
    await Promise.all(Object.values(runDirectories).map((directory) => mkdir(directory, { recursive: true })))
    return runDirectories
  }

  const quarantineLegacyEventsUnlocked = async () => {
    await Promise.all([
      mkdir(directories.runs, { recursive: true }),
      mkdir(directories.legacyInbox, { recursive: true }),
      mkdir(directories.legacyEvents, { recursive: true }),
      mkdir(directories.legacyTurnQuarantine, { recursive: true }),
      mkdir(directories.legacyQuarantine, { recursive: true }),
    ])
    const legacyTurns = (await readdir(directories.legacyInbox)).filter((fileName) => TURN_FILE.test(fileName))
    const legacyFiles = (await readdir(directories.legacyEvents)).filter((fileName) => EVENT_FILE.test(fileName))
    await Promise.all([
      ...legacyTurns.map((fileName) => archiveFile(
        join(directories.legacyInbox, fileName),
        directories.legacyTurnQuarantine,
        fileName,
      )),
      ...legacyFiles.map((fileName) => archiveFile(
        join(directories.legacyEvents, fileName),
        directories.legacyQuarantine,
        fileName,
      )),
    ])
  }

  const quarantineLegacyEvents = () => {
    const result = legacyTail.then(() => quarantineLegacyEventsUnlocked())
    legacyTail = result.then(() => undefined, () => undefined)
    return result
  }

  const withRunLock = (runId, operation) => {
    if (!isGmRunId(runId)) return Promise.reject(new Error('invalid-run-id'))
    const prior = runTails.get(runId) ?? Promise.resolve()
    const result = prior.then(operation)
    const tail = result.then(() => undefined, () => undefined)
    runTails.set(runId, tail)
    void tail.finally(() => {
      if (runTails.get(runId) === tail) runTails.delete(runId)
    })
    return result
  }

  const listTurnFiles = async (directory) => (await readdir(directory))
    .filter((fileName) => TURN_FILE.test(fileName))
    .sort()

  const cleanupExpiredTurnsUnlocked = async (runDirectories) => {
    const cutoff = now() - inboxTtlMs
    const files = await listTurnFiles(runDirectories.inbox)
    for (const fileName of files) {
      const sourcePath = join(runDirectories.inbox, fileName)
      let metadata
      try {
        metadata = await stat(sourcePath)
      } catch {
        continue
      }
      if (metadata.mtimeMs >= cutoff) continue
      await archiveFile(sourcePath, runDirectories.expiredTurns, fileName)
    }
  }

  // Preserve all player actions and the newest liveness sample. Only redundant
  // snapshot/heartbeat files are compacted when an abandoned run reaches its cap.
  const compactLivenessTurnsUnlocked = async (runDirectories) => {
    let files = await listTurnFiles(runDirectories.inbox)
    if (files.length < maxInboxFiles) return
    const candidates = []
    for (const fileName of files) {
      try {
        const raw = await readFile(join(runDirectories.inbox, fileName), 'utf8')
        const turn = sanitizeGmBridgeTurn(parseJsonObject(raw))
        if (turn && turn.kind !== 'action') candidates.push(fileName)
      } catch {
        // A concurrently damaged file is never deleted by compaction.
      }
    }
    for (const fileName of candidates.slice(0, -1)) {
      if (files.length < maxInboxFiles) break
      if (await archiveFile(
        join(runDirectories.inbox, fileName),
        runDirectories.expiredTurns,
        fileName,
      )) files = files.filter((candidate) => candidate !== fileName)
    }
  }

  const submitTurnUnlocked = async (turn) => {
    await quarantineLegacyEvents()
    const runDirectories = await ensureRunDirectories(turn.runId)
    await cleanupExpiredTurnsUnlocked(runDirectories)
    await compactLivenessTurnsUnlocked(runDirectories)
    const files = await listTurnFiles(runDirectories.inbox)
    if (files.length >= maxInboxFiles) {
      return { ok: false, status: 429, error: 'inbox-full', runId: turn.runId }
    }
    const turnId = randomUUID()
    const fileName = `${GM_BRIDGE_FILE_PROTOCOL.turnPrefix}${turn.sentAtMs}-${turnId}${GM_BRIDGE_FILE_PROTOCOL.turnSuffix}`
    await atomicWriteJson(runDirectories.inbox, fileName, turn)
    return { ok: true, runId: turn.runId, turnId, fileName, turn }
  }

  const submitTurn = (raw) => {
    const turn = sanitizeGmBridgeTurn(raw)
    if (!turn) return Promise.resolve({ ok: false, status: 400, error: 'invalid-turn' })
    return withRunLock(turn.runId, () => submitTurnUnlocked(turn))
  }

  const consumeTurns = (runId, requestedLimit = 1) => {
    if (!isGmRunId(runId)) return Promise.resolve({ ok: false, status: 400, error: 'invalid-run-id' })
    const numericLimit = Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 1
    const limit = Math.max(1, Math.min(MAX_TURNS_PER_CONSUME, numericLimit))
    return withRunLock(runId, async () => {
      await quarantineLegacyEvents()
      const runDirectories = await ensureRunDirectories(runId)
      await cleanupExpiredTurnsUnlocked(runDirectories)
      const files = (await listTurnFiles(runDirectories.inbox)).slice(0, limit)
      const consumed = []
      for (const fileName of files) {
        const sourcePath = join(runDirectories.inbox, fileName)
        let turn
        try {
          turn = sanitizeGmBridgeTurn(parseJsonObject(await readFile(sourcePath, 'utf8')))
        } catch {
          continue
        }
        if (!turn || turn.runId !== runId) continue
        if (!await archiveFile(sourcePath, runDirectories.processedTurns, fileName)) continue
        consumed.push({ fileName, turn })
      }
      return { ok: true, runId, turns: consumed }
    })
  }

  const submitEvent = (raw) => {
    const candidate = typeof raw === 'string' ? parseJsonObject(raw) : raw
    const runId = candidate?.runId
    if (!isGmRunId(runId)) return Promise.resolve({ ok: false, status: 400, error: 'invalid-run-id' })
    const event = parseGmEvent(candidate, undefined, runId)
    if (!event) return Promise.resolve({ ok: false, status: 400, error: 'invalid-event', runId })
    return withRunLock(runId, async () => {
      await quarantineLegacyEvents()
      const runDirectories = await ensureRunDirectories(runId)
      const fileName = `${event.id}${GM_CONSTANTS.eventFileSuffix}`
      if (await destinationExists(join(runDirectories.events, fileName))
        || await destinationExists(join(runDirectories.processedEvents, fileName))) {
        return { ok: false, status: 409, error: 'duplicate-event', runId, eventId: event.id }
      }
      await atomicWriteJson(runDirectories.events, fileName, event)
      return { ok: true, status: 201, runId, eventId: event.id, fileName }
    })
  }

  const pollEvents = (runId) => {
    if (!isGmRunId(runId)) return Promise.reject(new Error('invalid-run-id'))
    return withRunLock(runId, async () => {
      await quarantineLegacyEvents()
      const runDirectories = await ensureRunDirectories(runId)
      const fileNames = (await readdir(runDirectories.events))
        .filter((fileName) => EVENT_FILE.test(fileName))
        .sort()
      const accepted = []
      for (const fileName of fileNames) {
        if (accepted.length >= GM_CONSTANTS.maxEventsPerCycle) break
        const sourcePath = join(runDirectories.events, fileName)
        let raw
        try {
          raw = await readFile(sourcePath, 'utf8')
        } catch {
          continue
        }
        const candidate = parseJsonObject(raw)
        // Incomplete JSON remains for retry. Complete legacy or cross-run JSON is
        // recoverably quarantined and can never be delivered to this run.
        if (!candidate) continue
        if (candidate.runId !== runId) {
          await archiveFile(sourcePath, runDirectories.quarantineEvents, fileName)
          continue
        }
        const event = parseGmEvent(candidate, undefined, runId)
        if (!event || basename(fileName) !== `${event.id}${GM_CONSTANTS.eventFileSuffix}`) continue

        const processedPath = join(runDirectories.processedEvents, fileName)
        if (await destinationExists(processedPath)) {
          await unlink(sourcePath).catch(() => undefined)
          continue
        }
        try {
          await rename(sourcePath, processedPath)
        } catch {
          continue
        }
        accepted.push(event)
      }
      return parseGmEventCycle(accepted, undefined, runId)
    })
  }

  return {
    directories,
    getRunDirectories,
    submitTurn,
    consumeTurns,
    submitEvent,
    pollEvents,
  }
}

const sendJson = (response, status, value) => {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('x-content-type-options', 'nosniff')
  response.end(`${JSON.stringify(value)}\n`)
}

const getSingleHeader = (request, name) => {
  const value = request.headers[name]
  return typeof value === 'string' ? value : null
}

const isLoopbackHost = (host) => {
  if (!/^(?:(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?|\[::1\](?::[0-9]{1,5})?)$/iu.test(host)) {
    return false
  }
  try {
    const hostname = new URL(`http://${host}`).hostname.toLowerCase()
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]'
  } catch {
    return false
  }
}

/** Reject browser cross-origin requests before GET can move a run's files. */
export const isAuthorizedGmBridgeRequest = (request) => {
  const host = getSingleHeader(request, 'host')
  if (!host || !isLoopbackHost(host)) return false
  if (getSingleHeader(request, GM_BRIDGE_REQUEST_HEADER) !== GM_BRIDGE_REQUEST_HEADER_VALUE) return false

  const fetchSite = getSingleHeader(request, 'sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false

  const origin = getSingleHeader(request, 'origin')
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:'
      && !parsed.username
      && !parsed.password
      && parsed.host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}

const readRequestJson = async (request) => {
  const contentType = request.headers['content-type']
  if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) {
    throw new Error('unsupported-content-type')
  }
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
    if (!(bytes instanceof Uint8Array)) throw new Error('invalid-body')
    total += bytes.byteLength
    if (total > MAX_REQUEST_BYTES) throw new Error('body-too-large')
    chunks.push(bytes)
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(body))
}

const queryRunId = (url) => {
  const runId = url.searchParams.get('runId')
  return isGmRunId(runId) ? runId : null
}

export const gmBridgePlugin = (options = {}) => ({
  name: 'codex-2040-local-gm-bridge',
  apply: 'serve',
  configureServer(server) {
    const service = createGmBridgeService(options)
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const path = url.pathname
      if ((path === GM_BRIDGE_ENDPOINTS.turns || path === GM_BRIDGE_ENDPOINTS.events)
        && !isAuthorizedGmBridgeRequest(request)) {
        sendJson(response, 403, { ok: false, error: 'forbidden-origin' })
        return
      }
      if (path === GM_BRIDGE_ENDPOINTS.turns) {
        if (request.method === 'GET') {
          const runId = queryRunId(url)
          if (!runId) {
            sendJson(response, 400, { ok: false, error: 'invalid-run-id' })
            return
          }
          try {
            const result = await service.consumeTurns(runId, Number(url.searchParams.get('limit') ?? 1))
            sendJson(response, result.ok ? 200 : result.status, result)
          } catch {
            sendJson(response, 503, { ok: false, error: 'bridge-unavailable' })
          }
          return
        }
        if (request.method !== 'POST') {
          sendJson(response, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        let body
        try {
          body = await readRequestJson(request)
        } catch {
          sendJson(response, 400, { ok: false, error: 'invalid-json' })
          return
        }
        try {
          const result = await service.submitTurn(body)
          if (!result.ok) {
            sendJson(response, result.status, result)
            return
          }
          sendJson(response, 201, {
            ok: true,
            runId: result.runId,
            turnId: result.turnId,
            fileName: result.fileName,
          })
        } catch {
          sendJson(response, 503, { ok: false, error: 'bridge-unavailable' })
        }
        return
      }
      if (path === GM_BRIDGE_ENDPOINTS.events) {
        if (request.method === 'POST') {
          let body
          try {
            body = await readRequestJson(request)
          } catch {
            sendJson(response, 400, { ok: false, error: 'invalid-json' })
            return
          }
          try {
            const result = await service.submitEvent(body)
            sendJson(response, result.ok ? 201 : result.status, result)
          } catch {
            sendJson(response, 503, { ok: false, error: 'bridge-unavailable' })
          }
          return
        }
        if (request.method !== 'GET') {
          sendJson(response, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const runId = queryRunId(url)
        if (!runId) {
          sendJson(response, 400, { ok: false, error: 'invalid-run-id' })
          return
        }
        try {
          sendJson(response, 200, { ok: true, runId, events: await service.pollEvents(runId) })
        } catch {
          sendJson(response, 503, { ok: false, error: 'bridge-unavailable' })
        }
        return
      }
      next()
    })
  },
})
