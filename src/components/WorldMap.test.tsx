import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import WorldMap, { WORLD_MAP_REGION_IDS, type WorldMapRegionIntensity } from './WorldMap'

const regions = Object.fromEntries(WORLD_MAP_REGION_IDS.map((regionId) => [regionId, {
  adoption: .1,
  codexShare: .25,
  active: true,
  label: regionId,
} satisfies WorldMapRegionIntensity]))

describe('WorldMap collectible bubbles', () => {
  it('renders an accessible bilingual PF collection control', () => {
    const html = renderToStaticMarkup(
      <WorldMap
        regions={regions}
        onRegionClick={() => undefined}
        rewardBubbles={[{
          id: 'pf-bubble-1',
          regionId: 'eastAsia',
          reward: 7,
          placement: .42,
          source: 'token-reset',
        }]}
        onRewardBubbleClick={() => undefined}
      />,
    )

    expect(html).toContain('world-map__reward-bubble--token-reset')
    expect(html).toContain('計算資源を回収、プラス7 PF。Collect plus 7 PF')
    expect(html).toContain('role="button"')
    expect(html).toContain('+7')
  })
})
