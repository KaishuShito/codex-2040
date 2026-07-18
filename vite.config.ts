import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { gmBridgePlugin } from './server/gmBridgePlugin.js'
import { realtimePlugin } from './server/realtimePlugin.js'

export default defineConfig(({ mode }) => {
  // Explicitly load the unprefixed server credential. It is passed only to the
  // dev-server plugin and is never exposed through Vite's client import.meta.env.
  const serverEnv = loadEnv(mode, process.cwd(), 'OPENAI_API_KEY')
  return {
    plugins: [react(), gmBridgePlugin(), realtimePlugin({ apiKey: serverEnv.OPENAI_API_KEY })],
    server: { host: '127.0.0.1', port: 5173 },
  }
})
