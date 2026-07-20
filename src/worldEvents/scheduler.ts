import type {
  WorldEventCategory,
  WorldEventCombo,
  WorldEventDefinition,
  WorldEventPresentation,
  WorldEventRequirements,
} from './types'

export const WORLD_EVENT_SCHEDULER_CONSTANTS = Object.freeze({
  globalCooldownDays: 20,
  categoryCooldownDays: 90,
  expectedIntervalDays: 67.5,
  popupSpacingDays: 120,
  popupRealtimeCooldownMs: 45_000,
})

// The refractory period contributes 20 days to the interval. A geometric wait
// of 47.5 days after it puts the idealized mean at 67.5 simulated days.
export const WORLD_EVENT_DAILY_TRIGGER_PROBABILITY =
  1 / (WORLD_EVENT_SCHEDULER_CONSTANTS.expectedIntervalDays
    - WORLD_EVENT_SCHEDULER_CONSTANTS.globalCooldownDays)

export type WorldEventSchedulerContext = {
  /** Stable run seed. This is read only and need not be the engine's current RNG state. */
  seed: number | string
  /** Integer simulated day, used as the deterministic date key. */
  day: number
  /** Current UTC simulation year. Date windows are inclusive. */
  year: number
  flags: readonly string[]
  features: readonly string[]
  trust: number
  capability: number
  worldAdoption: number
  codexShare: number
  firedEventIds?: readonly string[]
  lastEventDay?: number | null
  lastCategoryEventDay?: Readonly<Partial<Record<WorldEventCategory, number | null>>>
}

export type ScheduledWorldEvent = {
  definition: WorldEventDefinition
  combo: WorldEventCombo | null
  /** The scheduler does not apply popup rate limits; the presenter may downgrade it. */
  requestedPresentation: WorldEventPresentation
}

export type PopupPresentationContext = {
  day: number
  nowMs: number
  lastPopupDay?: number | null
  lastPopupAtMs?: number | null
}

const UINT32_RANGE = 0x1_0000_0000

const hashDateKey = (seed: number | string, day: number, salt: string) => {
  const key = `${String(seed)}:${day}:${salt}`
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Stateless date-key random value in [0, 1). Calling this never consumes or
 * mutates the simulation engine's RNG stream.
 */
export const worldEventDateRandom = (
  seed: number | string,
  day: number,
  salt = 'world-event',
) => {
  let value = hashDateKey(seed, day, salt)
  value += 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
}

const meetsMinimum = (value: number, minimum: number | undefined) =>
  minimum === undefined || value >= minimum

const meetsMaximum = (value: number, maximum: number | undefined) =>
  maximum === undefined || value <= maximum

export const matchesWorldEventRequirements = (
  requirements: WorldEventRequirements | undefined,
  context: Pick<
    WorldEventSchedulerContext,
    'flags' | 'features' | 'trust' | 'capability' | 'worldAdoption' | 'codexShare'
  >,
) => {
  if (!requirements) return true

  const flags = new Set(context.flags)
  if (requirements.flagsAny
    && !requirements.flagsAny.some((flag) => flags.has(flag))) return false
  if (requirements.flagsAll
    && !requirements.flagsAll.every((flag) => flags.has(flag))) return false

  if (requirements.featureTermsAny) {
    const features = context.features.map((feature) => feature.toLocaleLowerCase())
    const hasTerm = requirements.featureTermsAny.some((term) => {
      const normalized = term.trim().toLocaleLowerCase()
      return normalized.length > 0 && features.some((feature) => feature.includes(normalized))
    })
    if (!hasTerm) return false
  }

  return meetsMinimum(context.trust, requirements.minTrust)
    && meetsMaximum(context.trust, requirements.maxTrust)
    && meetsMinimum(context.capability, requirements.minCapability)
    && meetsMaximum(context.capability, requirements.maxCapability)
    && meetsMinimum(context.worldAdoption, requirements.minWorldAdoption)
    && meetsMaximum(context.worldAdoption, requirements.maxWorldAdoption)
    && meetsMinimum(context.codexShare, requirements.minCodexShare)
    && meetsMaximum(context.codexShare, requirements.maxCodexShare)
}

const elapsedAtLeast = (
  currentDay: number,
  priorDay: number | null | undefined,
  requiredDays: number,
) => priorDay === undefined || priorDay === null || currentDay - priorDay >= requiredDays

export const isWorldEventEligible = (
  definition: WorldEventDefinition,
  context: WorldEventSchedulerContext,
) => {
  if (context.year < definition.startYear || context.year > definition.endYear) return false
  if (context.firedEventIds?.includes(definition.id)) return false
  if (!elapsedAtLeast(
    context.day,
    context.lastCategoryEventDay?.[definition.category],
    WORLD_EVENT_SCHEDULER_CONSTANTS.categoryCooldownDays,
  )) return false
  return matchesWorldEventRequirements(definition.requires, context)
}

export const eligibleWorldEvents = (
  definitions: readonly WorldEventDefinition[],
  context: WorldEventSchedulerContext,
) => definitions.filter((definition) => isWorldEventEligible(definition, context))

export const matchWorldEventCombo = (
  definition: WorldEventDefinition,
  context: WorldEventSchedulerContext,
) => definition.combos?.find((combo) => matchesWorldEventRequirements(combo.requires, context)) ?? null

const selectWeightedDefinition = (
  definitions: readonly WorldEventDefinition[],
  random: number,
) => {
  // Canonical ordering keeps selection stable if category arrays are combined
  // in a different order by a caller.
  const ordered = [...definitions].sort((left, right) => left.id.localeCompare(right.id))
  const totalWeight = ordered.reduce((sum, definition) => sum + definition.weight, 0)
  let cursor = random * totalWeight
  for (const definition of ordered) {
    cursor -= definition.weight
    if (cursor < 0) return definition
  }
  return ordered.at(-1) ?? null
}

/**
 * Pure scheduling decision. History is supplied by the caller and no GameState
 * fields, definition objects, or arrays are modified.
 */
export const scheduleWorldEvent = (
  definitions: readonly WorldEventDefinition[],
  context: WorldEventSchedulerContext,
): ScheduledWorldEvent | null => {
  if (!Number.isInteger(context.day) || !Number.isInteger(context.year)) return null
  if (!elapsedAtLeast(
    context.day,
    context.lastEventDay,
    WORLD_EVENT_SCHEDULER_CONSTANTS.globalCooldownDays,
  )) return null

  const eligible = eligibleWorldEvents(definitions, context)
  if (eligible.length === 0) return null

  const triggerRoll = worldEventDateRandom(context.seed, context.day, 'trigger')
  if (triggerRoll >= WORLD_EVENT_DAILY_TRIGGER_PROBABILITY) return null

  const definition = selectWeightedDefinition(
    eligible,
    worldEventDateRandom(context.seed, context.day, 'selection'),
  )
  if (!definition) return null

  return {
    definition,
    combo: matchWorldEventCombo(definition, context),
    requestedPresentation: definition.presentation,
  }
}

export const canPresentWorldEventPopup = (context: PopupPresentationContext) =>
  elapsedAtLeast(
    context.day,
    context.lastPopupDay,
    WORLD_EVENT_SCHEDULER_CONSTANTS.popupSpacingDays,
  )
  && (context.lastPopupAtMs === undefined
    || context.lastPopupAtMs === null
    || context.nowMs - context.lastPopupAtMs >= WORLD_EVENT_SCHEDULER_CONSTANTS.popupRealtimeCooldownMs)

export const resolveWorldEventPresentation = (
  requested: WorldEventPresentation,
  context: PopupPresentationContext,
): WorldEventPresentation => requested === 'popup' && !canPresentWorldEventPopup(context)
  ? 'ticker'
  : requested
