import { describe, expect, it } from 'vitest'
import { createAgiPillState, enforceAgiPillInvariants } from '../../src/agiPill/engine'
import {
  affordableAuthoredUpgrades,
  applyAuthoredEventOption,
  chooseAffordableUpgrade,
  chooseAuthoredEventOption,
  dueAuthoredEvent,
  fundAuthoredUpgrade,
} from './authored'

describe('AGI Pill authored UI systems adapter', () => {
  it('requires both the UI pacing day and authored cause eligibility', () => {
    const early = createAgiPillState({ seed: 1 })
    expect(dueAuthoredEvent(early)).toBeNull()
    const eligible = enforceAgiPillInvariants({
      ...early,
      day: 120,
      intelligence: 20,
      compute: 16,
    })
    expect(dueAuthoredEvent(eligible)?.id).toBe('pill-researcher-copy-flywheel')
  })

  it('chooses and applies a deterministic event option with shipped flags', () => {
    const state = enforceAgiPillInvariants({
      ...createAgiPillState({ seed: 2 }),
      day: 120,
      intelligence: 20,
      compute: 16,
    })
    const event = dueAuthoredEvent(state)!
    const first = chooseAuthoredEventOption('safety-first', event)
    expect(chooseAuthoredEventOption('safety-first', event)).toEqual(first)
    const next = applyAuthoredEventOption(state, event, first.option)
    expect(next.flags).toContain(`pill:event:${event.id}`)
    expect(next.flags).toContain(`effect:${event.id}`)
    expect(first.option.setsFlags.every((flag) => next.flags.includes(flag))).toBe(true)
  })

  it('funds only affordable visible programs and charges scaled UI costs', () => {
    const state = enforceAgiPillInvariants({
      ...createAgiPillState({ seed: 3 }),
      compute: 10,
      energy: 10,
      resources: 100,
      governance: 80,
    })
    expect(affordableAuthoredUpgrades(state).length).toBeGreaterThan(0)
    const upgrade = chooseAffordableUpgrade('balanced', state)!
    const next = fundAuthoredUpgrade(state, upgrade)
    expect(next.flags).toContain(`pill:upgrade:${upgrade.id}`)
    expect(next.flags).toContain(`effect:upgrade:${upgrade.id}`)
    expect(next).not.toEqual(state)
  })
})
