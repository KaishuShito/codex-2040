import { handleRunsApi, type RunsApiEnv } from '../server/runsApi'
import embeddedAssets from 'virtual:codex-2040-assets'

type Env = RunsApiEnv & {
  ASSETS?: Fetcher
}

type EmbeddedAsset = { data: string; contentType: string }
const assets = embeddedAssets as Record<string, EmbeddedAsset>

const decodeAsset = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

const serveEmbeddedAsset = (request: Request, pathname: string) => {
  const asset = assets[pathname]
  if (!asset) return null
  const bytes = decodeAsset(asset.data)
  const headers = new Headers({
    'content-type': asset.contentType,
    'cache-control': pathname === '/index.html' ? 'no-cache' : 'public, max-age=86400',
    'accept-ranges': 'bytes',
  })
  const range = request.headers.get('range')?.match(/^bytes=(\d+)-(\d*)$/)
  if (range) {
    const start = Number(range[1])
    const end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1
    if (start >= bytes.length || end < start) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${bytes.length}` } })
    headers.set('content-range', `bytes ${start}-${end}/${bytes.length}`)
    headers.set('content-length', String(end - start + 1))
    return new Response(request.method === 'HEAD' ? null : bytes.slice(start, end + 1), { status: 206, headers })
  }
  headers.set('content-length', String(bytes.length))
  return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers })
}

const withRequestOriginMetadata = async (response: Response, requestUrl: string) => {
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  const origin = new URL(requestUrl).origin
  const html = (await response.text()).replaceAll('__SITE_ORIGIN__', origin)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(html, { status: response.status, statusText: response.statusText, headers })
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const apiResponse = await handleRunsApi(request, env)
    if (apiResponse) return apiResponse

    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
    const url = new URL(request.url)
    const direct = serveEmbeddedAsset(request, url.pathname === '/' ? '/index.html' : url.pathname)
    if (direct) return withRequestOriginMetadata(direct, request.url)

    const accept = request.headers.get('accept') ?? ''
    if (!accept.includes('text/html')) return new Response(null, { status: 404 })
    const fallback = serveEmbeddedAsset(request, '/index.html') ?? new Response(null, { status: 404 })
    return withRequestOriginMetadata(fallback, request.url)
  },
}

export default worker
