import { defineConfig } from 'vite'
import { embeddedSiteAssets, sites } from './build/sites-vite-plugin'

export default defineConfig({
  publicDir: false,
  plugins: [embeddedSiteAssets(), sites()],
  build: {
    emptyOutDir: false,
    outDir: 'dist/server',
    lib: {
      entry: 'worker/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
      },
    },
  },
})
