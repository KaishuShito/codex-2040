import { describe, expect, it } from 'vitest'
import {
  AGI_PILL_PHYSICAL_CAPS,
  agiPillMetrics,
  applyAgiPillEffects,
  createAgiPillState,
  enforceAgiPillInvariants,
  runAgiPillTicks,
  setAgiPillPolicy,
  tickAgiPill,
  transitionAgiPill,
  type AgiPillPolicy,
  type AgiPillState,
} from './engine'

describe('AGI Pill deterministic engine', () => {
  it('replays the same seed and policy sequence exactly', () => {
    const play = () => {
      let state = createAgiPillState({ seed: 42 })
      state = runAgiPillTicks(state, 240, 'balanced')
      state = transitionAgiPill(state, { type: 'set-policy', policy: 'industrialize' })
      state = transitionAgiPill(state, { type: 'tick', days: 360 })
      state = runAgiPillTicks(state, 120, 'safety-first')
      return state
    }

    expect(play()).toEqual(play())
    expect(play().seed).not.toBe(42)
  })

  it('keeps every metric finite and inside physical or governance bounds', () => {
    const broken = enforceAgiPillInvariants({
      ...createAgiPillState(),
      intelligence: Number.POSITIVE_INFINITY,
      compute: -9,
      energy: 1e30,
      robots: Number.NaN,
      resources: -1,
      safety: 400,
      governance: -200,
      friction: 800,
      risk: Number.NaN,
      expansion: { orbitalIndustry: 1e20, dysonProgress: 900, dysonBuilt: false, postDysonExpansion: 1e30 },
    })

    expect(broken.intelligence).toBe(0)
    expect(broken.compute).toBe(0)
    expect(broken.energy).toBe(AGI_PILL_PHYSICAL_CAPS.energy)
    expect(broken.robots).toBe(0)
    expect(broken.resources).toBe(0)
    expect([broken.safety, broken.governance, broken.friction, broken.risk]).toEqual([100, 0, 100, 0])
    expect(broken.expansion.orbitalIndustry).toBe(AGI_PILL_PHYSICAL_CAPS.orbitalIndustry)
    expect(broken.expansion.dysonProgress).toBe(100)
    expect(broken.expansion.dysonBuilt).toBe(true)
    expect(broken.expansion.postDysonExpansion).toBe(AGI_PILL_PHYSICAL_CAPS.postDysonExpansion)
  })

  it('maps additive rival pressure without treating it as a raw capability multiplier', () => {
    const initial = createAgiPillState({ seed: 31 })
    const increased = applyAgiPillEffects(initial, [
      { metric: 'rivalPressure', operation: 'add', value: 5 },
    ])
    const reduced = applyAgiPillEffects(initial, [
      { metric: 'rivalPressure', operation: 'add', value: -5 },
    ])

    expect(agiPillMetrics(increased).rivalPressure).toBeGreaterThan(agiPillMetrics(initial).rivalPressure)
    expect(agiPillMetrics(reduced).rivalPressure).toBeLessThan(agiPillMetrics(initial).rivalPressure)
    expect(increased.rivalCivilizations.every((rival, index) => (
      rival.capability / initial.rivalCivilizations[index]!.capability < 2
    ))).toBe(true)
    expect(reduced.rivalCivilizations.every((rival) => rival.capability > 0)).toBe(true)
  })

  it('lets passive play lose to a rival rather than auto-winning', () => {
    const passive = runAgiPillTicks(createAgiPillState({ seed: 11 }), 10 * 365)

    expect(passive.terminal).toBe(true)
    expect(['rival-takeover', 'misalignment']).toContain(passive.outcome)
    expect(['rival-capture', 'misalignment']).toContain(passive.warning?.kind)
    expect(passive.day - passive.warning!.startedDay).toBeGreaterThanOrEqual(passive.warning!.countdownDays)
    expect(passive.lastCauses.some((cause) => cause.id === 'rival-pressure' || cause.id === 'social-friction')).toBe(true)
  })

  it('preserves counterplay: safety and resource policies can recover a strained nonterminal state', () => {
    const strained: AgiPillState = enforceAgiPillInvariants({
      ...createAgiPillState({ seed: 9 }),
      day: 900,
      intelligence: 14,
      compute: 18,
      energy: 10,
      robots: 8,
      resources: 1.5,
      safety: 38,
      governance: 42,
      friction: 68,
      risk: 74,
      incidentDebt: 42,
      unsafeDays: 120,
      resourceCrisisDays: 100,
    })

    // Recover safety first, then respond to the resource warning while its
    // announced countermeasure window is still open.
    const safetyRecovered = runAgiPillTicks(strained, 120, 'safety-first')
    const recovered = runAgiPillTicks(safetyRecovered, 240, 'resource-recovery')

    expect(recovered.terminal).toBe(false)
    expect(recovered.safety).toBeGreaterThan(strained.safety)
    expect(recovered.risk).toBeLessThan(strained.risk)
    expect(recovered.incidentDebt).toBeLessThan(strained.incidentDebt)
    expect(recovered.resources).toBeGreaterThan(strained.resources)
    expect(recovered.unsafeDays).toBeLessThan(strained.unsafeDays)
    expect(recovered.resourceCrisisDays).toBeLessThan(strained.resourceCrisisDays)
    expect(agiPillMetrics(recovered).canRecover).toBe(true)
  })

  it('black-starts compute and energy after early event choices exhaust them', () => {
    const exhausted = enforceAgiPillInvariants({
      ...createAgiPillState({ seed: 19 }),
      day: 900,
      compute: 0,
      energy: 0,
      resources: 20,
      policy: 'resource-recovery',
    })

    const recovered = runAgiPillTicks(exhausted, 90)

    expect(recovered.terminal).toBe(false)
    expect(recovered.compute).toBeGreaterThanOrEqual(2)
    expect(recovered.energy).toBeGreaterThanOrEqual(2)
    expect(recovered.resources).toBeGreaterThan(exhausted.resources)
  })

  it('makes unsafe acceleration measurably riskier than balanced growth', () => {
    const initial = createAgiPillState({ seed: 71 })
    const balanced = runAgiPillTicks(initial, 420, 'balanced')
    const accelerated = runAgiPillTicks(initial, 420, 'accelerate')

    expect(accelerated.intelligence).toBeGreaterThan(balanced.intelligence)
    expect(accelerated.compute).toBeGreaterThan(balanced.compute)
    expect(accelerated.risk).toBeGreaterThan(balanced.risk + 12)
    expect(accelerated.friction).toBeGreaterThan(balanced.friction)
  })

  it('models coupled acceleration whose later growth is faster than its early growth', () => {
    const initial = setAgiPillPolicy(createAgiPillState({ seed: 8 }), 'balanced')
    const early = runAgiPillTicks(initial, 365)
    const late = runAgiPillTicks(early, 365)
    const earlyGrowth = agiPillMetrics(early).scale / agiPillMetrics(initial).scale
    const lateGrowth = agiPillMetrics(late).scale / agiPillMetrics(early).scale

    expect(lateGrowth).toBeGreaterThan(earlyGrowth)
  })

  it('uses state gates and a harmonic bottleneck instead of advancing eras by date alone', () => {
    const weakLateState = enforceAgiPillInvariants({ ...createAgiPillState(), day: 6 * 365 })
    expect(weakLateState.phase).toBe('year-1-3')

    const researchClosed = applyAgiPillEffects(weakLateState, [
      { metric: 'intelligence', operation: 'set', value: 5 },
      { metric: 'compute', operation: 'set', value: 20 },
      { metric: 'energy', operation: 'set', value: 20 },
      { metric: 'safety', operation: 'set', value: 100 },
      { metric: 'governance', operation: 'set', value: 100 },
      { metric: 'friction', operation: 'set', value: 0 },
    ])
    expect(researchClosed.phase).toBe('year-3-5')
    expect(agiPillMetrics(researchClosed).primaryBottleneck).toBe('robots')

    const replicationClosed = applyAgiPillEffects(researchClosed, [
      { metric: 'robots', operation: 'set', value: 30 },
      { metric: 'energy', operation: 'set', value: 20 },
    ])
    expect(replicationClosed.phase).toBe('year-5-10')
    expect(agiPillMetrics(replicationClosed).primaryBottleneck).not.toBe('robots')
  })

  it('announces a recoverable warning before a terminal control loss', () => {
    const brink = enforceAgiPillInvariants({
      ...createAgiPillState({ seed: 91 }),
      risk: 82,
      safety: 10,
      governance: 12,
      unsafeDays: 359,
    })
    const warned = tickAgiPill(brink)

    expect(warned.warning?.kind).toBe('misalignment')
    expect(warned.warning?.recoveryPolicies).toContain('safety-first')
    expect(warned.terminal).toBe(false)

    const recovered = runAgiPillTicks(warned, 180, 'safety-first')
    expect(recovered.warning).toBeNull()
    expect(recovered.terminal).toBe(false)
  })

  it('reaches an industrial accident only after its visible cascade countdown expires', () => {
    const warned = enforceAgiPillInvariants({
      ...createAgiPillState({ seed: 15 }),
      day: 100,
      risk: 12,
      incidentDebt: 100,
      unsafeDays: 0,
      warning: {
        kind: 'industrial-cascade',
        startedDay: 70,
        countdownDays: 30,
        recoveryPolicies: ['safety-first', 'resource-recovery', 'industrialize'],
      },
    })
    const accident = tickAgiPill(warned)

    expect(accident.outcome).toBe('industrial-accident')
    expect(accident.terminal).toBe(true)
    expect(accident.warning?.kind).toBe('industrial-cascade')
    expect(accident.lastCauses.some((cause) => cause.id === 'incident')).toBe(true)
  })

  it('honors every announced point of no return at countdown expiry', () => {
    const resourceLock = enforceAgiPillInvariants({
      ...createAgiPillState({ seed: 44 }),
      day: 360,
      resources: 0,
      resourceCrisisDays: 360,
      warning: {
        kind: 'resource-lock',
        startedDay: 180,
        countdownDays: 180,
        recoveryPolicies: ['resource-recovery', 'cooperate', 'expand-orbit'],
      },
    })
    const cascade = enforceAgiPillInvariants({
      ...createAgiPillState({ seed: 45 }),
      day: 130,
      incidentDebt: 84,
      warning: {
        kind: 'industrial-cascade',
        startedDay: 100,
        countdownDays: 30,
        recoveryPolicies: ['safety-first', 'resource-recovery', 'industrialize'],
      },
    })

    expect(tickAgiPill(resourceLock)).toMatchObject({ outcome: 'stagnation', terminal: true })
    expect(tickAgiPill(cascade)).toMatchObject({ outcome: 'industrial-accident', terminal: true })
  })

  it('keeps balanced and safety-led human strategies naturally reachable across seeds', () => {
    const play = (seed: number, safetyLed: boolean) => {
      let state = createAgiPillState({ seed })
      for (let day = 0; day < 5_500 && !state.terminal && state.outcome !== 'pluralistic-expansion'; day += 1) {
        let policy: AgiPillPolicy = state.policy
        if (state.warning) policy = state.warning.recoveryPolicies[0]!
        else if (state.resources < 5) policy = 'resource-recovery'
        else if (state.risk > 35 || state.safety < (safetyLed ? 82 : 68)) policy = 'safety-first'
        else if (state.governance < (safetyLed ? 58 : 68)) policy = 'governance-first'
        else if (state.robots < 45 || state.energy < 35) policy = 'industrialize'
        else if (state.expansion.orbitalIndustry < 6) policy = 'expand-orbit'
        else if (!state.expansion.dysonBuilt) policy = 'build-dyson'
        else policy = 'post-dyson'
        if (policy !== state.policy) state = setAgiPillPolicy(state, policy)
        state = tickAgiPill(state)
      }
      return state
    }

    for (const seed of [42, 99]) {
      const balanced = play(seed, false)
      const safetyLed = play(seed, true)
      expect(balanced.outcome).toBe('pluralistic-expansion')
      expect(safetyLed.outcome).toBe('pluralistic-expansion')
      expect(balanced.expansion.dysonBuilt).toBe(true)
      expect(safetyLed.expansion.dysonBuilt).toBe(true)
      expect(balanced.terminal).toBe(false)
      expect(safetyLed.terminal).toBe(false)
    }
  })

  it('treats a completed Dyson swarm as a post-Dyson beginning, never an ending', () => {
    const nearDyson = applyAgiPillEffects(createAgiPillState({ seed: 5 }), [
      { metric: 'intelligence', operation: 'set', value: 500 },
      { metric: 'compute', operation: 'set', value: 2_000 },
      { metric: 'energy', operation: 'set', value: 2_000 },
      { metric: 'robots', operation: 'set', value: 20_000 },
      { metric: 'resources', operation: 'set', value: 100_000 },
      { metric: 'orbitalIndustry', operation: 'set', value: 500 },
      { metric: 'dysonProgress', operation: 'set', value: 99.99 },
      { metric: 'safety', operation: 'set', value: 85 },
      { metric: 'governance', operation: 'set', value: 82 },
      { metric: 'friction', operation: 'set', value: 20 },
      { metric: 'risk', operation: 'set', value: 8 },
    ], 'dyson-test-fixture')
    const built = tickAgiPill(setAgiPillPolicy(nearDyson, 'build-dyson'))

    expect(built.expansion.dysonBuilt).toBe(true)
    expect(built.expansion.dysonProgress).toBe(100)
    expect(built.milestones).toContain('dyson-swarm')
    expect(built.phase).toBe('post-dyson')
    expect(built.terminal).toBe(false)
    expect(built.outcome).toBe('active')

    const beyond = runAgiPillTicks(built, 30, 'post-dyson')
    expect(beyond.expansion.postDysonExpansion).toBeGreaterThan(built.expansion.postDysonExpansion)
    expect(beyond.terminal).toBe(false)
  })
})
