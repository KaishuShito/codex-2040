import { access, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const exists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** Package Sites-owned binding metadata and generated D1 migrations. */
export function sites(): Plugin {
  let root = process.cwd()

  return {
    name: 'codex-2040-sites-metadata',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    async closeBundle() {
      const outputDirectory = resolve(root, 'dist', '.openai')
      const hostingConfig = resolve(root, '.openai', 'hosting.json')
      const drizzleSource = resolve(root, 'drizzle')

      await rm(outputDirectory, { recursive: true, force: true })
      await mkdir(outputDirectory, { recursive: true })
      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, 'hosting.json'))
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, 'drizzle'), { recursive: true })
      }
    },
  }
}

const contentTypeFor = (path: string) => {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8'
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (path.endsWith('.css')) return 'text/css; charset=utf-8'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.m4a')) return 'audio/mp4'
  if (path.endsWith('.wav')) return 'audio/wav'
  if (path.endsWith('.txt') || path.endsWith('.md')) return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

const walkFiles = async (directory: string, prefix = ''): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (relative === 'server' || relative.startsWith('server/') || relative === '.openai' || relative.startsWith('.openai/')) return []
    return entry.isDirectory() ? walkFiles(resolve(directory, entry.name), relative) : [relative]
  }))
  return files.flat()
}

/**
 * Sites currently recognizes the Worker entrypoint for this non-vinext Vite
 * app but does not provision its static ASSETS namespace. Embed a compact
 * read-only asset manifest so the public deployment remains self-contained.
 */
export function embeddedSiteAssets(): Plugin {
  const moduleId = '\0virtual:codex-2040-assets'
  let root = process.cwd()
  return {
    name: 'codex-2040-embedded-assets',
    apply: 'build',
    configResolved(config) { root = config.root },
    resolveId(id) { return id === 'virtual:codex-2040-assets' ? moduleId : null },
    async load(id) {
      if (id !== moduleId) return null
      const outputDirectory = resolve(root, 'dist')
      const files = await walkFiles(outputDirectory)
      const manifest = Object.fromEntries(await Promise.all(files.map(async (relative) => {
        const data = (await readFile(resolve(outputDirectory, relative))).toString('base64')
        return [`/${relative}`, { data, contentType: contentTypeFor(relative) }]
      })))
      return `export default ${JSON.stringify(manifest)}`
    },
  }
}
