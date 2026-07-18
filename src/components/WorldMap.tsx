import { type CSSProperties, type KeyboardEvent, useId, useMemo } from 'react'
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

export type WorldMapProps = {
  regions: Readonly<Partial<Record<WorldMapRegionId, WorldMapRegionIntensity>>>
  selectedRegion?: WorldMapRegionId | null
  onRegionClick: (regionId: WorldMapRegionId) => void
  eventMarkers?: readonly WorldMapMarker[]
  onMarkerClick?: (marker: WorldMapMarker) => void
  /** Change this value to replay the synchronized global reset pulse. */
  resetPulse?: number
  className?: string
  ariaLabel?: string
}

const WIDTH = 960
const HEIGHT = 540

const REGION_META: Record<WorldMapRegionId, { label: string; coordinates: readonly [number, number] }> = {
  na: { label: 'North America', coordinates: [-101, 42] },
  latam: { label: 'Latin America', coordinates: [-61, -15] },
  eu: { label: 'Europe', coordinates: [14, 52] },
  africa: { label: 'Africa', coordinates: [22, 0] },
  mena: { label: 'Middle East', coordinates: [45, 27] },
  india: { label: 'India', coordinates: [79, 22] },
  eastAsia: { label: 'East Asia', coordinates: [116, 34] },
  oceania: { label: 'Oceania', coordinates: [137, -25] },
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

const networkArc = (from: WorldMapRegionId, to: WorldMapRegionId) => {
  const [x1, y1] = regionPoints[from]
  const [x2, y2] = regionPoints[to]
  const distance = Math.hypot(x2 - x1, y2 - y1)
  const bend = Math.min(76, Math.max(24, distance * 0.18))
  const midpointX = (x1 + x2) / 2
  const midpointY = (y1 + y2) / 2 - bend
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${midpointX.toFixed(1)},${midpointY.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`
}

const asLinePath = (coordinates: Position[]) => pathGenerator({ type: 'LineString', coordinates } as LineString) ?? ''

export default function WorldMap({
  regions,
  selectedRegion = null,
  onRegionClick,
  eventMarkers = [],
  onMarkerClick,
  resetPulse = 0,
  className = '',
  ariaLabel = 'Interactive map of global AI access and education networks',
}: WorldMapProps) {
  const rawId = useId().replaceAll(':', '')
  const glowId = `world-map-glow-${rawId}`
  const softGlowId = `world-map-soft-glow-${rawId}`
  const gridId = `world-map-grid-${rawId}`
  const selectedId = `world-map-selected-${rawId}`

  const activeRegions = useMemo(() => WORLD_MAP_REGION_IDS
    .filter((regionId) => regions[regionId]?.active !== false && clamp01(regions[regionId]?.adoption ?? 0) > 0)
    .sort((left, right) => {
      const leftValue = clamp01(regions[left]?.adoption ?? 0) + clamp01(regions[left]?.codexShare ?? 0)
      const rightValue = clamp01(regions[right]?.adoption ?? 0) + clamp01(regions[right]?.codexShare ?? 0)
      return rightValue - leftValue
    }), [regions])

  const networkOrigin = activeRegions[0]
  const networkTargets = networkOrigin ? activeRegions.slice(1, 7) : []

  return (
    <figure className={`world-map ${className}`.trim()} aria-label={ariaLabel}>
      <svg className="world-map__canvas" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={ariaLabel}>
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
            const style = {
              '--region-intensity': intensity.toFixed(3),
              '--region-share': codexShare.toFixed(3),
            } as CSSProperties

            return (
              <path
                key={regionId}
                className={`world-map__region${active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                d={regionPaths[regionId]}
                style={style}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${label}. AI access ${percent(adoption)}. Codex share ${percent(codexShare)}.`}
                onClick={() => onRegionClick(regionId)}
                onKeyDown={(event) => keyboardActivate(event, () => onRegionClick(regionId))}
              >
                <title>{label}: AI access {percent(adoption)}, Codex share {percent(codexShare)}</title>
              </path>
            )
          })}
        </g>

        <path className="world-map__country-lines" d={countriesPath} aria-hidden="true" />

        <g className="world-map__network" aria-hidden="true">
          {networkOrigin && networkTargets.map((target, index) => (
            <g key={`${networkOrigin}-${target}`} style={{ '--arc-delay': `${index * -0.72}s` } as CSSProperties}>
              <path className="world-map__arc-halo" d={networkArc(networkOrigin, target)} />
              <path className="world-map__arc" d={networkArc(networkOrigin, target)} pathLength={1} />
            </g>
          ))}
        </g>

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
            const source = marker.sourceLabel ? ` Source: ${marker.sourceLabel}.` : ''
            return (
              <g
                key={marker.id}
                className={`world-map__marker world-map__marker--${marker.kind ?? 'community'}${marker.active === false ? ' is-muted' : ''}`}
                transform={`translate(${point[0]} ${point[1]})`}
                style={{ '--marker-delay': `${index * -.42}s` } as CSSProperties}
                role={actionable ? 'button' : 'img'}
                tabIndex={0}
                aria-label={`${marker.label}.${source}`}
                onClick={actionable ? activate : undefined}
                onKeyDown={actionable ? (event) => keyboardActivate(event, activate) : undefined}
              >
                <title>{marker.label}{marker.sourceLabel ? ` — ${marker.sourceLabel}` : ''}</title>
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
        <span><i className="world-map__legend-access" /> AI access</span>
        <span><i className="world-map__legend-network" /> Learning network</span>
        <span><i className="world-map__legend-event" /> Scenario event</span>
      </figcaption>
      <span className="world-map__coordinate" aria-hidden="true">GLOBAL ACCESS NETWORK · 110M</span>
    </figure>
  )
}
