import { enforceInvariants, type GameState } from './engine'
import { RULESET_VERSION } from '../shared/ruleset'

export const SESSION_STORAGE_KEY = 'codex-2040:session:v2'
export const LEGACY_SESSION_STORAGE_KEY = 'codex-2040:session:v1'

export type PersistedSession = {
  version: 2
  rulesetVersion: typeof RULESET_VERSION
  savedAt: string
  hasStarted: boolean
  state: GameState
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')
const isFiniteNumberRecord = (value: unknown) => isObject(value)
  && Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item))
const isRivalStrategyArray = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every((portfolio) => (
  isObject(portfolio)
  && typeof portfolio.compute === 'number' && Number.isFinite(portfolio.compute)
  && isStringArray(portfolio.acquiredNodes)
  && typeof portfolio.nextDecisionDay === 'number' && Number.isFinite(portfolio.nextDecisionDay)
  && (portfolio.lastNodeId === null || typeof portfolio.lastNodeId === 'string')
))
const REGION_IDS = new Set(['na', 'latam', 'eu', 'africa', 'mena', 'india', 'eastAsia', 'oceania'])
const isRewardBubbleArray = (value: unknown) => Array.isArray(value) && value.every((bubble) => (
  isObject(bubble)
  && typeof bubble.id === 'string'
  && REGION_IDS.has(String(bubble.region))
  && typeof bubble.reward === 'number' && Number.isFinite(bubble.reward)
  && typeof bubble.placement === 'number' && Number.isFinite(bubble.placement)
  && typeof bubble.remainingSeconds === 'number' && Number.isFinite(bubble.remainingSeconds)
  && (bubble.source === 'token-reset' || bubble.source === 'community')
))

export const decodeSession = (raw: string | null): PersistedSession | null => {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed)
      || (parsed.version !== 1 && parsed.version !== 2)
      || (parsed.version === 2 && parsed.rulesetVersion !== RULESET_VERSION)
      || typeof parsed.savedAt !== 'string'
      || typeof parsed.hasStarted !== 'boolean') return null
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
      || ('flags' in state && !isStringArray(state.flags))
      || ('safetyGapDays' in state && (typeof state.safetyGapDays !== 'number' || !Number.isFinite(state.safetyGapDays) || state.safetyGapDays < 0))
      || ('interventions' in state && (typeof state.interventions !== 'number' || !Number.isFinite(state.interventions) || state.interventions < 0))
      || ('bubbleSeed' in state && (typeof state.bubbleSeed !== 'number' || !Number.isFinite(state.bubbleSeed)))
      || ('nextBubbleId' in state && (typeof state.nextBubbleId !== 'number' || !Number.isFinite(state.nextBubbleId) || state.nextBubbleId < 1))
      || ('rewardBubbles' in state && !isRewardBubbleArray(state.rewardBubbles))
      || ('rivalStrategies' in state && !isRivalStrategyArray(state.rivalStrategies))
      || ('acquiredStrategyNodes' in state && !isStringArray(state.acquiredStrategyNodes))
      || ('strategyNodePurchaseCounts' in state && !isFiniteNumberRecord(state.strategyNodePurchaseCounts))) return null
    const hydratedState = enforceInvariants(state as GameState)
    // A v1 terminal save may already have been reported by the previous
    // ruleset. Never hydrate it into a fresh v2 telemetry run and enqueue a
    // second zero-second completion. Active v1 games remain recoverable.
    if (parsed.version === 1 && hydratedState.terminal) return null
    return {
      version: 2,
      rulesetVersion: RULESET_VERSION,
      savedAt: parsed.savedAt,
      hasStarted: parsed.hasStarted,
      state: hydratedState,
    }
  } catch {
    return null
  }
}

export const encodeSession = (state: GameState, hasStarted: boolean, savedAt = new Date().toISOString()) => JSON.stringify({
  version: 2,
  rulesetVersion: RULESET_VERSION,
  savedAt,
  hasStarted,
  state,
} satisfies PersistedSession)
