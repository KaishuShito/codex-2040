import { STRATEGY_CATALOG } from './catalog'
import type { StrategyCategory, StrategyNode, StrategyNodeId } from './types'

export * from './catalog'
export * from './types'
export * from './validator'

export const STRATEGY_NODE_ALIASES = Object.freeze({
  'ecosystem-open-pledge': 'ecosystem-open',
  'ecosystem-regional-partners': 'ecosystem-partners',
  'ecosystem-model-commons': 'ecosystem-commons',
} satisfies Readonly<Record<string, StrategyNodeId>>)

export const STRATEGY_NODES_BY_ID: ReadonlyMap<StrategyNodeId, StrategyNode> = new Map(
  STRATEGY_CATALOG.map((node) => [node.id, node]),
)

export const resolveStrategyNodeId = (id: string): StrategyNodeId | undefined => {
  if (STRATEGY_NODES_BY_ID.has(id as StrategyNodeId)) return id as StrategyNodeId
  return STRATEGY_NODE_ALIASES[id as keyof typeof STRATEGY_NODE_ALIASES]
}

export const getStrategyNode = (id: string): StrategyNode | undefined => {
  const resolved = resolveStrategyNodeId(id)
  return resolved ? STRATEGY_NODES_BY_ID.get(resolved) : undefined
}

export const getStrategyNodesByCategory = (category: StrategyCategory): readonly StrategyNode[] =>
  STRATEGY_CATALOG.filter((node) => node.category === category)
