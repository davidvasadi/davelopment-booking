'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import L from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import { MapContainer, TileLayer, Marker, ZoomControl, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { Maximize } from 'lucide-react'
import type { CountryBucket } from '@/lib/guests'
import { ISO2_TO_CAPITAL } from '@/lib/geoLookup'
import { geocodeCities, cityKey } from '@/lib/geocodeClient'

/** Flex-konténerben a Leaflet néha 0/rossz mérettel indul — mount után újraméretezzük. */
function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 180)
    return () => clearTimeout(t)
  }, [map])
  return null
}

/**
 * A nézetet a tényleges vendég-országokra illeszti (nem a fix óceán-közép marad).
 * Egyetlen ország esetén ésszerű zoom; több országnál befoglaló téglalap, kevés
 * túlnagyítással (maxZoom 5), hogy a szomszédos piacok is látszódjanak.
 */
/** Alaphelyzet: a nézetet a vendég-városokra illeszti (egy város → közelebb). */
function fitBucketsView(map: L.Map, buckets: CountryBucket[], animate = false) {
  if (buckets.length === 0) return
  const pts = buckets.map((b) => b.centroid)
  if (pts.length === 1) {
    map.setView(pts[0], 6, { animate })
  } else {
    map.fitBounds(L.latLngBounds(pts), { padding: [56, 56], maxZoom: 6, animate })
  }
}

function FitToBuckets({ buckets }: { buckets: CountryBucket[] }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => fitBucketsView(map, buckets), 220)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets])
  return null
}

/** A map-példányt kiadja a szülőnek (a visszaállító gombhoz). */
function MapRef({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap()
  useEffect(() => onReady(map), [map, onReady])
  return null
}

/**
 * Kliens térkép-komponens (Leaflet + CartoDB light_all csempe — a davelopment booking /
 * davelopment Vendég-térkép referencia szerint). SSR-ben törik (window), ezért a
 * page-ben next/dynamic + ssr:false tölti be.
 *
 * Két réteg a `buckets` fölött:
 *  1) ORSZÁG-KIFESTÉS: futásidőben letöltött world-countries GeoJSON, a vendéget
 *     adó országokra átlós gold vonalkázás (SVG <pattern>, url(#guest-hatch)).
 *  2) VÁROS-KÖZELÍTÉS: magas zoomon (>= CITY_ZOOM) az ország FŐVÁROSA jelenik meg
 *     kis gold pötty + Onest címke — mert a foglalásokban nincs valós város-adat.
 */

/** Innentől mutatunk város-markereket (ország-nézet alatt csak a count-pinek + hatch). */
const CITY_ZOOM = 6

/** HELYI, pehelysúlyú world-countries GeoJSON (public/) — `feature.id` = ISO_A3. */
const HATCH_ID = 'guest-hatch'

function pin(count: number, focus: boolean): L.DivIcon {
  const bg = focus ? '#1D1C19' : '#F1CE45'
  const fg = focus ? '#F1CE45' : '#1D1C19'
  const sz = focus ? 40 : 34
  return L.divIcon({
    className: 'guest-map-pin',
    html: `<div style="
      width:${sz}px;height:${sz}px;border-radius:50%;
      background:${bg};color:${fg};
      font:700 13px Onest,system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;
      border:3px solid #fff;
      box-shadow:0 5px 14px rgba(0,0,0,.28);
    ">${count}</div>`,
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
  })
}

/** Kis gold pötty + Onest városnév-címke (fővárosi közelítés). */
function cityMarker(city: string): L.DivIcon {
  return L.divIcon({
    className: 'guest-city-pin',
    html: `<div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
      <span style="width:9px;height:9px;border-radius:50%;background:#F1CE45;border:2px solid #1D1C19;box-shadow:0 1px 4px rgba(0,0,0,.35);"></span>
      <span style="font:600 12px Onest,system-ui,sans-serif;color:#1D1C19;background:rgba(255,255,255,.82);padding:1px 6px;border-radius:8px;box-shadow:0 1px 5px rgba(80,70,30,.18);">${city}</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [4, 4],
  })
}

/**
 * Beinjektál egy átlós (rotate 45°) gold csíkos SVG <pattern>-t a Leaflet overlay
 * SVG <defs>-ébe — a Leaflet nem támogat natívan fillPattern-t. A country-path
 * ezután url(#guest-hatch)-re állítja a fill-jét.
 */
function ensureHatchPattern(map: L.Map) {
  const svg = map.getPanes().overlayPane.querySelector('svg')
  if (!svg || svg.querySelector(`#${HATCH_ID}`)) return
  const svgNS = 'http://www.w3.org/2000/svg'
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS(svgNS, 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }
  const pattern = document.createElementNS(svgNS, 'pattern')
  pattern.setAttribute('id', HATCH_ID)
  pattern.setAttribute('patternUnits', 'userSpaceOnUse')
  pattern.setAttribute('width', '7')
  pattern.setAttribute('height', '7')
  pattern.setAttribute('patternTransform', 'rotate(45)')
  // Diagonális csík (mint a fejléc pill), de SZÜRKÉS: halvány fehér alap + szürke csík.
  const bg = document.createElementNS(svgNS, 'rect')
  bg.setAttribute('width', '7')
  bg.setAttribute('height', '7')
  bg.setAttribute('fill', '#ffffff')
  bg.setAttribute('fill-opacity', '0.3')
  const line = document.createElementNS(svgNS, 'line')
  line.setAttribute('x1', '0')
  line.setAttribute('y1', '0')
  line.setAttribute('x2', '0')
  line.setAttribute('y2', '7')
  line.setAttribute('stroke', '#8C8D88')
  line.setAttribute('stroke-width', '3')
  line.setAttribute('stroke-opacity', '0.5')
  pattern.appendChild(bg)
  pattern.appendChild(line)
  defs.appendChild(pattern)
}

/**
 * A VÁROS tényleges közigazgatási HATÁRÁT húzza ki (helyi `city-boundaries.geo.json`),
 * szaggatott vonallal + a fejléc „Új" pilljével egyező diagonális csíkos kitöltéssel.
 * A kulcs ISO2 (a bucket országának főváros-közelítése) — amint valós város-adat lesz,
 * a fájl bővíthető a tényleges városokkal.
 */
function CityBoundary({ buckets }: { buckets: CountryBucket[] }) {
  const map = useMap()
  const [cities, setCities] = useState<Record<string, GeoJSON.Geometry> | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/city-boundaries.geo.json', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCities(j))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  if (!cities) return null
  const feats = buckets
    .map((b) => cities[b.iso.toUpperCase()])
    .filter(Boolean)
    .map((geom) => ({ type: 'Feature', geometry: geom, properties: {} }) as GeoJSON.Feature)
  if (feats.length === 0) return null

  return (
    <GeoJSON
      key={buckets.map((b) => b.iso).join(',')}
      data={{ type: 'FeatureCollection', features: feats } as GeoJsonObject}
      style={{ color: '#7E7F7A', weight: 1.8, opacity: 0.95, dashArray: '5 4', fillColor: '#DEDEDB', fillOpacity: 0.4 }}
      onEachFeature={(_f, layer) => {
        // A csíkos fillt a Leaflet stílusozása UTÁN adjuk rá (rAF), különben tömör lenne.
        layer.on('add', () => {
          ensureHatchPattern(map)
          requestAnimationFrame(() => {
            const el = (layer as L.Path & { _path?: SVGPathElement })._path
            if (el) {
              el.setAttribute('fill', `url(#${HATCH_ID})`)
              el.setAttribute('fill-opacity', '1')
            }
          })
        })
      }}
    />
  )
}

/** Kiválasztott érkezés országára ugrik (érkezés-kártya kattintás). */
function FocusCountry({ buckets, focusIso }: { buckets: CountryBucket[]; focusIso?: string | null }) {
  const map = useMap()
  useEffect(() => {
    if (!focusIso) return
    const b = buckets.find((x) => x.iso.toUpperCase() === focusIso.toUpperCase())
    if (b) map.flyTo(b.centroid, Math.max(map.getZoom(), 8), { duration: 0.8 })
  }, [focusIso, buckets, map])
  return null
}

/** A buckets városait kliens-oldalon geokódolja (localStorage-cache-elt) →
 *  { "város|ISO": [lat,lng] }. Csak a hiányzókra megy hálózati hívás. */
function useGeocodedCities(buckets: CountryBucket[]): Record<string, [number, number]> {
  const [coords, setCoords] = useState<Record<string, [number, number]>>({})
  // Stabil aláírás a (város, ISO) párokból — csak tényleges változásra geokódolunk újra.
  const sig = buckets
    .flatMap((b) => (b.cities ?? []).map((c) => cityKey(c.name, b.iso)))
    .sort()
    .join(',')
  useEffect(() => {
    const pairs = buckets.flatMap((b) => (b.cities ?? []).map((c) => ({ name: c.name, iso: b.iso })))
    if (pairs.length === 0) return
    let cancelled = false
    geocodeCities(pairs).then((r) => { if (!cancelled) setCoords((prev) => ({ ...prev, ...r })) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  return coords
}

/** Zoom-figyelő: magas zoomon város-markereket rak ki — a vendégek VALÓS városaira
 *  (geokódolva), fallbackként az ország fővárosára. A marker-stílus változatlan. */
function CityMarkers({ buckets }: { buckets: CountryBucket[] }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const cityCoords = useGeocodedCities(buckets)

  if (zoom < CITY_ZOOM) return null
  return (
    <>
      {buckets.map((b) => {
        const iso = b.iso.toUpperCase()
        // Az ebben az országban geokódolt VALÓS vendég-városok.
        const resolved = (b.cities ?? [])
          .map((c) => ({ name: c.name, ll: cityCoords[cityKey(c.name, iso)] }))
          .filter((c): c is { name: string; ll: [number, number] } => !!c.ll)
        if (resolved.length > 0) {
          return resolved.map((c) => (
            <Marker key={`city-${iso}-${c.name}`} position={c.ll} icon={cityMarker(c.name)} />
          ))
        }
        // Fallback (nincs megadott város, vagy még nincs geokódolva): az ország fővárosa — a régi viselkedés.
        const cap = ISO2_TO_CAPITAL[iso]
        if (!cap) return null
        return <Marker key={`city-${iso}`} position={cap.latlng} icon={cityMarker(cap.city)} />
      })}
    </>
  )
}

export default function GuestMap({ buckets, focusIso }: { buckets: CountryBucket[]; focusIso?: string | null }) {
  const [mapObj, setMapObj] = useState<L.Map | null>(null)
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[26px]">
      {/* Alaphelyzet-gomb (jobb felül) */}
      <button
        type="button"
        onClick={() => mapObj && fitBucketsView(mapObj, buckets, true)}
        aria-label="Térkép visszaállítása"
        title="Alaphelyzet"
        className="absolute right-4 top-4 z-[600] flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-white text-ink shadow-[0_2px_8px_rgba(80,70,30,.15)] transition-colors hover:bg-paper"
      >
        <Maximize className="h-[17px] w-[17px]" strokeWidth={1.8} />
      </button>
      <style>{`.leaflet-container{background:#EDEDE9;font-family:Onest,system-ui,sans-serif;}
        .guest-map-pin,.guest-city-pin{background:transparent;border:none;}
        .leaflet-control-zoom a{border-radius:11px!important;color:#211F1A!important;border:none!important;box-shadow:0 2px 8px rgba(80,70,30,.12)!important;background:#fff!important;width:38px!important;height:38px!important;line-height:36px!important;font-size:20px!important}
        .leaflet-control-zoom{border:none!important;margin:16px!important}
        .leaflet-bar a:first-child{margin-bottom:7px}`}</style>
      <MapContainer
        center={[34, 8]}
        zoom={2}
        minZoom={2}
        worldCopyJump
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <ZoomControl position="bottomleft" />
        <MapRef onReady={setMapObj} />
        <InvalidateSize />
        <FitToBuckets buckets={buckets} />
        <FocusCountry buckets={buckets} focusIso={focusIso} />
        <CityBoundary buckets={buckets} />
        {buckets.map((b, i) => (
          <Marker
            key={b.iso}
            position={b.centroid}
            icon={pin(b.count, i === 0)}
            eventHandlers={{ click: () => mapObj?.flyTo(b.centroid, 9, { duration: 0.8 }) }}
          />
        ))}
        <CityMarkers buckets={buckets} />
      </MapContainer>
    </div>
  )
}
