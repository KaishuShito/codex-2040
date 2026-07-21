import { type CSSProperties, type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  geoCentroid,
  geoGraticule10,
  geoNaturalEarth1,
  geoPath,
  type GeoPermissibleObjects,
} from 'd3-geo'
import type { Feature, FeatureCollection, Geometry, LineString, Position } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import worldAtlas from 'world-atlas/countries-110m.json'
import './WorldMap.css'

/**
 * Country geometry: world-atlas countries-110m v2, derived from Natural Earth.
 * Natural Earth data is public domain; world-atlas is distributed under ISC.
 * The package is bundled by Vite, so rendering never depends on a runtime fetch.
 */

export const WORLD_MAP_REGION_IDS = [
  'na',
  'latam',
  'eu',
  'africa',
  'mena',
  'india',
  'eastAsia',
  'oceania',
] as const

export type WorldMapRegionId = (typeof WORLD_MAP_REGION_IDS)[number]

export type WorldMapRegionIntensity = {
  /** Normalized total AI access in this region, from 0 to 1. */
  adoption: number
  /** Normalized Codex share of that access, from 0 to 1. */
  codexShare: number
  /** Whether the region has an active access network. */
  active?: boolean
  /** Optional user-facing name; falls back to the built-in region name. */
  label?: string
}

export type WorldMapCompetitiveView = {
  /** Competitor name shown in the map legend and accessible labels. */
  label: string
  /** RGB channels used for the competitor territory heatmap. */
  color: readonly [red: number, green: number, blue: number]
  /** Estimated regional share, normalized from 0 to 1. */
  shares: Readonly<Partial<Record<WorldMapRegionId, number>>>
}

type MarkerBase = {
  id: string
  label: string
  kind?: 'source' | 'community' | 'policy' | 'live'
  sourceLabel?: 'AI 2027' | 'AI 2040' | 'Your Timeline' | 'Live GM' | string
  active?: boolean
}

export type WorldMapMarker = MarkerBase & (
  | { coordinates: readonly [longitude: number, latitude: number]; regionId?: WorldMapRegionId }
  | { regionId: WorldMapRegionId; coordinates?: never }
)

export type WorldMapRewardBubble = {
  id: string
  regionId: WorldMapRegionId
  reward: number
  placement: number
  remainingSeconds: number
  source: 'token-reset' | 'community'
}

type RewardBurst = {
  id: string
  reward: number
  source: WorldMapRewardBubble['source']
  x: number
  y: number
}

export type WorldMapProps = {
  locale?: 'ja' | 'en'
  regions: Readonly<Partial<Record<WorldMapRegionId, WorldMapRegionIntensity>>>
  selectedRegion?: WorldMapRegionId | null
  onRegionClick: (regionId: WorldMapRegionId) => void
  onClearSelection?: () => void
  eventMarkers?: readonly WorldMapMarker[]
  onMarkerClick?: (marker: WorldMapMarker) => void
  competitiveView?: WorldMapCompetitiveView | null
  /** Change this value to replay the synchronized global reset pulse. */
  resetPulse?: number
  rewardBubbles?: readonly WorldMapRewardBubble[]
  onRewardBubbleClick?: (bubbleId: string) => void
  className?: string
  ariaLabel?: string
}

const WIDTH = 960
const HEIGHT = 540

const REGION_META: Record<WorldMapRegionId, { label: string; coordinates: readonly [number, number] }> = {
  na: { label: '北米', coordinates: [-101, 42] },
  latam: { label: '中南米', coordinates: [-61, -15] },
  eu: { label: '欧州', coordinates: [14, 52] },
  africa: { label: 'アフリカ', coordinates: [22, 0] },
  mena: { label: '中東・北アフリカ', coordinates: [45, 27] },
  india: { label: 'インド', coordinates: [79, 22] },
  eastAsia: { label: '東アジア', coordinates: [116, 34] },
  oceania: { label: 'オセアニア', coordinates: [137, -25] },
}

type CityHub = { name: string; coordinates: readonly [number, number]; weight: number }

const CITY_HUBS: Record<WorldMapRegionId, readonly CityHub[]> = {
  na: [
    { name: 'San Francisco', coordinates: [-122.42, 37.77], weight: 1.25 },
    { name: 'New York', coordinates: [-74.01, 40.71], weight: 1.1 },
    { name: 'Toronto', coordinates: [-79.38, 43.65], weight: .8 },
    { name: 'Austin', coordinates: [-97.74, 30.27], weight: .7 },
  ],
  latam: [
    { name: 'São Paulo', coordinates: [-46.63, -23.55], weight: 1.2 },
    { name: 'Mexico City', coordinates: [-99.13, 19.43], weight: 1 },
    { name: 'Buenos Aires', coordinates: [-58.38, -34.6], weight: .75 },
    { name: 'Bogotá', coordinates: [-74.07, 4.71], weight: .7 },
  ],
  eu: [
    { name: 'London', coordinates: [-.13, 51.51], weight: 1.1 },
    { name: 'Paris', coordinates: [2.35, 48.86], weight: .9 },
    { name: 'Berlin', coordinates: [13.4, 52.52], weight: .9 },
    { name: 'Amsterdam', coordinates: [4.9, 52.37], weight: .7 },
    { name: 'Warsaw', coordinates: [21.01, 52.23], weight: .6 },
  ],
  africa: [
    { name: 'Lagos', coordinates: [3.38, 6.52], weight: 1.15 },
    { name: 'Nairobi', coordinates: [36.82, -1.29], weight: 1 },
    { name: 'Johannesburg', coordinates: [28.05, -26.2], weight: .85 },
    { name: 'Accra', coordinates: [-.19, 5.56], weight: .65 },
  ],
  mena: [
    { name: 'Dubai', coordinates: [55.27, 25.2], weight: 1.1 },
    { name: 'Riyadh', coordinates: [46.68, 24.71], weight: .9 },
    { name: 'Istanbul', coordinates: [28.98, 41.01], weight: .85 },
    { name: 'Cairo', coordinates: [31.24, 30.04], weight: .8 },
    { name: 'Tel Aviv', coordinates: [34.78, 32.09], weight: .65 },
  ],
  india: [
    { name: 'Bengaluru', coordinates: [77.59, 12.97], weight: 1.25 },
    { name: 'Mumbai', coordinates: [72.88, 19.08], weight: 1 },
    { name: 'Delhi', coordinates: [77.1, 28.7], weight: 1 },
    { name: 'Hyderabad', coordinates: [78.49, 17.39], weight: .85 },
    { name: 'Chennai', coordinates: [80.27, 13.08], weight: .65 },
  ],
  eastAsia: [
    { name: 'Tokyo', coordinates: [139.69, 35.68], weight: 1.2 },
    { name: 'Seoul', coordinates: [126.98, 37.57], weight: 1 },
    { name: 'Shanghai', coordinates: [121.47, 31.23], weight: 1.05 },
    { name: 'Shenzhen', coordinates: [114.06, 22.54], weight: .95 },
    { name: 'Singapore', coordinates: [103.82, 1.35], weight: .85 },
    { name: 'Taipei', coordinates: [121.57, 25.04], weight: .65 },
  ],
  oceania: [
    { name: 'Sydney', coordinates: [151.21, -33.87], weight: 1.15 },
    { name: 'Melbourne', coordinates: [144.96, -37.81], weight: 1 },
    { name: 'Auckland', coordinates: [174.76, -36.85], weight: .7 },
    { name: 'Brisbane', coordinates: [153.03, -27.47], weight: .65 },
  ],
}

const NORTH_AMERICA = new Set(['124', '304', '840'])
const MENA = new Set([
  '004', '012', '048', '275', '364', '368', '376', '400', '414', '422', '434', '504', '512',
  '586', '634', '682', '732', '760', '784', '788', '792', '818', '887',
])
const OCEANIA = new Set([
  '016', '036', '090', '184', '242', '296', '520', '540', '548', '554', '583', '584', '585',
  '598', '772', '776', '798', '882',
])

type CountryFeature = Feature<Geometry, Record<string, never>>

const topology = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>
const atlas = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry, Record<string, never>>
const countries = atlas.features.filter((country) => String(country.id).padStart(3, '0') !== '010') as CountryFeature[]
const countryCollection: FeatureCollection<Geometry, Record<string, never>> = { type: 'FeatureCollection', features: countries }

const projection = geoNaturalEarth1().fitExtent([[34, 42], [926, 494]], countryCollection)
const pathGenerator = geoPath(projection)
const spherePath = pathGenerator({ type: 'Sphere' }) ?? ''
const graticulePath = pathGenerator(geoGraticule10()) ?? ''
const countriesPath = pathGenerator(countryCollection) ?? ''

const countryRegion = (country: CountryFeature): WorldMapRegionId => {
  const countryId = String(country.id).padStart(3, '0')
  if (NORTH_AMERICA.has(countryId)) return 'na'
  if (countryId === '356') return 'india'
  if (MENA.has(countryId)) return 'mena'
  if (OCEANIA.has(countryId)) return 'oceania'

  const [longitude, latitude] = geoCentroid(country)
  if (longitude < -25) return 'latam'
  if (countryId === '643' || (latitude > 35 && longitude < 68)) return 'eu'
  if (latitude < 37 && longitude > -26 && longitude < 60) return 'africa'
  return 'eastAsia'
}

const regionFeatures = Object.fromEntries(
  WORLD_MAP_REGION_IDS.map((regionId) => [
    regionId,
    {
      type: 'FeatureCollection',
      features: countries.filter((country) => countryRegion(country) === regionId),
    } satisfies FeatureCollection<Geometry, Record<string, never>>,
  ]),
) as Record<WorldMapRegionId, FeatureCollection<Geometry, Record<string, never>>>

const regionPaths = Object.fromEntries(
  WORLD_MAP_REGION_IDS.map((regionId) => [regionId, pathGenerator(regionFeatures[regionId]) ?? '']),
) as Record<WorldMapRegionId, string>

const regionPoints = Object.fromEntries(
  WORLD_MAP_REGION_IDS.map((regionId) => [regionId, projection(REGION_META[regionId].coordinates as [number, number]) ?? [0, 0]]),
) as Record<WorldMapRegionId, [number, number]>

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const percent = (value: number) => `${Math.round(clamp01(value) * 100)}%`

const keyboardActivate = (event: KeyboardEvent<SVGElement>, action: () => void) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  action()
}

const asLinePath = (coordinates: Position[]) => pathGenerator({ type: 'LineString', coordinates } as LineString) ?? ''

type MarketDot = { id: string; city: string; x: number; y: number; radius: number; delay: number }

const buildMarketDots = (
  competitiveView: WorldMapCompetitiveView | null,
  regions: WorldMapProps['regions'],
): MarketDot[] => {
  return WORLD_MAP_REGION_IDS.flatMap((regionId) => {
    const share = clamp01(competitiveView?.shares[regionId] ?? regions[regionId]?.codexShare ?? 0)
    const adoption = clamp01(regions[regionId]?.adoption ?? 0)
    if (share <= .005 || adoption <= 0) return []
    const dotCount = Math.max(1, Math.round(share * 36 + Math.sqrt(adoption) * 14))
    const hubs = CITY_HUBS[regionId]
    const weighted = hubs.flatMap((hub, index) => Array.from({ length: Math.max(1, Math.round(hub.weight * 4)) }, () => index))
    const localCounts = new Array(hubs.length).fill(0) as number[]
    return Array.from({ length: dotCount }, (_, index) => {
      const cityIndex = weighted[(index * 7 + regionId.length * 3) % weighted.length]
      const hub = hubs[cityIndex]
      const localIndex = localCounts[cityIndex]++
      const point = projection(hub.coordinates as [number, number]) ?? [0, 0]
      const angle = localIndex * 2.399963 + cityIndex * .73
      const spread = 2.2 + share * 7.5
      const distance = Math.sqrt(localIndex + 1) * spread
      return {
        id: `${regionId}-${cityIndex}-${localIndex}`,
        city: hub.name,
        x: point[0] + Math.cos(angle) * distance,
        y: point[1] + Math.sin(angle) * distance * .62,
        radius: 1.25 + Math.min(.85, share * 1.8),
        delay: -((index * .17 + cityIndex * .31) % 3.2),
      }
    })
  })
}

export default function WorldMap({
  locale = 'ja',
  regions,
  selectedRegion = null,
  onRegionClick,
  onClearSelection,
  eventMarkers = [],
  onMarkerClick,
  competitiveView = null,
  resetPulse = 0,
  rewardBubbles = [],
  onRewardBubbleClick,
  className = '',
  ariaLabel = locale === 'ja' ? '世界のAI利用と教育ネットワークの操作マップ' : 'Interactive map of global AI use and education networks',
}: WorldMapProps) {
  const rawId = useId().replaceAll(':', '')
  const glowId = `world-map-glow-${rawId}`
  const softGlowId = `world-map-soft-glow-${rawId}`
  const gridId = `world-map-grid-${rawId}`
  const selectedId = `world-map-selected-${rawId}`
  const [rewardBursts, setRewardBursts] = useState<RewardBurst[]>([])
  const rewardBurstTimers = useRef<number[]>([])

  useEffect(() => () => {
    rewardBurstTimers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const collectWithBurst = (bubble: WorldMapRewardBubble, x: number, y: number) => {
    if (!onRewardBubbleClick) return
    const burstId = `${bubble.id}-burst`
    setRewardBursts((current) => [...current.filter((burst) => burst.id !== burstId), {
      id: burstId,
      reward: bubble.reward,
      source: bubble.source,
      x,
      y,
    }])
    const timer = window.setTimeout(() => {
      setRewardBursts((current) => current.filter((burst) => burst.id !== burstId))
      rewardBurstTimers.current = rewardBurstTimers.current.filter((pending) => pending !== timer)
    }, 900)
    rewardBurstTimers.current.push(timer)
    onRewardBubbleClick(bubble.id)
  }

  const activeRegions = useMemo(() => WORLD_MAP_REGION_IDS
    .filter((regionId) => regions[regionId]?.active !== false && clamp01(regions[regionId]?.adoption ?? 0) > 0)
    .sort((left, right) => {
      const leftValue = clamp01(regions[left]?.adoption ?? 0) + clamp01(regions[left]?.codexShare ?? 0)
      const rightValue = clamp01(regions[right]?.adoption ?? 0) + clamp01(regions[right]?.codexShare ?? 0)
      return rightValue - leftValue
    }), [regions])
  const marketDots = useMemo(() => buildMarketDots(competitiveView, regions), [competitiveView, regions])
  const bubblePoints = useMemo(() => rewardBubbles.map((bubble) => {
    const hubs = CITY_HUBS[bubble.regionId]
    const scaled = clamp01(bubble.placement) * hubs.length
    const hubIndex = Math.min(hubs.length - 1, Math.floor(scaled))
    const hub = hubs[hubIndex]
    const point = projection(hub.coordinates as [number, number]) ?? [0, 0]
    const angle = bubble.placement * Math.PI * 4 + hubIndex * .83
    const distance = 8 + (scaled - Math.floor(scaled)) * 10
    return {
      bubble,
      city: hub.name,
      x: point[0] + Math.cos(angle) * distance,
      y: point[1] + Math.sin(angle) * distance * .7,
    }
  }), [rewardBubbles])

  return (
    <figure
      className={`world-map${competitiveView ? ' is-competitive' : ''} ${className}`.trim()}
      aria-label={competitiveView ? (locale === 'ja' ? `${ariaLabel}。${competitiveView.label}の推定市場分布。` : `${ariaLabel}. Estimated ${competitiveView.label} market distribution.`) : ariaLabel}
      style={competitiveView ? { '--rival-color': competitiveView.color.join(', ') } as CSSProperties : undefined}
    >
      <svg
        className="world-map__canvas"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label={ariaLabel}
        onClick={(event) => {
          const target = event.target as Element
          if (target.closest('.world-map__region, .world-map__marker')) return
          onClearSelection?.()
        }}
      >
        <defs>
          <filter id={glowId} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="5.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={softGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="13" />
          </filter>
          <radialGradient id={selectedId}>
            <stop offset="0" stopColor="#d8fff0" stopOpacity=".55" />
            <stop offset=".25" stopColor="#5dffc0" stopOpacity=".2" />
            <stop offset="1" stopColor="#5dffc0" stopOpacity="0" />
          </radialGradient>
          <pattern id={gridId} width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeOpacity=".065" strokeWidth=".8" />
          </pattern>
        </defs>

        <rect className="world-map__field" width={WIDTH} height={HEIGHT} />
        <rect className="world-map__grid" width={WIDTH} height={HEIGHT} fill={`url(#${gridId})`} />
        <path className="world-map__sphere" d={spherePath} />
        <path className="world-map__graticule" d={graticulePath} />

        <g className="world-map__regions">
          {WORLD_MAP_REGION_IDS.map((regionId) => {
            const value = regions[regionId]
            const adoption = clamp01(value?.adoption ?? 0)
            const codexShare = clamp01(value?.codexShare ?? 0)
            const active = value?.active ?? adoption > 0
            const intensity = active ? .16 + Math.sqrt(adoption) * .48 + codexShare * .3 : .06
            const label = value?.label ?? REGION_META[regionId].label
            const isSelected = selectedRegion === regionId
            const rivalShare = clamp01(competitiveView?.shares[regionId] ?? 0)
            const style = {
              '--region-intensity': intensity.toFixed(3),
              '--region-share': codexShare.toFixed(3),
              '--rival-share': rivalShare.toFixed(3),
            } as CSSProperties
            const marketLabel = competitiveView
              ? (locale === 'ja' ? `${competitiveView.label}の推定シェア ${percent(rivalShare)}` : `${competitiveView.label} estimated share ${percent(rivalShare)}`)
              : (locale === 'ja' ? `Codexシェア ${percent(codexShare)}` : `Codex share ${percent(codexShare)}`)

            return (
              <path
                key={regionId}
                className={`world-map__region${active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                d={regionPaths[regionId]}
                style={style}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={locale === 'ja' ? `${label}。AI利用率 ${percent(adoption)}。${marketLabel}。` : `${label}. AI adoption ${percent(adoption)}. ${marketLabel}.`}
                onClick={() => onRegionClick(regionId)}
                onKeyDown={(event) => keyboardActivate(event, () => onRegionClick(regionId))}
              >
                <title>{`${label}: ${locale === 'ja' ? 'AI利用率' : 'AI adoption'} ${percent(adoption)}, ${marketLabel}`}</title>
              </path>
            )
          })}
        </g>

        <path className="world-map__country-lines" d={countriesPath} aria-hidden="true" />

        <g className="world-map__hubs" aria-hidden="true">
          {activeRegions.map((regionId, index) => {
            const [x, y] = regionPoints[regionId]
            const adoption = clamp01(regions[regionId]?.adoption ?? 0)
            const radius = 4 + Math.sqrt(adoption) * 8
            return (
              <g key={regionId} transform={`translate(${x} ${y})`} style={{ '--hub-delay': `${index * -.31}s` } as CSSProperties}>
                <circle className="world-map__hub-aura" r={radius * 2.8} filter={`url(#${softGlowId})`} />
                <circle className="world-map__hub-wave" r={radius} />
                <circle className="world-map__hub-core" r={Math.max(2.4, radius * .36)} filter={`url(#${glowId})`} />
              </g>
            )
          })}
        </g>

        <g className="world-map__market-dots" aria-hidden="true">
          {marketDots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={dot.radius}
              style={{ '--market-dot-delay': `${dot.delay}s` } as CSSProperties}
            >
              <title>{dot.city}</title>
            </circle>
          ))}
        </g>

        <g className="world-map__reward-bubbles">
          {bubblePoints.map(({ bubble, city, x, y }) => {
            const collect = () => collectWithBurst(bubble, x, y)
            const fade = bubble.remainingSeconds >= 2.5
              ? 1
              : Math.max(.22, .22 + (bubble.remainingSeconds / 2.5) * .78)
            return (
              <g
                key={bubble.id}
                className={`world-map__reward-bubble world-map__reward-bubble--${bubble.source}${bubble.remainingSeconds <= 2.5 ? ' is-expiring' : ''}${bubble.remainingSeconds <= 1.1 ? ' is-critical' : ''}`}
                transform={`translate(${x} ${y})`}
                style={{ opacity: fade }}
                role="button"
                tabIndex={0}
                aria-label={locale === 'ja' ? `計算資源を回収、プラス${bubble.reward} PF。Collect plus ${bubble.reward} PF near ${city}.` : `Collect ${bubble.reward} PF near ${city}.`}
                onClick={(event) => { event.stopPropagation(); collect() }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.stopPropagation()
                  keyboardActivate(event, collect)
                }}
              >
                <title>{`${locale === 'ja' ? '計算資源' : 'Compute'} +${bubble.reward} PF — ${city}`}</title>
                <circle className="world-map__reward-bubble-wave" r="11" />
                <circle className="world-map__reward-bubble-core" r="7" />
                <text y="2.4">+{bubble.reward}</text>
              </g>
            )
          })}
        </g>

        <g className="world-map__reward-bursts" aria-hidden="true">
          {rewardBursts.map((burst) => (
            <g
              key={burst.id}
              className={`world-map__reward-burst world-map__reward-burst--${burst.source}`}
              transform={`translate(${burst.x} ${burst.y})`}
            >
              <circle className="world-map__reward-burst-flash" r="8" />
              <circle className="world-map__reward-burst-ring" r="9" />
              <circle className="world-map__reward-burst-shock" r="6" />
              <g className="world-map__reward-burst-sparks">
                {Array.from({ length: 8 }, (_, index) => (
                  <line key={index} x1="10" y1="0" x2={17 + index % 3} y2="0" transform={`rotate(${index * 45})`} />
                ))}
              </g>
              <g className="world-map__reward-burst-arcs">
                {[12, 132, 252].map((angle) => (
                  <path key={angle} d="M4-3 10-6 8-10 17-13" transform={`rotate(${angle})`} />
                ))}
              </g>
              <text className="world-map__reward-burst-label" y="-11">+{burst.reward} PF</text>
            </g>
          ))}
        </g>

        {selectedRegion && (
          <g className="world-map__selection" transform={`translate(${regionPoints[selectedRegion][0]} ${regionPoints[selectedRegion][1]})`} aria-hidden="true">
            <circle r="46" fill={`url(#${selectedId})`} />
            <path d="M-19-11V-19H-11 M11-19H19V-11 M19 11V19H11 M-11 19H-19V11" />
          </g>
        )}

        {resetPulse > 0 && (
          <g key={resetPulse} className="world-map__reset" aria-hidden="true">
            {activeRegions.map((regionId) => {
              const [x, y] = regionPoints[regionId]
              return <circle key={regionId} cx={x} cy={y} r="5" />
            })}
          </g>
        )}

        <g className="world-map__markers">
          {eventMarkers.map((marker, index) => {
            const coordinates = marker.coordinates ?? REGION_META[marker.regionId].coordinates
            const point = projection(coordinates as [number, number])
            if (!point) return null
            const activate = () => {
              onMarkerClick?.(marker)
              if (marker.regionId) onRegionClick(marker.regionId)
            }
            const actionable = Boolean(onMarkerClick || marker.regionId)
            const source = marker.sourceLabel ? ` ${locale === 'ja' ? '出典' : 'Source'}: ${marker.sourceLabel}.` : ''
            return (
              <g
                key={marker.id}
                className={`world-map__marker world-map__marker--${marker.kind ?? 'community'}${marker.active === false ? ' is-muted' : ''}`}
                transform={`translate(${point[0]} ${point[1]})`}
                style={{ '--marker-delay': `${index * -.42}s` } as CSSProperties}
                role={actionable ? 'button' : 'img'}
                tabIndex={0}
                aria-label={`${marker.label}。${source}`}
                onClick={actionable ? activate : undefined}
                onKeyDown={actionable ? (event) => keyboardActivate(event, activate) : undefined}
              >
                <title>{`${marker.label}${marker.sourceLabel ? ` — ${marker.sourceLabel}` : ''}`}</title>
                <circle className="world-map__marker-ring" r="9" />
                <path className="world-map__marker-diamond" d="M0-4 4 0 0 4-4 0Z" />
                <line x1="0" y1="11" x2="0" y2="19" />
                <g className="world-map__marker-label" transform="translate(0 24)">
                  <rect x="-48" y="0" width="96" height={marker.sourceLabel ? 28 : 17} rx="2" />
                  <text y="11">{marker.label.slice(0, 18).toUpperCase()}</text>
                  {marker.sourceLabel && <text className="world-map__marker-source" y="21">{marker.sourceLabel.toUpperCase()}</text>}
                </g>
              </g>
            )
          })}
        </g>

        <path className="world-map__equator" d={asLinePath([[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]])} aria-hidden="true" />
      </svg>

      <figcaption className="world-map__legend">
        <span><i className="world-map__legend-users" /> {competitiveView ? `${competitiveView.label} ${locale === 'ja' ? '利用者' : 'users'}` : (locale === 'ja' ? 'CODEX利用者' : 'CODEX users')}</span>
        <span><i className="world-map__legend-access" /> {locale === 'ja' ? 'AIアクセス' : 'AI access'}</span>
        <span><i className="world-map__legend-event" /> {locale === 'ja' ? 'シナリオイベント' : 'Scenario event'}</span>
      </figcaption>
      <span className="world-map__coordinate" aria-hidden="true">{competitiveView ? `${competitiveView.label} ${locale === 'ja' ? '市場分析' : 'market analysis'}` : (locale === 'ja' ? '世界アクセス網 · 110M' : 'GLOBAL ACCESS NETWORK · 110M')}</span>
    </figure>
  )
}
