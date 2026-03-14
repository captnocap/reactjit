/**
 * Geo — Declarative mapping with a react-leaflet API on Love2D.
 *
 * 18 components, 6 hooks, full event system, offline tile cache.
 * The complete react-leaflet surface, rendered natively by Lua + OpenGL.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, classifiers as S } from '../../../packages/core/src';
import {
  MapContainer, TileLayer, Marker, Popup, Tooltip,
  Polyline, Polygon, Circle, CircleMarker, Rectangle,
  GeoJSON, LayerGroup, FeatureGroup, Pane,
  ImageOverlay, ZoomControl, ScaleControl,
  LayersControl,
  useProjection,
} from '../../../packages/geo/src';
import type { LatLngTuple } from '../../../packages/geo/src';
import { useThemeColors } from '../../../packages/theme/src';
import {Band, Half, Divider, SectionLabel, PageColumn} from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#f97316',
  accentDim: 'rgba(249, 115, 22, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  pink: '#ec4899',
  route: '#f97316',
  zone: '#60a5fa',
  marker: '#ef4444',
  cyan: '#06b6d4',
  purple: '#a855f7',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import {
  MapContainer, TileLayer, Marker, Popup, Tooltip,
  Polyline, Polygon, Circle, CircleMarker, Rectangle,
  GeoJSON, LayerGroup, FeatureGroup, Pane,
  ImageOverlay, LayersControl,
  ZoomControl, ScaleControl, AttributionControl,
  useMap, useMapEvent, useMapEvents,
  useMapView, useTileCache, useProjection,
} from '@reactjit/geo'`;

const MAPCONTAINER_CODE = `<MapContainer
  center={[37.7749, -122.4194]}
  zoom={12}
  bearing={0}            // rotation in degrees
  pitch={0}              // tilt angle (0 = top-down)
  minZoom={2}
  maxZoom={18}
  maxBounds={[[37.6, -122.6], [37.9, -122.3]]}
  scrollWheelZoom={true}
  dragging={true}
  doubleClickZoom={true}
  zoomControl={true}
  attributionControl={true}
  style={{ width: '100%', height: '100%' }}
  whenReady={() => console.log('Map loaded')}
>
  {/* children: TileLayer, markers, vectors, controls */}
</MapContainer>`;

const TILELAYER_CODE = `// OpenStreetMap (default)
<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

// Satellite imagery
<TileLayer
  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  attribution="Esri, Maxar, Earthstar"
  maxZoom={19}
/>

// Custom headers (e.g. API key)
<TileLayer
  url="https://tiles.example.com/{z}/{x}/{y}.png"
  subdomains={['a', 'b', 'c']}
  headers={{ Authorization: 'Bearer ...' }}
  tileSize={256}
  opacity={0.8}
/>`;

const MARKER_CODE = `<Marker
  position={[37.7749, -122.4194]}
  draggable={true}
  icon="pin-red"
  opacity={0.9}
  zIndexOffset={100}
  eventHandlers={{
    click: (e) => console.log('Clicked', e.latlng),
    dragend: (e) => console.log('Dropped at', e.latlng),
    contextmenu: (e) => console.log('Right-click', e.latlng),
  }}
>
  <Popup maxWidth={200} closeButton autoClose>
    {'Drag me around!'}
  </Popup>
  <Tooltip direction="top" permanent sticky>
    {'Always visible'}
  </Tooltip>
</Marker>`;

const POPUP_TOOLTIP_CODE = `// Popup — info bubble on click
<Popup
  maxWidth={300}
  minWidth={50}
  closeButton={true}
  autoClose={true}
  closeOnClick={true}
  closeOnEscapeKey={true}
>
  {'Click the marker to see this'}
</Popup>

// Tooltip — hover or permanent label
<Tooltip
  direction="top"    // top | bottom | left | right | center | auto
  permanent={false}  // always visible vs hover-only
  sticky={false}     // follow mouse vs anchor to marker
  opacity={0.9}
>
  {'Hover to see this'}
</Tooltip>`;

const PATHOPTIONS_CODE = `// PathOptions — shared by all vector layers
const pathOptions = {
  color: '#f97316',      // stroke color
  weight: 3,             // stroke width (px)
  opacity: 1,            // stroke opacity (0-1)
  fillColor: '#f97316',  // fill color (defaults to color)
  fillOpacity: 0.2,      // fill opacity (0-1)
  dashArray: [10, 5],    // dash pattern [dash, gap]
  fill: true,            // enable fill
  stroke: true,          // enable stroke
}

<Polygon positions={[...]} pathOptions={pathOptions} />
<Circle center={[...]} radius={1000} pathOptions={pathOptions} />`;

const POLYLINE_CODE = `// Simple route
<Polyline
  positions={[[37.79, -122.40], [37.78, -122.41], [37.77, -122.43]]}
  pathOptions={{ color: '#f97316', weight: 4 }}
/>

// Multi-polyline (separate segments)
<Polyline
  positions={[
    [[37.79, -122.40], [37.78, -122.41]],  // segment 1
    [[37.77, -122.43], [37.76, -122.44]],  // segment 2
  ]}
  pathOptions={{ color: '#60a5fa', dashArray: [8, 4] }}
/>`;

const POLYGON_CODE = `// Simple polygon
<Polygon
  positions={[[37.80, -122.46], [37.80, -122.38], [37.74, -122.38]]}
  pathOptions={{ color: '#60a5fa', fillOpacity: 0.15 }}
/>

// Polygon with hole
<Polygon
  positions={[
    [[37.80, -122.46], [37.80, -122.38], [37.74, -122.38]],  // outer
    [[37.78, -122.44], [37.78, -122.40], [37.76, -122.40]],  // hole
  ]}
/>

// Multi-polygon
<Polygon positions={[[[...]], [[...]]]} />`;

const CIRCLE_VS_MARKER_CODE = `// Circle — radius in METERS, scales with zoom
<Circle
  center={[37.7749, -122.4194]}
  radius={2000}  // 2km radius
  pathOptions={{ color: '#22c55e', fillOpacity: 0.1 }}
/>

// CircleMarker — radius in PIXELS, fixed on screen
<CircleMarker
  center={[37.7749, -122.4194]}
  radius={8}  // 8px, stays the same at every zoom
  pathOptions={{ color: '#06b6d4', fillOpacity: 0.8 }}
/>`;

const RECTANGLE_CODE = `<Rectangle
  bounds={[
    [37.760, -122.445],  // southwest corner
    [37.770, -122.430],  // northeast corner
  ]}
  pathOptions={{
    color: '#a855f7',
    weight: 2,
    fillOpacity: 0.1,
  }}
/>`;

const GEOJSON_CODE = `const data = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[lng, lat], ...]] },
    properties: { name: 'Zone A', fill: '#22c55e', stroke: '#15803d' },
  }],
}

// Basic — styling from properties
<GeoJSON data={data} />

// Dynamic style function
<GeoJSON
  data={data}
  style={(feature) => ({
    color: feature.properties.stroke,
    fillColor: feature.properties.fill,
    fillOpacity: 0.3,
  })}
  filter={(feature) => feature.properties.active !== false}
  onEachFeature={(feature, nodeId) => {
    console.log(feature.properties.name, nodeId)
  }}
/>`;

const IMAGEOVERLAY_CODE = `<ImageOverlay
  url="https://example.com/overlay.png"
  bounds={[
    [37.760, -122.445],  // southwest
    [37.790, -122.400],  // northeast
  ]}
  opacity={0.6}
  zIndex={500}
/>`;

const LAYERSCONTROL_CODE = `<LayersControl position="topright" collapsed={false}>
  <LayersControl.BaseLayer checked name="Streets">
    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
  </LayersControl.BaseLayer>
  <LayersControl.BaseLayer name="Satellite">
    <TileLayer url="https://server.arcgisonline.com/..." />
  </LayersControl.BaseLayer>

  <LayersControl.Overlay checked name="Markers">
    <LayerGroup>
      <Marker position={[37.77, -122.42]} />
      <Marker position={[37.78, -122.41]} />
    </LayerGroup>
  </LayersControl.Overlay>
  <LayersControl.Overlay name="Zones">
    <FeatureGroup pathOptions={{ color: 'purple' }}>
      <Polygon positions={[...]} />
    </FeatureGroup>
  </LayersControl.Overlay>
</LayersControl>`;

const LAYERGROUP_CODE = `// LayerGroup — logical grouping, no shared style
<LayerGroup>
  <Marker position={[37.77, -122.42]} />
  <Marker position={[37.78, -122.41]} />
  <Circle center={[37.775, -122.415]} radius={500} />
</LayerGroup>

// FeatureGroup — shared pathOptions cascade to children
<FeatureGroup pathOptions={{ color: 'purple', fillOpacity: 0.1 }}>
  <Polygon positions={[...]} />
  <Rectangle bounds={[...]} />
</FeatureGroup>

// Pane — z-index layering control
<Pane name="custom-overlay" zIndex={650}>
  <Circle center={[37.77, -122.42]} radius={1000} />
</Pane>`;

const EVENTS_CODE = `// Single event
useMapEvent('click', (e) => {
  console.log('Clicked at', e.latlng, 'pixel', e.pixel)
})

// Multiple events
useMapEvents({
  click: (e) => addMarker(e.latlng),
  zoom: () => console.log('Zoomed'),
  moveend: () => console.log('Stopped moving'),
  contextmenu: (e) => showContextMenu(e.latlng),
})

// Available events:
// Mouse: click, dblclick, mousedown, mouseup, mousemove, contextmenu
// Zoom:  zoom, zoomstart, zoomend
// Move:  move, movestart, moveend
// Drag:  drag, dragstart, dragend
// UI:    popupopen, popupclose, tooltipopen, tooltipclose`;

const USEMAP_CODE = `function MapControls() {
  const map = useMap()

  return (
    <Box style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable onPress={() => map.flyTo({
        center: [35.6895, 139.6917],
        zoom: 14,
        bearing: 45,
        pitch: 30,
        duration: 2000,
      })}>
        <Text>Fly to Tokyo</Text>
      </Pressable>

      <Pressable onPress={() => map.fitBounds(
        [[37.7, -122.5], [37.85, -122.35]],
        { animate: true }
      )}>
        <Text>Fit SF Bay</Text>
      </Pressable>
    </Box>
  )
}`;

const USEMAPVIEW_CODE = `function ViewTracker() {
  const view = useMapView()
  // view = { center: [lat, lng], zoom, bearing, pitch }

  return (
    <Box>
      <Text>{\`Center: \${view.center[0].toFixed(4)}, \${view.center[1].toFixed(4)}\`}</Text>
      <Text>{\`Zoom: \${view.zoom}  Bearing: \${view.bearing}°  Pitch: \${view.pitch}°\`}</Text>
    </Box>
  )
}`;

const PROJECTION_CODE = `const { latlngToPixel, pixelToLatlng, distance } = useProjection()

// Convert geo coords → pixel coords at zoom level
const [px, py] = latlngToPixel(37.7749, -122.4194, 12)

// Convert back — exact round-trip
const [lat, lng] = pixelToLatlng(px, py, 12)

// Haversine great-circle distance (returns meters)
const meters = distance(37.77, -122.42, 35.69, 139.69)
const km = meters / 1000
const miles = meters / 1609.344
const nautical = meters / 1852`;

const TILECACHE_CODE = `const cache = useTileCache()

// Download tiles for offline use
const regionId = await cache.downloadRegion(
  [[37.7, -122.5], [37.85, -122.35]],
  { source: 'osm', minZoom: 10, maxZoom: 15 }
)

// Track download progress
const progress = await cache.getProgress(regionId)
// { total: 2048, done: 1500, failed: 0, percent: 73.2,
//   cancelled: false, complete: false }

// Inspect cache stats
const stats = await cache.stats()
// { memoryTiles: 128, dbTiles: 4200, dbBytes: 12500000,
//   sources: { osm: 4200 } }`;

const CONTROLS_CODE = `<MapContainer center={[51.505, -0.09]} zoom={13}>
  <TileLayer url="..." />

  <ZoomControl
    position="topleft"
    zoomInText="+"
    zoomOutText="-"
  />

  <ScaleControl
    position="bottomleft"
    maxWidth={100}
    metric={true}
    imperial={false}
  />

  <AttributionControl
    position="bottomright"
    prefix="ReactJIT"
  />
</MapContainer>`;

const LATLNG_CODE = `// Two equivalent ways to specify coordinates:

// Tuple form (most common)
const sf: LatLngTuple = [37.7749, -122.4194]  // [lat, lng]

// Object form (react-leaflet compatible)
const sf = { lat: 37.7749, lng: -122.4194 }

// Bounds — two corners
const bounds: LatLngBoundsExpression =
  [[37.7, -122.5], [37.85, -122.35]]    // array form
  // or
  { southWest: [37.7, -122.5], northEast: [37.85, -122.35] }

// Both forms work everywhere:
<Marker position={[37.7749, -122.4194]} />
<Marker position={{ lat: 37.7749, lng: -122.4194 }} />`;

const PITCH_BEARING_CODE = `// Pitch = camera tilt (0° = top-down, 60° = perspective)
// Bearing = compass rotation (0° = north up)

<MapContainer
  center={[37.7749, -122.4194]}
  zoom={14}
  pitch={45}
  bearing={30}
>
  <TileLayer url="..." />
</MapContainer>

// Or set programmatically:
const map = useMap()
map.setPitch(45)
map.setBearing(180)  // south up
map.flyTo({ center: [37.77, -122.42], pitch: 60, bearing: -30 })`;

// ── Hoisted data ─────────────────────────────────────────

const CITIES: { label: string; center: LatLngTuple }[] = [
  { label: 'San Francisco', center: [37.7749, -122.4194] },
  { label: 'Tokyo', center: [35.6895, 139.6917] },
  { label: 'London', center: [51.5072, -0.1276] },
  { label: 'Sydney', center: [-33.8688, 151.2093] },
  { label: 'Cairo', center: [30.0444, 31.2357] },
];

const COMPONENT_CATALOG = [
  { label: 'MapContainer', desc: 'Root viewport — center, zoom, pitch, bearing, bounds, interaction flags', color: C.blue },
  { label: 'TileLayer', desc: 'Raster tile source — url, subdomains, headers, tileSize, opacity', color: C.teal },
  { label: 'Marker', desc: 'Point marker — position, draggable, icon, opacity, eventHandlers', color: C.red },
  { label: 'Popup', desc: 'Click-triggered info bubble — maxWidth, closeButton, autoClose, closeOnEscape', color: C.peach },
  { label: 'Tooltip', desc: 'Hover/permanent label — direction, permanent, sticky, opacity', color: C.yellow },
  { label: 'Polyline', desc: 'Route/path — positions (simple or multi), pathOptions', color: C.route },
  { label: 'Polygon', desc: 'Closed shape — positions (simple, with holes, or multi), pathOptions', color: C.zone },
  { label: 'Circle', desc: 'Radius overlay in meters — center, radius, pathOptions (scales with zoom)', color: C.green },
  { label: 'CircleMarker', desc: 'Fixed-pixel marker — center, radius in px, pathOptions (constant size)', color: C.cyan },
  { label: 'Rectangle', desc: 'Bounding box — bounds [[sw], [ne]], pathOptions', color: C.purple },
  { label: 'GeoJSON', desc: 'FeatureCollection renderer — data, style fn, filter fn, onEachFeature', color: C.teal },
  { label: 'LayerGroup', desc: 'Logical grouping — no shared styling, just organizational', color: C.blue },
  { label: 'FeatureGroup', desc: 'Styled grouping — pathOptions cascade to all children', color: C.mauve },
  { label: 'Pane', desc: 'Z-index layer — name, zIndex (controls draw order)', color: C.pink },
  { label: 'ImageOverlay', desc: 'Raster image on bounds — url, bounds, opacity, zIndex', color: C.peach },
  { label: 'LayersControl', desc: 'Base layer + overlay toggling — BaseLayer, Overlay sub-components', color: C.yellow },
  { label: 'ZoomControl', desc: 'Zoom +/- buttons — position, zoomInText, zoomOutText', color: C.green },
  { label: 'ScaleControl', desc: 'Distance scale bar — position, maxWidth, metric, imperial', color: C.teal },
  { label: 'AttributionControl', desc: 'Attribution text — position, prefix', color: C.blue },
];

const HOOK_CATALOG = [
  { label: 'useMap()', desc: 'Imperative handle — panTo, zoomTo, flyTo, fitBounds, setPitch, setBearing, getCenter, getZoom, getBounds', color: C.blue },
  { label: 'useMapEvent(type, handler)', desc: 'Subscribe to one map event — returns MapHandle for chaining', color: C.teal },
  { label: 'useMapEvents(handlers)', desc: 'Subscribe to multiple events — { click, zoom, moveend, ... }', color: C.green },
  { label: 'useMapView()', desc: 'Reactive state — { center, zoom, bearing, pitch } updates on every change', color: C.yellow },
  { label: 'useTileCache()', desc: 'Offline tiles — downloadRegion, getProgress, stats', color: C.mauve },
  { label: 'useProjection()', desc: 'Mercator math — latlngToPixel, pixelToLatlng, distance (Haversine)', color: C.peach },
];

const EVENT_CATALOG = [
  { label: 'click', desc: 'Map or layer clicked — { latlng, pixel }', color: C.blue },
  { label: 'dblclick', desc: 'Double-click — { latlng, pixel }', color: C.teal },
  { label: 'contextmenu', desc: 'Right-click — { latlng, pixel }', color: C.green },
  { label: 'mousedown / mouseup', desc: 'Press / release — { latlng, pixel }', color: C.yellow },
  { label: 'mousemove', desc: 'Pointer move — { latlng, pixel }', color: C.mauve },
  { label: 'zoom / zoomstart / zoomend', desc: 'Zoom lifecycle — no payload', color: C.peach },
  { label: 'move / movestart / moveend', desc: 'Pan lifecycle — no payload', color: C.route },
  { label: 'drag / dragstart / dragend', desc: 'Drag lifecycle — dragend has { latlng }', color: C.red },
  { label: 'popupopen / popupclose', desc: 'Popup visibility changed — no payload', color: C.pink },
  { label: 'tooltipopen / tooltipclose', desc: 'Tooltip visibility changed — no payload', color: C.cyan },
];

const PATHOPTIONS_CATALOG = [
  { label: 'color', desc: 'Stroke color (hex/rgb/named)', def: '#3388ff', color: C.blue },
  { label: 'weight', desc: 'Stroke width in pixels', def: '3', color: C.teal },
  { label: 'opacity', desc: 'Stroke opacity (0-1)', def: '1', color: C.green },
  { label: 'fillColor', desc: 'Fill color (defaults to color)', def: 'color', color: C.yellow },
  { label: 'fillOpacity', desc: 'Fill opacity (0-1)', def: '0.2', color: C.mauve },
  { label: 'dashArray', desc: 'Dash pattern [dash, gap]', def: 'solid', color: C.peach },
  { label: 'fill', desc: 'Enable fill rendering', def: 'true', color: C.route },
  { label: 'stroke', desc: 'Enable stroke rendering', def: 'true', color: C.red },
];

const CONTROL_POSITIONS = [
  { label: 'topleft', desc: 'ZoomControl default', color: C.blue },
  { label: 'topright', desc: 'LayersControl default', color: C.teal },
  { label: 'bottomleft', desc: 'ScaleControl default', color: C.green },
  { label: 'bottomright', desc: 'AttributionControl default', color: C.yellow },
];

// ── Live Demo: Projection Math ──────────────────────────

function ProjectionDemo() {
  const c = useThemeColors();
  const { latlngToPixel, pixelToLatlng, distance } = useProjection();

  const sf: LatLngTuple = [37.7749, -122.4194];
  const tokyo: LatLngTuple = [35.6895, 139.6917];
  const [px, py] = latlngToPixel(sf[0], sf[1], 12);
  const [lat, lng] = pixelToLatlng(px, py, 12);
  const distKm = distance(sf[0], sf[1], tokyo[0], tokyo[1]);
  const results = { px, py, lat, lng, dist: distKm };

  return (
    <S.StackG6W100>
      <S.StoryCap>{'Mercator projection (pure math, no bridge)'}</S.StoryCap>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.blue }}>{'latlngToPixel(37.7749, -122.4194, z12)'}</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <S.StoryBody>{`x: ${results.px.toFixed(1)}, y: ${results.py.toFixed(1)}`}</S.StoryBody>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.teal }}>{'pixelToLatlng round-trip'}</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <S.StoryBody>{`lat: ${results.lat.toFixed(6)}, lng: ${results.lng.toFixed(6)}`}</S.StoryBody>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.peach }}>{'distance(SF → Tokyo)'}</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <S.StoryBody>{`${(results.dist / 1000).toFixed(1)} km (${(results.dist / 1609.344).toFixed(1)} mi)`}</S.StoryBody>
        </Box>
      </Box>

      <S.RowCenterG6>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
        <Text style={{ fontSize: 10, color: C.green }}>
          {Math.abs(results.lat - 37.7749) < 0.0001 ? 'Round-trip OK' : 'Precision loss'}
        </Text>
      </S.RowCenterG6>
    </S.StackG6W100>
  );
}

// ── Live Demo: Distance Calculator ──────────────────────

function DistanceDemo() {
  const c = useThemeColors();
  const { distance } = useProjection();
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);

  const from = CITIES[fromIdx];
  const to = CITIES[toIdx];
  const dist = distance(from.center[0], from.center[1], to.center[0], to.center[1]);

  const cycleFrom = () => setFromIdx(i => (i + 1) % CITIES.length);
  const cycleTo = () => setToIdx(i => (i + 1) % CITIES.length);

  return (
    <S.StackG6W100>
      <S.StoryCap>{'Haversine great-circle distance'}</S.StoryCap>

      <S.RowCenterG8>
        <Pressable onPress={cycleFrom}>
          <Box style={{ backgroundColor: C.blue, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{from.label}</Text>
          </Box>
        </Pressable>
        <S.StoryMuted>{'to'}</S.StoryMuted>
        <Pressable onPress={cycleTo}>
          <Box style={{ backgroundColor: C.peach, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{to.label}</Text>
          </Box>
        </Pressable>
      </S.RowCenterG8>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
        <S.RowCenterG8>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} />
          <Text style={{ fontSize: 12, color: c.text }}>{`${(dist / 1000).toFixed(1)} km`}</Text>
        </S.RowCenterG8>
        <S.RowCenterG8>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.yellow }} />
          <S.StoryMuted>
            {`${(dist / 1609.344).toFixed(1)} miles  ·  ${(dist / 1852).toFixed(1)} nmi`}
          </S.StoryMuted>
        </S.RowCenterG8>
      </Box>

      <S.StoryTiny>{'Tap city names to cycle through destinations'}</S.StoryTiny>
    </S.StackG6W100>
  );
}

// ── Live Demo: Mini Map ─────────────────────────────────

function MiniMapDemo() {
  const c = useThemeColors();
  const [cityIdx, setCityIdx] = useState(0);
  const city = CITIES[cityIdx];
  const cycleCity = () => setCityIdx(i => (i + 1) % CITIES.length);

  const [lat, lng] = city.center;
  const route: LatLngTuple[] = [
    [lat + 0.01, lng - 0.015],
    [lat + 0.005, lng - 0.005],
    [lat, lng],
    [lat - 0.005, lng + 0.008],
    [lat - 0.012, lng + 0.015],
  ];

  return (
    <S.StackG6W100>
      <S.RowCenterG8>
        <S.StoryCap>{'Live map preview'}</S.StoryCap>
        <Pressable onPress={cycleCity}>
          <Box style={{ backgroundColor: C.accent, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{city.label}</Text>
          </Box>
        </Pressable>
      </S.RowCenterG8>

      <S.Bordered style={{ width: '100%', height: 200, borderRadius: 6, overflow: 'hidden' }}>
        <MapContainer center={city.center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={city.center}>
            <Popup>{city.label}</Popup>
          </Marker>
          <Polyline positions={route} pathOptions={{ color: C.route, weight: 3 }} />
          <Circle center={city.center} radius={800} pathOptions={{ color: C.zone, weight: 2, fillColor: C.zone, fillOpacity: 0.1 }} />
        </MapContainer>
      </S.Bordered>
    </S.StackG6W100>
  );
}

// ── Live Demo: Vector Layers ────────────────────────────

function VectorLayersDemo() {
  const c = useThemeColors();
  const center: LatLngTuple = [37.7749, -122.4194];

  const polygonPositions: LatLngTuple[] = [
    [37.805, -122.462], [37.805, -122.379], [37.737, -122.379], [37.737, -122.462],
  ];
  const routePositions: LatLngTuple[] = [
    [37.794, -122.397], [37.784, -122.407], [37.775, -122.419], [37.766, -122.434], [37.758, -122.447],
  ];

  const geojsonData = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [[[-122.430, 37.785], [-122.420, 37.785], [-122.420, 37.778], [-122.430, 37.778], [-122.430, 37.785]]] },
        properties: { name: 'District A', fill: '#22c55ecc', stroke: '#15803d' },
      },
      {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [[[-122.415, 37.775], [-122.405, 37.775], [-122.405, 37.768], [-122.415, 37.768], [-122.415, 37.775]]] },
        properties: { name: 'District B', fill: '#a78bfa99', stroke: '#6d28d9' },
      },
    ],
  };

  return (
    <S.StackG6W100>
      <S.StoryCap>{'All 6 vector layer types on one map'}</S.StoryCap>

      <S.Bordered style={{ width: '100%', height: 220, borderRadius: 6, overflow: 'hidden' }}>
        <MapContainer center={center} zoom={12.5} style={{ width: '100%', height: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Polygon positions={polygonPositions} pathOptions={{ color: C.zone, weight: 2, fillColor: '#3b82f6', fillOpacity: 0.12 }} />
          <Polyline positions={routePositions} pathOptions={{ color: C.route, weight: 4 }} />
          <Circle center={center} radius={1500} pathOptions={{ color: C.green, weight: 2, fillColor: '#22c55e', fillOpacity: 0.08 }} />
          <CircleMarker center={[37.790, -122.400]} radius={6} pathOptions={{ color: C.cyan, fillColor: '#22d3ee', fillOpacity: 0.8 }} />
          <Rectangle bounds={[[37.760, -122.445], [37.770, -122.430]]} pathOptions={{ color: C.purple, weight: 2, fillColor: C.purple, fillOpacity: 0.1 }} />
          <GeoJSON data={geojsonData} />
          {routePositions.map((pos, i) => (
            <Marker key={i} position={pos}>
              <Tooltip permanent>{`${i + 1}`}</Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </S.Bordered>

      <S.RowG8 style={{ flexWrap: 'wrap' }}>
        {[
          { label: 'Polyline', color: C.route },
          { label: 'Polygon', color: C.zone },
          { label: 'Circle', color: C.green },
          { label: 'CircleMarker', color: C.cyan },
          { label: 'Rectangle', color: C.purple },
          { label: 'GeoJSON', color: C.teal },
        ].map(item => (
          <S.RowCenterG4 key={item.label}>
            <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color }} />
            <S.StoryCap>{item.label}</S.StoryCap>
          </S.RowCenterG4>
        ))}
      </S.RowG8>
    </S.StackG6W100>
  );
}

// ── Live Demo: Circle vs CircleMarker ───────────────────

function CircleCompareDemo() {
  const c = useThemeColors();
  const center: LatLngTuple = [37.7749, -122.4194];

  return (
    <S.StackG6W100>
      <S.StoryCap>{'Circle (meters) vs CircleMarker (pixels)'}</S.StoryCap>

      <S.Bordered style={{ width: '100%', height: 180, borderRadius: 6, overflow: 'hidden' }}>
        <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Circle center={center} radius={500} pathOptions={{ color: C.green, weight: 2, fillColor: C.green, fillOpacity: 0.15 }} />
          <CircleMarker center={[37.780, -122.410]} radius={8} pathOptions={{ color: C.cyan, weight: 2, fillColor: C.cyan, fillOpacity: 0.6 }} />
          <Marker position={center}>
            <Tooltip permanent direction="bottom">{'500m radius'}</Tooltip>
          </Marker>
          <Marker position={[37.780, -122.410]}>
            <Tooltip permanent direction="bottom">{'8px fixed'}</Tooltip>
          </Marker>
        </MapContainer>
      </S.Bordered>

      <Box style={{ flexDirection: 'row', gap: 16 }}>
        <S.RowCenterG4>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} />
          <S.StoryCap>{'Circle: scales with zoom'}</S.StoryCap>
        </S.RowCenterG4>
        <S.RowCenterG4>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.cyan }} />
          <S.StoryCap>{'CircleMarker: constant pixels'}</S.StoryCap>
        </S.RowCenterG4>
      </Box>
    </S.StackG6W100>
  );
}

// ── Live Demo: Tile Sources ─────────────────────────────

function TileSourceDemo() {
  const c = useThemeColors();
  const [source, setSource] = useState<'osm' | 'satellite'>('osm');
  const center: LatLngTuple = [37.7749, -122.4194];

  const urls: Record<string, string> = {
    osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };

  return (
    <S.StackG6W100>
      <S.RowCenterG8>
        <S.StoryCap>{'Tile source switching'}</S.StoryCap>
        <Pressable onPress={() => setSource(s => s === 'osm' ? 'satellite' : 'osm')}>
          <Box style={{ backgroundColor: source === 'osm' ? C.blue : C.green, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{source === 'osm' ? 'Streets' : 'Satellite'}</Text>
          </Box>
        </Pressable>
      </S.RowCenterG8>

      <S.Bordered style={{ width: '100%', height: 180, borderRadius: 6, overflow: 'hidden' }}>
        <MapContainer center={center} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false} attributionControl={false}>
          <TileLayer url={urls[source]} />
          <Marker position={center} />
        </MapContainer>
      </S.Bordered>
    </S.StackG6W100>
  );
}

// ── Catalog Renderer ────────────────────────────────────

function CatalogList({ items }: { items: { label: string; desc: string; color: string; def?: string }[] }) {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {items.map(a => (
        <S.RowCenterG8 key={a.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: a.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 130, flexShrink: 0 }}>{a.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{a.def ? `${a.desc} (default: ${a.def})` : a.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── GeoStory ────────────────────────────────────────────

export function GeoStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="globe" tintColor={C.accent} />
        <S.StoryTitle>{'Geo'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/geo'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'18 components · 6 hooks · 17 events'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero ── */}
        <Box style={{ borderLeftWidth: 3, borderColor: C.accent, paddingLeft: 25, paddingRight: 28, paddingTop: 24, paddingBottom: 24, gap: 8 }}>
          <S.StoryHeadline>
            {'Declarative maps rendered at 60fps by OpenGL.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'The full react-leaflet component API — MapContainer, TileLayer, Marker, Polyline, Polygon, Circle, GeoJSON, controls, layer management, and 6 hooks — all rendered by Lua via Love2D. No browser, no DOM, no Leaflet.js. Tile fetching, Mercator projection, hit testing, pan/zoom/pitch/bearing, offline caching, and the full event system all run in Lua. React just declares the map tree.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── 1: INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Drop-in replacement for react-leaflet. Same component names, same props, same nesting. Import from @reactjit/geo instead of react-leaflet and your existing map code works unchanged.'}
            </S.StoryBody>
            <S.StoryCap>
              {'18 components and 6 hooks in one import. Components render to Lua host elements (Map2D, MapTileLayer, MapMarker, etc.) via React.createElement.'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── 2: MAPCONTAINER ── */}
        <Band>
          <Half>
            <MiniMapDemo />
          </Half>
          <Half>
            <SectionLabel icon="map">{'MAPCONTAINER'}</SectionLabel>
            <S.StoryBody>
              {'The root viewport. Takes center, zoom, pitch (camera tilt), bearing (compass rotation), min/max zoom bounds, interaction flags, and style. All children (tiles, markers, vectors, controls) nest inside.'}
            </S.StoryBody>
            <S.StoryCap>
              {'scrollWheelZoom, dragging, doubleClickZoom, zoomControl, and attributionControl all default to true. Set any to false to disable. maxBounds constrains pan area.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MAPCONTAINER_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── 3: TILELAYER ── */}
        <Band>
          <Half>
            <SectionLabel icon="grid">{'TILELAYER'}</SectionLabel>
            <S.StoryBody>
              {'Raster tile source for the base map. Supports any {z}/{x}/{y} tile URL — OpenStreetMap, satellite imagery, custom tile servers. Options for subdomains (load balancing), custom headers (API keys), tileSize, opacity, and z-index.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Lua fetches tiles asynchronously, caches them in memory (LRU) and SQLite (persistent). Tiles render as textured quads in the GL pipeline. Attribution string is forwarded to AttributionControl.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={TILELAYER_CODE} />
          </Half>
          <Half>
            <TileSourceDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── 4: MARKERS, POPUPS, TOOLTIPS ── */}
        <Band>
          <Half>
            <SectionLabel icon="map-pin">{'MARKERS · POPUPS · TOOLTIPS'}</SectionLabel>
            <S.StoryBody>
              {'Marker places a point at a lat/lng. Supports draggable (with dragend callback), custom icon, opacity, z-index offset, and click/contextmenu event handlers. Nest Popup and Tooltip as children.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Popup opens on click with configurable maxWidth, close button, auto-close behavior, and escape key handling. Tooltip shows on hover or permanently with direction control (top/bottom/left/right/auto) and sticky mode (follows cursor).'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MARKER_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="message-circle">{'POPUP & TOOLTIP PROPS'}</SectionLabel>
            <S.StoryBody>
              {'Popup and Tooltip both accept eventHandlers for open/close. Popup supports click-to-close and escape-to-close. Tooltip supports directional anchoring and sticky mode for following the cursor.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={POPUP_TOOLTIP_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: no browser ── */}
        <Box style={{
          backgroundColor: C.callout, borderLeftWidth: 3, borderColor: C.calloutBorder,
          paddingLeft: 25, paddingRight: 28, paddingTop: 14, paddingBottom: 14,
          flexDirection: 'row', gap: 8, alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'No Leaflet.js, no browser, no DOM. Lua implements tile fetching, Mercator math, vector rendering, hit testing, and the full event system natively. Tiles cache to SQLite for offline use. Every frame is pure OpenGL.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── 5: PATHOPTIONS ── */}
        <Band>
          <Half>
            <SectionLabel icon="pen-tool">{'PATHOPTIONS'}</SectionLabel>
            <S.StoryBody>
              {'The shared styling interface for all vector layers — Polyline, Polygon, Circle, CircleMarker, Rectangle, and FeatureGroup. Every vector component accepts pathOptions with the same 8 properties.'}
            </S.StoryBody>
            <S.StoryCap>
              {'fillColor defaults to color if not specified. dashArray takes a [dash, gap] array for dashed strokes. Set fill or stroke to false to disable that part entirely.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PATHOPTIONS_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'PathOptions reference'}</S.StoryCap>
              <CatalogList items={PATHOPTIONS_CATALOG} />
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── 6: POLYLINE ── */}
        <Band>
          <Half>
            <SectionLabel icon="trending-up">{'POLYLINE'}</SectionLabel>
            <S.StoryBody>
              {'Connected line segments for routes, paths, and tracks. Simple form takes a flat array of positions. Multi-polyline takes an array of arrays for separate, disconnected segments rendered as one component.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Supports eventHandlers.click for click detection on the line itself. Combine with Markers at waypoints for interactive route builders.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={POLYLINE_CODE} />
          </Half>
          <Half>
            <VectorLayersDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── 7: POLYGON ── */}
        <Band>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'Polygon nesting levels'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'LatLng[]', desc: 'Simple polygon — one closed ring', color: C.blue },
                  { label: 'LatLng[][]', desc: 'Polygon with holes — outer ring + inner cutouts', color: C.teal },
                  { label: 'LatLng[][][]', desc: 'Multi-polygon — separate polygons as one component', color: C.green },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 80, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
          <Half>
            <SectionLabel icon="hexagon">{'POLYGON'}</SectionLabel>
            <S.StoryBody>
              {'Closed shape for zones, boundaries, and regions. Three nesting levels: simple (flat array), with holes (array of rings — first is outer, rest are holes), and multi-polygon (array of polygons).'}
            </S.StoryBody>
            <S.StoryCap>
              {'The first ring is always the outer boundary. Subsequent rings at the same level are holes cut out of the polygon. Winding order doesn\'t matter — the renderer handles both CW and CCW.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={POLYGON_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── 8: CIRCLE vs CIRCLEMARKER ── */}
        <Band>
          <Half>
            <SectionLabel icon="circle">{'CIRCLE vs CIRCLEMARKER'}</SectionLabel>
            <S.StoryBody>
              {'Two circle components with a critical difference. Circle takes radius in meters — it grows and shrinks as you zoom, representing a real-world area. CircleMarker takes radius in pixels — it stays the same size at every zoom level, like a dot on a scatter plot.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Use Circle for geofences, blast radii, coverage areas. Use CircleMarker for fleet dots, sensor points, data markers. Both accept the same pathOptions and eventHandlers.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={CIRCLE_VS_MARKER_CODE} />
          </Half>
          <Half>
            <CircleCompareDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── 9: RECTANGLE ── */}
        <Band>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'Rectangle as bounding box'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                <S.StoryBreadcrumbActive>{'Rectangle takes bounds as [[sw], [ne]]'}</S.StoryBreadcrumbActive>
                <S.StoryCap>{'Or { southWest: {...}, northEast: {...} }'}</S.StoryCap>
                <S.StoryCap>{'Same bounds format used by MapContainer.maxBounds and useMap().fitBounds()'}</S.StoryCap>
              </Box>
            </S.StackG6W100>
          </Half>
          <Half>
            <SectionLabel icon="square">{'RECTANGLE'}</SectionLabel>
            <S.StoryBody>
              {'Axis-aligned bounding box overlay. Takes bounds as two corners (southwest and northeast) — the same format used for MapContainer.maxBounds, fitBounds, and downloadRegion. Accepts pathOptions for styling.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={RECTANGLE_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── 10: GEOJSON ── */}
        <Band>
          <Half>
            <SectionLabel icon="database">{'GEOJSON'}</SectionLabel>
            <S.StoryBody>
              {'Render any GeoJSON FeatureCollection. Supports Point (→ Marker), LineString (→ Polyline), Polygon, MultiPolygon. Per-feature styling via properties or a style function. Filter function to show/hide features. onEachFeature callback for per-feature setup.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Note: GeoJSON coordinates are [longitude, latitude] (reversed from LatLngTuple). The component handles this automatically — you write standard GeoJSON and it just works.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={GEOJSON_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'GeoJSON geometry types'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'Point', desc: 'Rendered as Marker', color: C.red },
                  { label: 'LineString', desc: 'Rendered as Polyline', color: C.route },
                  { label: 'Polygon', desc: 'Rendered as filled Polygon', color: C.zone },
                  { label: 'MultiPoint', desc: 'Multiple Markers', color: C.pink },
                  { label: 'MultiLineString', desc: 'Multi-polyline', color: C.peach },
                  { label: 'MultiPolygon', desc: 'Multiple Polygons', color: C.green },
                  { label: 'FeatureCollection', desc: 'Mix of all types', color: C.mauve },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 100, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>

              <S.StoryCap>{'GeoJSON props'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'data', desc: 'GeoJSON object (FeatureCollection or Feature)', color: C.blue },
                  { label: 'style', desc: 'PathOptions or (feature) => PathOptions', color: C.teal },
                  { label: 'filter', desc: '(feature) => boolean — hide features', color: C.green },
                  { label: 'onEachFeature', desc: '(feature, nodeId) => void', color: C.yellow },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 100, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── 11: IMAGEOVERLAY ── */}
        <Band>
          <Half>
            <SectionLabel icon="image">{'IMAGEOVERLAY'}</SectionLabel>
            <S.StoryBody>
              {'Stretch a raster image over geographic bounds. Use for historical maps, floor plans, radar imagery, heatmaps, or any image that needs to be pinned to real-world coordinates. Supports opacity and z-index.'}
            </S.StoryBody>
            <S.StoryCap>
              {'The image scales with zoom — it covers the exact geographic area defined by bounds. Combine with Pane for z-ordering between tiles and vectors.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={IMAGEOVERLAY_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'ImageOverlay use cases'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'Historical maps', desc: 'Overlay old cartography on modern tiles', color: C.peach },
                  { label: 'Floor plans', desc: 'Indoor mapping for buildings and campuses', color: C.blue },
                  { label: 'Radar imagery', desc: 'Weather radar, precipitation overlays', color: C.green },
                  { label: 'Heatmaps', desc: 'Pre-rendered density maps as images', color: C.red },
                  { label: 'Satellite patches', desc: 'High-res imagery for specific areas', color: C.teal },
                  { label: 'Game worlds', desc: 'Fantasy map textures over coordinate grids', color: C.mauve },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 110, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── 12: LAYER MANAGEMENT ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers">{'LAYER MANAGEMENT'}</SectionLabel>
            <S.StoryBody>
              {'Three components for organizing map layers. LayerGroup is a logical container with no styling. FeatureGroup adds shared pathOptions that cascade to all children. Pane controls z-index draw order.'}
            </S.StoryBody>
            <S.StoryCap>
              {'LayerGroup and FeatureGroup are used inside LayersControl.Overlay to create toggleable overlays. Pane is for fine-grained z-ordering — higher zIndex renders on top.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={LAYERGROUP_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="toggle-left">{'LAYERSCONTROL'}</SectionLabel>
            <S.StoryBody>
              {'Toggle between base layers (radio — only one active) and overlays (checkbox — multiple active). Use BaseLayer for tile source switching and Overlay for data layer toggling. Position and collapsed state are configurable.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={LAYERSCONTROL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── 13: EVENTS ── */}
        <Band>
          <Half>
            <SectionLabel icon="zap">{'MAP EVENTS'}</SectionLabel>
            <S.StoryBody>
              {'17 event types across mouse, zoom, move, drag, and UI categories. useMapEvent() subscribes to one event, useMapEvents() subscribes to many. Both return the MapHandle for chaining. Mouse events carry latlng and pixel coordinates.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Events fire in Lua and cross the bridge to React handlers. Subscriptions are automatically cleaned up on unmount. Individual vector layers also accept eventHandlers for per-layer click/contextmenu.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={EVENTS_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'Event catalog (17 events)'}</S.StoryCap>
              <CatalogList items={EVENT_CATALOG} />
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── 14: useMap IMPERATIVE ── */}
        <Band>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'useMap() method reference'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { method: 'panTo(latlng, opts?)', desc: 'Animate to center', color: C.blue },
                  { method: 'zoomTo(zoom, opts?)', desc: 'Animate to zoom level', color: C.teal },
                  { method: 'flyTo(opts)', desc: 'Animate center + zoom + bearing + pitch', color: C.green },
                  { method: 'fitBounds(bounds, opts?)', desc: 'Fit viewport to bounds', color: C.yellow },
                  { method: 'setPitch(deg)', desc: 'Camera tilt (0-60°)', color: C.mauve },
                  { method: 'setBearing(deg)', desc: 'Compass rotation', color: C.peach },
                  { method: 'getCenter()', desc: 'Returns [lat, lng]', color: C.red },
                  { method: 'getZoom()', desc: 'Returns zoom number', color: C.pink },
                  { method: 'getBounds()', desc: 'Returns [[sw], [ne]]', color: C.route },
                ].map(item => (
                  <S.RowG6 key={item.method} style={{ alignItems: 'start' }}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0, marginTop: 3 }} />
                    <Box style={{ gap: 1, flexShrink: 1 }}>
                      <Text style={{ fontSize: 9, color: item.color }}>{item.method}</Text>
                      <S.StoryTiny>{item.desc}</S.StoryTiny>
                    </Box>
                  </S.RowG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
          <Half>
            <SectionLabel icon="navigation">{'useMap()'}</SectionLabel>
            <S.StoryBody>
              {'Imperative handle to the nearest MapContainer. Pan, zoom, fly to locations, fit bounds, set pitch and bearing — all with optional animation. Same API as react-leaflet\'s useMap(). Must be called inside a MapContainer child.'}
            </S.StoryBody>
            <S.StoryCap>
              {'flyTo() is the most powerful — it animates center, zoom, bearing, and pitch simultaneously over a configurable duration. Each call is one bridge RPC to Lua. opts.animate defaults to true.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={USEMAP_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── 15: PITCH & BEARING ── */}
        <Band>
          <Half>
            <SectionLabel icon="rotate-cw">{'PITCH & BEARING'}</SectionLabel>
            <S.StoryBody>
              {'3D-like perspective on 2D maps. Pitch tilts the camera (0° = top-down, 60° = steep perspective). Bearing rotates the compass (0° = north up, 180° = south up, -90° = west up). Both can be set declaratively on MapContainer or imperatively via useMap().'}
            </S.StoryBody>
            <S.StoryCap>
              {'Pitch and bearing are tracked by useMapView() and animated by flyTo(). Vector layers, markers, and controls all render correctly under any pitch/bearing combination.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PITCH_BEARING_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'Pitch/Bearing reference'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 6 }}>
                {[
                  { label: 'pitch: 0', desc: 'Top-down (default)', color: C.blue },
                  { label: 'pitch: 30', desc: 'Slight tilt — shows depth', color: C.teal },
                  { label: 'pitch: 45', desc: 'Strong tilt — cityscape view', color: C.green },
                  { label: 'pitch: 60', desc: 'Maximum tilt — horizon visible', color: C.yellow },
                  { label: 'bearing: 0', desc: 'North up (default)', color: C.mauve },
                  { label: 'bearing: 90', desc: 'East up', color: C.peach },
                  { label: 'bearing: 180', desc: 'South up', color: C.red },
                  { label: 'bearing: -45', desc: 'Northeast up', color: C.pink },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 90, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── 16: useMapView ── */}
        <Band>
          <Half>
            <SectionLabel icon="eye">{'useMapView()'}</SectionLabel>
            <S.StoryBody>
              {'Reactive view state that updates on every pan, zoom, rotate, or tilt. Returns { center: [lat, lng], zoom, bearing, pitch }. Use for coordinate displays, HUD overlays, synchronized maps, or URL state encoding.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Subscribes to the bridge\'s map:viewchange event internally. Updates are debounced by Lua — you get one state update per frame, not per pixel of mouse movement.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={USEMAPVIEW_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'MapViewState shape'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'center: [lat, lng]', desc: 'Current map center as LatLngTuple', color: C.blue },
                  { label: 'zoom: number', desc: 'Current zoom level (2-18)', color: C.teal },
                  { label: 'bearing: number', desc: 'Compass rotation in degrees', color: C.green },
                  { label: 'pitch: number', desc: 'Camera tilt in degrees', color: C.yellow },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 120, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── 17: useProjection ── */}
        <Band>
          <Half>
            <ProjectionDemo />
          </Half>
          <Half>
            <SectionLabel icon="compass">{'useProjection()'}</SectionLabel>
            <S.StoryBody>
              {'Pure-math coordinate utilities. Convert between lat/lng and pixel coordinates at any zoom, or calculate great-circle distances. No bridge call — runs entirely in JS with Web Mercator (EPSG:3857).'}
            </S.StoryBody>
            <S.StoryCap>
              {'256px tile size. Latitude clamped to ±85.0511° (Mercator limit). distance() uses the Haversine formula — within 0.5% accuracy for any two points on Earth (spherical WGS84 approximation).'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PROJECTION_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── 18: DISTANCE ── */}
        <Band>
          <Half>
            <SectionLabel icon="ruler">{'DISTANCE'}</SectionLabel>
            <S.StoryBody>
              {'The distance() function returns meters. Common conversions: /1000 for km, /1609.344 for miles, /1852 for nautical miles. Uses Earth radius of 6,378,137m (WGS84 semi-major axis).'}
            </S.StoryBody>
          </Half>
          <Half>
            <DistanceDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── 19: useTileCache ── */}
        <Band>
          <Half>
            <SectionLabel icon="hard-drive">{'useTileCache()'}</SectionLabel>
            <S.StoryBody>
              {'Offline tile management. Download tile regions by bounds and zoom range — Lua fetches all tiles in the area and stores them in SQLite. Track progress with getProgress() (total, done, failed, percent, complete). Inspect cache with stats() (memory tiles, db tiles, db bytes, per-source counts).'}
            </S.StoryBody>
            <S.StoryCap>
              {'The cache is shared across all MapContainers. Lookup order: memory LRU → SQLite → network. Online maps use the cache automatically with no extra config. Offline mode works seamlessly if tiles are pre-downloaded.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={TILECACHE_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'Cache architecture'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'Memory LRU', desc: 'Fast access, limited size, cleared on exit', color: C.blue },
                  { label: 'SQLite DB', desc: 'Persistent, unlimited, survives restarts', color: C.teal },
                  { label: 'Network fetch', desc: 'Fallback when not cached, auto-populates both layers', color: C.green },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 100, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>

              <S.StoryCap>{'DownloadProgress shape'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'total: number', desc: 'Total tiles to download', color: C.yellow },
                  { label: 'done: number', desc: 'Successfully downloaded', color: C.green },
                  { label: 'failed: number', desc: 'Failed downloads', color: C.red },
                  { label: 'percent: number', desc: '0-100 progress', color: C.mauve },
                  { label: 'cancelled: boolean', desc: 'Download was cancelled', color: C.peach },
                  { label: 'complete: boolean', desc: 'All tiles done', color: C.teal },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 120, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── 20: CONTROLS ── */}
        <Band>
          <Half>
            <SectionLabel icon="sliders">{'MAP CONTROLS'}</SectionLabel>
            <S.StoryBody>
              {'Four built-in control components. ZoomControl adds +/- buttons with customizable text. ScaleControl shows a distance bar in metric and/or imperial units. AttributionControl displays data source credits. All positioned with topleft/topright/bottomleft/bottomright.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={CONTROLS_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'Control positions'}</S.StoryCap>
              <CatalogList items={CONTROL_POSITIONS} />

              <S.StoryCap>{'Control components'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'ZoomControl', desc: 'position, zoomInText, zoomOutText', color: C.blue },
                  { label: 'ScaleControl', desc: 'position, maxWidth, metric, imperial', color: C.teal },
                  { label: 'AttributionControl', desc: 'position, prefix', color: C.green },
                  { label: 'LayersControl', desc: 'position, collapsed + BaseLayer/Overlay children', color: C.yellow },
                ].map(item => (
                  <S.RowCenterG6 key={item.label}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 9, color: item.color, width: 120, flexShrink: 0 }}>{item.label}</Text>
                    <S.StoryTiny>{item.desc}</S.StoryTiny>
                  </S.RowCenterG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── 21: LATLNG FORMATS ── */}
        <Band>
          <Half>
            <SectionLabel icon="crosshair">{'COORDINATE FORMATS'}</SectionLabel>
            <S.StoryBody>
              {'Two interchangeable formats for specifying coordinates. Tuple form [lat, lng] is most common. Object form { lat, lng } matches react-leaflet. Both work everywhere — positions, centers, bounds. The components normalize internally.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Bounds accept either array form [[sw], [ne]] or object form { southWest, northEast }. Same flexibility, same normalization.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={LATLNG_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>{'Type definitions'}</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 8, gap: 4 }}>
                {[
                  { label: 'LatLngTuple', desc: '[number, number] — [lat, lng]', color: C.blue },
                  { label: 'LatLngLiteral', desc: '{ lat: number, lng: number }', color: C.teal },
                  { label: 'LatLngExpression', desc: 'LatLngTuple | LatLngLiteral', color: C.green },
                  { label: 'LatLngBoundsExpression', desc: '[LatLngExpr, LatLngExpr] | { southWest, northEast }', color: C.yellow },
                  { label: 'ControlPosition', desc: 'topleft | topright | bottomleft | bottomright', color: C.mauve },
                ].map(item => (
                  <S.RowG6 key={item.label} style={{ alignItems: 'start' }}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0, marginTop: 3 }} />
                    <Box style={{ gap: 1, flexShrink: 1 }}>
                      <Text style={{ fontSize: 9, color: item.color }}>{item.label}</Text>
                      <S.StoryTiny>{item.desc}</S.StoryTiny>
                    </Box>
                  </S.RowG6>
                ))}
              </Box>
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── Component Catalog (full width) ── */}
        <S.StoryFullBand>
          <SectionLabel icon="layers">{'COMPONENT CATALOG'}</SectionLabel>
          <S.StoryCap>{'All 18 components + 1 sub-component (LayersControl.BaseLayer/Overlay) in @reactjit/geo:'}</S.StoryCap>
          <CatalogList items={COMPONENT_CATALOG} />
        </S.StoryFullBand>

        <Divider />

        {/* ── Hook Catalog (full width) ── */}
        <S.StoryFullBand>
          <SectionLabel icon="code">{'HOOK CATALOG'}</SectionLabel>
          <S.StoryCap>{'All 6 hooks in @reactjit/geo:'}</S.StoryCap>
          <CatalogList items={HOOK_CATALOG} />
        </S.StoryFullBand>

        <Divider />

        {/* ── Final callout ── */}
        <Box style={{
          backgroundColor: C.callout, borderLeftWidth: 3, borderColor: C.calloutBorder,
          paddingLeft: 25, paddingRight: 28, paddingTop: 14, paddingBottom: 14,
          flexDirection: 'row', gap: 8, alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Same API as react-leaflet, rendered by OpenGL at 60fps. 18 components, 6 hooks, 17 events, offline SQLite tile cache, pitch/bearing perspective, and the full vector/GeoJSON/control stack. No Leaflet.js dependency. No browser required.'}
          </S.StoryBody>
        </Box>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="globe" />
        <S.StoryBreadcrumbActive>{'Geo'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
