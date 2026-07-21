import { z } from 'zod'
import {
  createRunsRepository,
  type AuthorizedCompleteRunInput,
  type RunLanguage,
  type RunRecord,
  type RunsRepository,
} from './d1'

const MAX_JSON_BYTES = 4_096

const playIdSchema = z.string().uuid()
const timestampSchema = z.string().datetime({ offset: true })
const rulesetVersionSchema = z.string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)

const startRunSchema = z.object({
  play_id: playIdSchema,
  ruleset_version: rulesetVersionSchema,
  language: z.enum(['ja', 'en']),
  started_at: timestampSchema,
}).strict()

const completeRunSchema = z.object({
  completion_token: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
  completed_at: timestampSchema,
  final_score: z.number().int().min(0).max(100),
  rank: z.enum(['S', 'A', 'B', 'C']),
  ending: z.enum([
    'beneficial-abundance',
    'managed-transition',
    'fragile-abundance',
    'race-future',
    'regulatory-freeze',
    'safety-incident',
    'misalignment',
    'pyrrhic-monopoly',
  ]),
  choice_2029: z.enum(['race', 'slowdown', 'verified-slowdown']).nullable(),
  choice_2035: z.enum(['hold-the-line', 'accelerate']).nullable(),
  active_play_seconds: z.number().int().min(0).max(21_600),
}).strict()

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(
  JSON.stringify(body),
  { status, headers: { ...jsonHeaders, ...headers } },
)

const errorResponse = (status: number, code: string, message: string) =>
  json({ ok: false, error: { code, message } }, status)

const methodNotAllowed = (allow: string) => new Response(
  JSON.stringify({ ok: false, error: { code: 'method_not_allowed', message: 'Method not allowed.' } }),
  { status: 405, headers: { ...jsonHeaders, allow } },
)

const hasSameOrigin = (request: Request) => {
  const origin = request.headers.get('origin')
  return origin === new URL(request.url).origin
}

const createCompletionToken = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

const publicRun = ({ completion_token: _, ...run }: RunRecord) => run

const parsePlayIdSegment = (segment: string) => {
  try {
    const playId = decodeURIComponent(segment)
    return playIdSchema.safeParse(playId).success ? playId : null
  } catch {
    return null
  }
}

const readJson = async (request: Request) => {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    return { ok: false as const, response: errorResponse(415, 'unsupported_media_type', 'Content-Type must be application/json.') }
  }

  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    return { ok: false as const, response: errorResponse(413, 'payload_too_large', 'JSON body is too large.') }
  }

  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BYTES) {
    return { ok: false as const, response: errorResponse(413, 'payload_too_large', 'JSON body is too large.') }
  }

  try {
    return { ok: true as const, value: JSON.parse(body) as unknown }
  } catch {
    return { ok: false as const, response: errorResponse(400, 'invalid_json', 'Request body must contain valid JSON.') }
  }
}

const validateBody = async <T extends z.ZodType>(request: Request, schema: T) => {
  const parsedJson = await readJson(request)
  if (!parsedJson.ok) return parsedJson
  const parsed = schema.safeParse(parsedJson.value)
  if (!parsed.success) {
    return { ok: false as const, response: errorResponse(400, 'invalid_request', 'Request body does not match the API contract.') }
  }
  return { ok: true as const, value: parsed.data as z.infer<T> }
}

export type RunsApiEnv = { DB: D1Database }

export type RunsApiDependencies = {
  repository?: RunsRepository
}

export async function handleRunsApi(
  request: Request,
  env: RunsApiEnv,
  dependencies: RunsApiDependencies = {},
): Promise<Response | null> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/runs')) return null

  const repository = dependencies.repository ?? createRunsRepository(env.DB)

  try {
    if (url.pathname === '/api/runs/start') {
      if (request.method !== 'POST') return methodNotAllowed('POST')
      if (!hasSameOrigin(request)) return errorResponse(403, 'cross_origin_request', 'Cross-origin writes are not allowed.')

      const parsed = await validateBody(request, startRunSchema)
      if (!parsed.ok) return parsed.response
      const completionToken = createCompletionToken()
      const result = await repository.start({ ...parsed.value, completion_token: completionToken })
      if (result.status === 'conflict') {
        return errorResponse(409, 'play_id_conflict', 'This play_id already belongs to a different run.')
      }
      return json({
        ok: true,
        run: publicRun(result.run),
        completion_token: result.run.completion_token,
        duplicate: result.status === 'duplicate',
      }, result.status === 'created' ? 201 : 200)
    }

    if (url.pathname === '/api/runs/stats') {
      if (request.method !== 'GET') return methodNotAllowed('GET')
      const unexpectedQuery = [...url.searchParams.keys()].some((key) => key !== 'language')
      const languageValues = url.searchParams.getAll('language')
      if (unexpectedQuery || languageValues.length > 1) {
        return errorResponse(400, 'invalid_query', 'Only one language query parameter is supported.')
      }
      const languageValue = languageValues[0] ?? null
      if (languageValue !== null && languageValue !== 'ja' && languageValue !== 'en') {
        return errorResponse(400, 'invalid_language', 'language must be ja or en.')
      }

      const stats = await repository.stats(languageValue as RunLanguage | null)
      return json({ ok: true, stats }, 200, { 'cache-control': 'public, max-age=30' })
    }

    const completeMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/complete$/)
    if (completeMatch) {
      if (request.method !== 'POST') return methodNotAllowed('POST')
      if (!hasSameOrigin(request)) return errorResponse(403, 'cross_origin_request', 'Cross-origin writes are not allowed.')

      const playId = parsePlayIdSegment(completeMatch[1])
      if (!playId) return errorResponse(400, 'invalid_play_id', 'playId must be a UUID.')
      const parsed = await validateBody(request, completeRunSchema)
      if (!parsed.ok) return parsed.response

      const existing = await repository.get(playId)
      if (!existing) return errorResponse(404, 'run_not_found', 'Run not found.')
      if (Date.parse(parsed.value.completed_at) < Date.parse(existing.started_at)) {
        return errorResponse(400, 'invalid_completion_time', 'completed_at cannot be before started_at.')
      }

      const result = await repository.complete(playId, parsed.value as AuthorizedCompleteRunInput)
      if (result.status === 'not_found') return errorResponse(404, 'run_not_found', 'Run not found.')
      if (result.status === 'unauthorized') return errorResponse(403, 'invalid_completion_token', 'Completion token is invalid.')
      if (result.status === 'conflict') {
        return errorResponse(409, 'completion_conflict', 'This run was already completed with different results.')
      }

      const aggregate = await repository.aggregateFor(result.run)
      return json({ ok: true, run: publicRun(result.run), aggregate, duplicate: result.status === 'duplicate' })
    }

    const receiptMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/receipt$/)
    if (receiptMatch) {
      if (request.method !== 'GET') return methodNotAllowed('GET')
      const playId = parsePlayIdSegment(receiptMatch[1])
      if (!playId) return errorResponse(400, 'invalid_play_id', 'playId must be a UUID.')
      const run = await repository.get(playId)
      if (!run) return errorResponse(404, 'run_not_found', 'Run not found.')
      const aggregate = await repository.aggregateFor(run)
      return json({ ok: true, run: publicRun(run), aggregate })
    }

    return errorResponse(404, 'route_not_found', 'API route not found.')
  } catch {
    return errorResponse(503, 'storage_unavailable', 'Run storage is temporarily unavailable.')
  }
}
