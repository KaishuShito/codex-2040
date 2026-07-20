import { COMPETITION_EVENTS } from './data/competition'
import { CULTURE_EVENTS } from './data/culture'
import { DISASTER_EVENTS } from './data/disaster'
import { POLICY_EVENTS } from './data/policy'
import { TECHNOLOGY_EVENTS } from './data/technology'
import type { WorldEventDefinition } from './types'

/** The complete authored catalog. Ordering is canonical and selection is still date-key deterministic. */
export const WORLD_EVENTS: readonly WorldEventDefinition[] = Object.freeze([
  ...DISASTER_EVENTS,
  ...CULTURE_EVENTS,
  ...POLICY_EVENTS,
  ...COMPETITION_EVENTS,
  ...TECHNOLOGY_EVENTS,
])

