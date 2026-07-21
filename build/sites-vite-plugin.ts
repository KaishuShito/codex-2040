import { access, cp, mkdir, rm } from 'node:fs/promises'
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
