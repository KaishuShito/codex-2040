import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import AgiPillDashboard, { type AgiPillDashboardProps } from './AgiPillDashboard'

const baseProps: AgiPillDashboardProps = {
  locale: 'ja',
  activeLayer: 'orbit',
  unlockedLayers: ['earth', 'orbit', 'solar'],
  onLayerChange: () => undefined,
  metrics: [
    { id: 'energy', label: 'エネルギー', value: '8.2 PW', detail: '+34% / 月', signal: 'accelerating' },
    { id: 'safety', label: '安全余力', value: '12%', detail: '能力成長に遅延', signal: 'critical' },
  ],
  causalCards: [{
    id: 'robot-loop',
    cause: '自己複製ロボット',
    effect: '資源需要',
    explanation: '生産倍加が採掘能力を上回った。',
    recovery: '軌道精錬へ配分し、倍加周期を一段落とす。',
    signal: 'constrained',
  }],
  milestones: [
    { id: 'earth', label: '地球産業', status: 'complete' },
    { id: 'orbit', label: '軌道工場', status: 'active' },
    { id: 'branches', label: '分岐文明', status: 'locked' },
  ],
  dysonProgress: 112,
  frontierTitle: '外惑星自己複製網',
  frontierDetail: '光速遅延と分岐統治を抱えた次の産業圏。',
  timeLabel: '2032.08',
}

const walk = (node: ReactNode, visit: (element: ReactElement) => void) => {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return
    visit(child)
    walk((child.props as { children?: ReactNode }).children, visit)
  })
}

describe('AgiPillDashboard', () => {
  it('renders Japanese telemetry, causal recovery, and an explicitly unfinished Dyson frontier', () => {
    const html = renderToStaticMarkup(<AgiPillDashboard {...baseProps} />)

    expect(html).toContain('AGIピル // 文明スケール管制')
    expect(html).toContain('自己複製ロボット')
    expect(html).toContain('軌道精錬へ配分')
    expect(html).toContain('これは終点ではない')
    expect(html).toContain('外惑星自己複製網')
    expect(html).toContain('aria-valuenow="100"')
    expect(html).toContain('data-layer="orbit"')
  })

  it('renders complete English control chrome from English props', () => {
    const html = renderToStaticMarkup(<AgiPillDashboard
      {...baseProps}
      locale="en"
      activeLayer="solar"
      metrics={[{ id: 'compute', label: 'Compute', value: '4.1e31 FLOP/s', detail: 'Doubling every 44 days' }]}
      causalCards={[]}
      frontierTitle="Interstellar seed fleet"
      frontierDetail="Light-speed delay turns coordination into a constitutional choice."
    />)

    expect(html).toContain('AGI PILL // CIVILIZATION SCALE CONTROL')
    expect(html).toContain('Coupled acceleration telemetry')
    expect(html).toContain('No major causal signals at present.')
    expect(html).toContain('This is not the end')
    expect(html).toContain('Interstellar seed fleet')
    expect(html).toContain('aria-pressed="true"')
  })

  it('routes layer controls to the integration callback and disables locked scales', () => {
    const onLayerChange = vi.fn()
    const tree = AgiPillDashboard({ ...baseProps, unlockedLayers: ['earth', 'orbit'], onLayerChange })
    const buttons: ReactElement<{ disabled?: boolean; onClick?: () => void }>[] = []
    walk(tree, (element) => {
      if (element.type === 'button') buttons.push(element as ReactElement<{ disabled?: boolean; onClick?: () => void }>)
    })

    expect(buttons).toHaveLength(3)
    buttons[0].props.onClick?.()
    buttons[1].props.onClick?.()
    expect(onLayerChange).toHaveBeenNthCalledWith(1, 'earth')
    expect(onLayerChange).toHaveBeenNthCalledWith(2, 'orbit')
    expect(buttons[2].props.disabled).toBe(true)
  })

  it('adds a compact Earth-only industry loop and rival pressure overlay from existing data', () => {
    const earthHtml = renderToStaticMarkup(<AgiPillDashboard {...baseProps} activeLayer="earth" />)
    const orbitHtml = renderToStaticMarkup(<AgiPillDashboard {...baseProps} activeLayer="orbit" />)

    expect(earthHtml).toContain('agi-pill-dashboard__earth-overlay')
    expect(earthHtml).toContain('地球産業ループ')
    expect(earthHtml).toContain('エネルギー')
    expect(earthHtml).toContain('安全余力')
    expect(earthHtml).toContain('競合圧力')
    expect(earthHtml).toContain('自己複製ロボット → 資源需要')
    expect(orbitHtml).not.toContain('agi-pill-dashboard__earth-overlay')
  })
})
