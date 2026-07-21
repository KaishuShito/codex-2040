import { handleRunsApi, type RunsApiEnv } from '../server/runsApi'

type Env = RunsApiEnv & {
  ASSETS: Fetcher
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

    const assetResponse = await env.ASSETS.fetch(request)
    if (assetResponse.status !== 404 || request.method !== 'GET') {
      return withRequestOriginMetadata(assetResponse, request.url)
    }

    const accept = request.headers.get('accept') ?? ''
    if (!accept.includes('text/html')) return assetResponse
    const fallback = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request))
    return withRequestOriginMetadata(fallback, request.url)
  },
}

export default worker
