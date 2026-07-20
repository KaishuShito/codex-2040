import type { GameState } from './engine'

export const SESSION_STORAGE_KEY = 'codex-2040:session:v1'

export type PersistedSession = {
  version: 1
  savedAt: string
  hasStarted: boolean
  state: GameState
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')
const isFiniteNumberRecord = (value: unknown) => isObject(value)
  && Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item))

export const decodeSession = (raw: string | null): PersistedSession | null => {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed) || parsed.version !== 1 || typeof parsed.savedAt !== 'string' || typeof parsed.hasStarted !== 'boolean') return null
    const state = parsed.state
    if (!isObject(state)
      || typeof state.day !== 'number'
      || !Array.isArray(state.regions)
      || state.regions.length !== 8
      || !Array.isArray(state.news)
      || !Array.isArray(state.rivalShares)
      || !Array.isArray(state.rivalCapability)
      || !Array.isArray(state.rivalProduct)
      || !Array.isArray(state.rivalCompany)
      || ('acquiredStrategyNodes' in state && !isStringArray(state.acquiredStrategyNodes))
      || ('strategyNodePurchaseCounts' in state && !isFiniteNumberRecord(state.strategyNodePurchaseCounts))) return null
    return parsed as PersistedSession
  } catch {
    return null
  }
}

export const encodeSession = (state: GameState, hasStarted: boolean, savedAt = new Date().toISOString()) => JSON.stringify({
  version: 1,
  savedAt,
  hasStarted,
  state,
} satisfies PersistedSession)
