import { randomUUID } from 'node:crypto'
import { mkdir, open, readdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { cwd } from 'node:process'
import { GM_CONSTANTS, parseGmEvent, parseGmEventCycle } from '../src/gm'
import {
  GM_BRIDGE_ENDPOINTS,
  GM_BRIDGE_REQUEST_HEADER,
  GM_BRIDGE_REQUEST_HEADER_VALUE,
  sanitizeGmBridgeTurn,
} from '../src/gmBridgeClient'

// Kept as runtime JavaScript so vite.config's composite TypeScript project does
// not pull browser source files into its separate compilation boundary.
export const GM_BRIDGE_FILE_PROTOCOL = {
  inboxDirectory: 'gm-bridge/inbox',
  eventDirectory: GM_CONSTANTS.eventDirectory,
  processedDirectory: 'gm-bridge/processed',
  turnPrefix: 'turn-',
  turnSuffix: '.json',
}

const EVENT_FILE = /^evt-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/iu
const TURN_FILE = /^turn-[0-9]{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/iu
const MAX_REQUEST_BYTES = 64 * 1024
const DEFAULT_MAX_INBOX_FILES = 128

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

/** Filesystem core, split from Vite middleware so atomic/retry behavior is integration-testable. */
export const createGmBridgeService = (options = {}) => {
  const rootDirectory = resolve(options.rootDirectory ?? cwd())
  const maxInboxFiles = Math.max(1, Math.floor(options.maxInboxFiles ?? DEFAULT_MAX_INBOX_FILES))
  const directories = {
    inbox: resolve(rootDirectory, GM_BRIDGE_FILE_PROTOCOL.inboxDirectory),
    events: resolve(rootDirectory, GM_BRIDGE_FILE_PROTOCOL.eventDirectory),
    processed: resolve(rootDirectory, GM_BRIDGE_FILE_PROTOCOL.processedDirectory),
  }
  let inboxTail = Promise.resolve()
  let pollTail = Promise.resolve()

  const ensureDirectories = () => Promise.all(Object.values(directories).map((directory) =>
    mkdir(directory, { recursive: true })))

  const submitTurnUnlocked = async (raw) => {
    const turn = sanitizeGmBridgeTurn(raw)
    if (!turn) return { ok: false, status: 400, error: 'invalid-turn' }
    await ensureDirectories()
    const files = await readdir(directories.inbox)
    if (files.filter((fileName) => TURN_FILE.test(fileName)).length >= maxInboxFiles) {
      return { ok: false, status: 429, error: 'inbox-full' }
    }
    const turnId = randomUUID()
    const fileName = `${GM_BRIDGE_FILE_PROTOCOL.turnPrefix}${turn.sentAtMs}-${turnId}${GM_BRIDGE_FILE_PROTOCOL.turnSuffix}`
    await atomicWriteJson(directories.inbox, fileName, turn)
    return { ok: true, turnId, fileName, turn }
  }

  const submitTurn = (raw) => {
    const result = inboxTail.then(() => submitTurnUnlocked(raw))
    inboxTail = result.then(() => undefined, () => undefined)
    return result
  }

  const pollEventsUnlocked = async () => {
    await ensureDirectories()
    const fileNames = (await readdir(directories.events))
      .filter((fileName) => EVENT_FILE.test(fileName))
      .sort()
    const accepted = []
    for (const fileName of fileNames) {
      if (accepted.length >= GM_CONSTANTS.maxEventsPerCycle) break
      const sourcePath = join(directories.events, fileName)
      let raw
      try {
        raw = await readFile(sourcePath, 'utf8')
      } catch {
        continue
      }
      const event = parseGmEvent(raw)
      // A partial or invalid final file remains exactly where it is for a later retry.
      if (!event || basename(fileName) !== `${event.id}${GM_CONSTANTS.eventFileSuffix}`) continue

      const processedPath = join(directories.processed, fileName)
      if (await destinationExists(processedPath)) {
        // This ID was already delivered. Its archived first copy remains recoverable.
        await unlink(sourcePath).catch(() => undefined)
        continue
      }
      try {
        await rename(sourcePath, processedPath)
      } catch {
        // Another poll or writer may have touched it. Retry on the next GET.
        continue
      }
      accepted.push(event)
    }
    return parseGmEventCycle(accepted)
  }

  const pollEvents = () => {
    const result = pollTail.then(() => pollEventsUnlocked())
    pollTail = result.then(() => undefined, () => undefined)
    return result
  }

  return { directories, submitTurn, pollEvents }
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

/** Reject browser cross-origin requests before GET can move an event into processed/. */
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

export const gmBridgePlugin = (options = {}) => ({
  name: 'codex-2040-local-gm-bridge',
  apply: 'serve',
  configureServer(server) {
    const service = createGmBridgeService(options)
    server.middlewares.use(async (request, response, next) => {
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      if ((path === GM_BRIDGE_ENDPOINTS.turns || path === GM_BRIDGE_ENDPOINTS.events)
        && !isAuthorizedGmBridgeRequest(request)) {
        sendJson(response, 403, { ok: false, error: 'forbidden-origin' })
        return
      }
      if (path === GM_BRIDGE_ENDPOINTS.turns) {
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
          sendJson(response, 201, { ok: true, turnId: result.turnId, fileName: result.fileName })
        } catch {
          sendJson(response, 503, { ok: false, error: 'bridge-unavailable' })
        }
        return
      }
      if (path === GM_BRIDGE_ENDPOINTS.events) {
        if (request.method !== 'GET') {
          sendJson(response, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        try {
          sendJson(response, 200, { ok: true, events: await service.pollEvents() })
        } catch {
          sendJson(response, 503, { ok: false, error: 'bridge-unavailable' })
        }
        return
      }
      next()
    })
  },
})
