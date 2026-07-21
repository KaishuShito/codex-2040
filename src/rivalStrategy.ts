import { STRATEGY_CATALOG } from './strategyNodes/catalog'
import type {
  StrategyCategory,
  StrategyEffectDescriptor,
  StrategyNode,
  StrategyNodeId,
  StrategyPrerequisite,
} from './strategyNodes/types'

export const RIVAL_NAMES = ['ANTHRO', 'GOO', 'QI'] as const
export type RivalIndex = 0 | 1 | 2

export type RivalStrategyPortfolio = {
  compute: number
  acquiredNodes: StrategyNodeId[]
  nextDecisionDay: number
  lastNodeId: StrategyNodeId | null
}

export type RivalAxes = {
  capability: [number, number, number]
  product: [number, number, number]
  company: [number, number, number]
  shares: [number, number, number]
}

export type RivalStrategyMove = {
  rival: RivalIndex
  node: StrategyNode
  cost: number
  playerImpact: string
}

const PERSONAS = Object.freeze([
  {
    cadence: 56, income: 2.05,
    categories: { model: 2.4, product: 1.1, company: 4.2, ecosystem: 2.0 },
    metrics: { safety: 4, governance: 4, trust: 2.5, controlRelief: 3, capability: 1.2 },
    preferred: ['company-safety', 'company-transparency', 'model-verified-reasoning', 'company-distributed-oversight', 'company-alignment-institute'],
  },
  {
    cadence: 48, income: 2.35,
    categories: { model: 2.2, product: 4.2, company: 1.4, ecosystem: 3.2 },
    metrics: { momentum: 3, incomeMultiplier: 2.5, efficiency: 2, regionFit: 2, usersPopulationShare: 2, brand: 1.5 },
    preferred: ['product-mobile', 'product-connectors', 'product-agent-workspace', 'product-super-app', 'ecosystem-developer-grants'],
  },
  {
    cadence: 52, income: 2.2,
    categories: { model: 4.3, product: 2.0, company: 1.0, ecosystem: 2.4 },
    metrics: { capability: 4, efficiency: 3, opexMultiplier: 2, momentum: 2, regionFit: 2 },
    preferred: ['model-foundation', 'model-distillation', 'model-efficient-inference', 'ecosystem-open-weights-lite', 'model-agent-fleet'],
  },
] as const)

const FIRST_DECISION_DAYS = [42, 24, 33] as const
const INITIAL_COMPUTE = [125, 135, 130] as const

export const createInitialRivalStrategies = (day = 0): [RivalStrategyPortfolio, RivalStrategyPortfolio, RivalStrategyPortfolio] =>
  PERSONAS.map((_, index) => ({
    compute: INITIAL_COMPUTE[index],
    acquiredNodes: [],
    nextDecisionDay: day + FIRST_DECISION_DAYS[index],
    lastNodeId: null,
  })) as unknown as [RivalStrategyPortfolio, RivalStrategyPortfolio, RivalStrategyPortfolio]

export const normalizeRivalStrategies = (
  raw: unknown,
  day: number,
): [RivalStrategyPortfolio, RivalStrategyPortfolio, RivalStrategyPortfolio] => {
  const fallback = createInitialRivalStrategies(day)
  if (!Array.isArray(raw) || raw.length !== 3) return fallback
  return raw.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return fallback[index]
    const value = candidate as Partial<RivalStrategyPortfolio>
    const acquiredNodes = Array.isArray(value.acquiredNodes)
      ? [...new Set(value.acquiredNodes.filter((id): id is StrategyNodeId => STRATEGY_CATALOG.some((node) => node.id === id)))]
      : []
    return {
      compute: typeof value.compute === 'number' && Number.isFinite(value.compute) ? Math.max(0, value.compute) : fallback[index].compute,
      acquiredNodes,
      nextDecisionDay: typeof value.nextDecisionDay === 'number' && Number.isFinite(value.nextDecisionDay)
        ? Math.max(0, Math.floor(value.nextDecisionDay))
        : fallback[index].nextDecisionDay,
      lastNodeId: typeof value.lastNodeId === 'string' && acquiredNodes.includes(value.lastNodeId as StrategyNodeId)
        ? value.lastNodeId as StrategyNodeId
        : null,
    }
  }) as [RivalStrategyPortfolio, RivalStrategyPortfolio, RivalStrategyPortfolio]
}

export const rivalNodeCost = (node: StrategyNode) => {
  if (typeof node.baseCost === 'number') return node.baseCost
  if (node.category === 'product') return 90
  if (node.category === 'ecosystem') return 80
  if (node.category === 'company') return node.tier === 1 ? 100 : 140
  return ({ 1: 110, 2: 180, 3: 250, 4: 360 } as const)[node.tier]
}

const prerequisiteSatisfied = (prerequisite: StrategyPrerequisite, acquired: ReadonlySet<StrategyNodeId>): boolean => {
  if (prerequisite.kind === 'always') return true
  if (prerequisite.kind === 'node') return acquired.has(prerequisite.id)
  if (prerequisite.kind === 'all') return prerequisite.terms.every((term) => prerequisiteSatisfied(term, acquired))
  return prerequisite.terms.some((term) => prerequisiteSatisfied(term, acquired))
}

export const rivalNodeIsEligible = (node: StrategyNode, acquired: ReadonlySet<StrategyNodeId>) => {
  if (!node.enabled || acquired.has(node.id)) return false
  if (!prerequisiteSatisfied(node.prerequisite, acquired)) return false
  if (node.exclusions.some((id) => acquired.has(id))) return false
  return ![...acquired].some((id) => {
    const authoredNode: StrategyNode | undefined = STRATEGY_CATALOG.find((candidate) => candidate.id === id)
    return authoredNode?.exclusions.some((excludedId) => excludedId === node.id) ?? false
  })
}

const beneficialEffectScore = (effect: StrategyEffectDescriptor, weights: Readonly<Record<string, number | undefined>>) => {
  const weight = weights[effect.metric] ?? 0
  if (effect.operation === 'multiply') {
    const improvement = effect.metric === 'opexMultiplier' ? 1 - effect.value : effect.value - 1
    return weight * improvement * 12
  }
  const normalized = effect.metric === 'momentum' ? effect.value / 45
    : effect.metric === 'trust' ? effect.value / 4
      : effect.metric === 'brand' ? effect.value * 20
        : effect.metric === 'usersPopulationShare' ? effect.value * 1_000
          : effect.metric === 'controlRelief' ? effect.value * 4
            : effect.value
  return weight * Math.max(-1, normalized)
}

const nodeScore = (
  node: StrategyNode,
  rival: RivalIndex,
  context: Readonly<{ playerCapability: number; playerProduct: number; playerCompany: number; axes: RivalAxes }>,
) => {
  const persona = PERSONAS[rival]
  let score = persona.categories[node.category] + node.effects.reduce((sum, effect) => sum + beneficialEffectScore(effect, persona.metrics), 0)
  const preferredIndex = (persona.preferred as readonly string[]).indexOf(node.id)
  if (preferredIndex >= 0) score += 12 - preferredIndex * .7
  if (node.category === 'model' && context.axes.capability[rival] < context.playerCapability) score += 2.5
  if (node.category === 'product' && context.axes.product[rival] < context.playerProduct) score += 2
  if (node.category === 'company' && context.axes.company[rival] < context.playerCompany) score += 2
  // A tiny, stable tie-break preserves deterministic replays without consuming the main PRNG.
  return score - node.tier * .03 - STRATEGY_CATALOG.findIndex((candidate) => candidate.id === node.id) * .0001
}

const axisDelta = (node: StrategyNode) => {
  let capability = node.category === 'model' ? .42 : 0
  let product = node.category === 'product' ? .52 : node.category === 'ecosystem' ? .28 : 0
  let company = node.category === 'company' ? .52 : node.category === 'ecosystem' ? .18 : 0
  for (const effect of node.effects) {
    if (effect.metric === 'capability') capability += Math.max(0, effect.value) * .48
    if (effect.metric === 'safety' || effect.metric === 'governance') company += Math.max(0, effect.value) * .28
    if (effect.metric === 'trust' || effect.metric === 'brand') product += Math.max(0, effect.value) * .025
    if (effect.metric === 'efficiency') product += Math.max(0, effect.value) * .35
  }
  return { capability, product, company }
}

const categoryImpact: Readonly<Record<StrategyCategory, string>> = {
  model: '能力競争が加速し、CODEXの技術優位が縮まる',
  product: '利用者の選択肢が増え、CODEXの流通優位が縮まる',
  company: '安全性と実行力が強まり、規制市場での競争が激しくなる',
  ecosystem: '開発者と地域パートナーの獲得競争が激しくなる',
}

export const advanceRivalStrategies = (input: Readonly<{
  day: number
  portfolios: readonly RivalStrategyPortfolio[]
  axes: RivalAxes
  playerCapability: number
  playerProduct: number
  playerCompany: number
}>): Readonly<{
  portfolios: [RivalStrategyPortfolio, RivalStrategyPortfolio, RivalStrategyPortfolio]
  axes: RivalAxes
  moves: RivalStrategyMove[]
}> => {
  const portfolios = input.portfolios.map((portfolio) => ({ ...portfolio, acquiredNodes: [...portfolio.acquiredNodes] })) as [RivalStrategyPortfolio, RivalStrategyPortfolio, RivalStrategyPortfolio]
  const axes: RivalAxes = {
    capability: [...input.axes.capability] as RivalAxes['capability'],
    product: [...input.axes.product] as RivalAxes['product'],
    company: [...input.axes.company] as RivalAxes['company'],
    shares: [...input.axes.shares] as RivalAxes['shares'],
  }
  const moves: RivalStrategyMove[] = []

  for (let index = 0; index < 3; index += 1) {
    const rival = index as RivalIndex
    const persona = PERSONAS[rival]
    const portfolio = portfolios[rival]
    portfolio.compute += persona.income * (.72 + Math.max(0, axes.shares[rival]) * 2.2)
    if (input.day < portfolio.nextDecisionDay) continue
    const acquired = new Set(portfolio.acquiredNodes)
    const candidates = STRATEGY_CATALOG
      .filter((node) => rivalNodeIsEligible(node, acquired) && rivalNodeCost(node) <= portfolio.compute)
      .sort((a, b) => nodeScore(b, rival, { ...input, axes }) - nodeScore(a, rival, { ...input, axes }))
    const node = candidates[0]
    if (!node) {
      portfolio.nextDecisionDay = input.day + 12
      continue
    }
    const cost = rivalNodeCost(node)
    const delta = axisDelta(node)
    portfolio.compute -= cost
    portfolio.acquiredNodes.push(node.id)
    portfolio.lastNodeId = node.id
    portfolio.nextDecisionDay = input.day + persona.cadence
    axes.capability[rival] = Math.min(10, axes.capability[rival] + delta.capability)
    axes.product[rival] = Math.min(10, axes.product[rival] + delta.product)
    axes.company[rival] = Math.min(10, axes.company[rival] + delta.company)
    axes.shares[rival] += node.category === 'product' ? .004 : node.category === 'ecosystem' ? .003 : .0015
    moves.push({ rival, node, cost, playerImpact: categoryImpact[node.category] })
  }

  return { portfolios, axes, moves }
}
