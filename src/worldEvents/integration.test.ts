import { describe, expect, it } from 'vitest'
import {
  acknowledgeWorldEvent,
  advanceRealtime,
  applyWorldEvent,
  createInitialState,
  END_DAY,
  tickDay,
} from '../engine'
import { WORLD_EVENTS } from './catalog'

describe('authored world events in the deterministic engine', () => {
  it('applies a bounded event, records provenance, and pauses only for popup presentation', () => {
    const definition = WORLD_EVENTS.find((event) => event.presentation === 'popup')!
    const before = { ...createInitialState(), day: 200 }
    const after = applyWorldEvent(before, { definition, combo: null, requestedPresentation: 'popup' })

    expect(after.firedWorldEventIds).toContain(definition.id)
    expect(after.news[0]).toMatchObject({ headline: definition.headline, source: definition.source })
    expect(after.pendingWorldEvent).toMatchObject({ eventId: definition.id, category: definition.category })
    const resumed = acknowledgeWorldEvent(after)
    expect(resumed.pendingWorldEvent).toBeNull()
    expect(resumed.worldEventPopupCooldownSeconds).toBe(45)
    expect(advanceRealtime(resumed, 45).worldEventPopupCooldownSeconds).toBe(0)
  })

  it('uses a separate deterministic stream and produces the same event history for the same seed', () => {
    const play = () => {
      let state = createInitialState({ seed: 77 })
      for (let day = 0; day < 1_200; day += 1) {
        state = tickDay(state)
        if (state.pendingWorldEvent) state = advanceRealtime(acknowledgeWorldEvent(state), 45)
      }
      return state
    }

    const first = play()
    const second = play()
    expect(first.firedWorldEventIds.length).toBeGreaterThan(3)
    expect(first.firedWorldEventIds).toEqual(second.firedWorldEventIds)
    expect(first.seed).toBe(second.seed)
  })

  it('never grants Momentum for an ordinary event, only for an earned combo', () => {
    const definition = WORLD_EVENTS.find((event) => event.combos?.some((combo) => combo.momentumDays))!
    const combo = definition.combos!.find((candidate) => candidate.momentumDays)!
    const base = { ...createInitialState(), day: 300, momentumDays: 0 }
    const ordinary = applyWorldEvent(base, { definition, combo: null, requestedPresentation: 'ticker' })
    const earned = applyWorldEvent(base, { definition, combo, requestedPresentation: 'ticker' })

    expect(ordinary.momentumDays).toBe(0)
    expect(earned.momentumDays).toBe(combo.momentumDays)
    expect(earned.interventions).toBe(base.interventions)
  })

  it('keeps a full run busy without turning every event into an interruption', () => {
    let state = createInitialState({ seed: 2040 })
    let popups = 0
    while (state.day < END_DAY && !state.terminal) {
      state = tickDay(state)
      if (state.pendingWorldEvent) {
        popups += 1
        state = advanceRealtime(acknowledgeWorldEvent(state), 45)
      }
    }

    expect(state.firedWorldEventIds.length).toBeGreaterThanOrEqual(45)
    expect(state.firedWorldEventIds.length).toBeLessThanOrEqual(80)
    expect(popups).toBeGreaterThanOrEqual(5)
    expect(popups).toBeLessThanOrEqual(15)
  })
})
