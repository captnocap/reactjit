import React, { useCallback, useMemo, useState } from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { Map, TileLayer, Marker, Polyline, Polygon, GeoJSON, useProjection, type LatLng } from '@ilovereact/geo';

type MapPreset = {
  id: string;
  label: string;
  center: LatLng;
  zoom: number;
  pitch: number;
  bearing: number;
  route: LatLng[];
  zone: LatLng[];
};

type CameraState = {
  center: LatLng;
  zoom: number;
  pitch: number;
  bearing: number;
};

type Tone = {
  bg: string;
  fg: string;
};

const PRESETS: MapPreset[] = [
  {
    id: 'sf',
    label: 'San Francisco',
    center: [37.7749, -122.4194],
    zoom: 12.2,
    pitch: 0,
    bearing: 0,
    route: [
      [37.7938, -122.3965],
      [37.7842, -122.4072],
      [37.7751, -122.4193],
      [37.7664, -122.4335],
      [37.7582, -122.4471],
    ],
    zone: [
      [37.805, -122.462],
      [37.805, -122.379],
      [37.737, -122.379],
      [37.737, -122.462],
    ],
  },
  {
    id: 'tokyo',
    label: 'Tokyo',
    center: [35.6895, 139.6917],
    zoom: 11.8,
    pitch: 0,
    bearing: 0,
    route: [
      [35.7098, 139.7745],
      [35.7007, 139.7589],
      [35.6895, 139.6917],
      [35.6764, 139.6503],
      [35.6673, 139.7309],
    ],
    zone: [
      [35.736, 139.802],
      [35.736, 139.612],
      [35.632, 139.612],
      [35.632, 139.802],
    ],
  },
  {
    id: 'london',
    label: 'London',
    center: [51.5072, -0.1276],
    zoom: 11.7,
    pitch: 0,
    bearing: 0,
    route: [
      [51.5182, -0.0786],
      [51.5121, -0.0995],
      [51.5076, -0.1276],
      [51.5039, -0.1491],
      [51.4999, -0.1825],
    ],
    zone: [
      [51.536, -0.196],
      [51.536, -0.056],
      [51.471, -0.056],
      [51.471, -0.196],
    ],
  },
];

const tones: Record<string, Tone> = {
  blue: { bg: '#2543a780', fg: '#b5ceff' },
  green: { bg: '#1a7f4980', fg: '#a5f3c7' },
  amber: { bg: '#94620080', fg: '#ffe7a3' },
  red: { bg: '#93303680', fg: '#ffc8cc' },
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function wrapBearing(deg: number) {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function clonePoint(point: LatLng): LatLng {
  return [point[0], point[1]];
}

function cloneRoute(points: LatLng[]): LatLng[] {
  return points.map(clonePoint);
}

function estimateZoom(points: LatLng[]) {
  if (points.length <= 1) return 13;
  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    minLat = Math.min(minLat, p[0]);
    maxLat = Math.max(maxLat, p[0]);
    minLng = Math.min(minLng, p[1]);
    maxLng = Math.max(maxLng, p[1]);
  }
  const span = Math.max(maxLat - minLat, maxLng - minLng);
  if (span < 0.02) return 14.5;
  if (span < 0.045) return 13.4;
  if (span < 0.09) return 12.4;
  if (span < 0.22) return 11.2;
  if (span < 0.55) return 10.3;
  if (span < 1.2) return 9.2;
  return 8.2;
}

function makeFleet(center: LatLng, count: number) {
  const markers: { id: string; position: LatLng }[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const wave = 0.005 + (i % 4) * 0.002;
    const latOffset = Math.sin(angle) * (0.018 + wave);
    const lngOffset = Math.cos(angle * 1.1) * (0.026 + wave);
    markers.push({
      id: `fleet-${i}`,
      position: [center[0] + latOffset, center[1] + lngOffset],
    });
  }
  return markers;
}

function makeBuildings(center: LatLng) {
  const lat = center[0];
  const lng = center[1];
  const pads = [
    { dx: -0.018, dy: 0.013, w: 0.006, h: 0.004, c: '#22c55ecc', s: '#15803d', e: 120 },
    { dx: -0.008, dy: 0.015, w: 0.005, h: 0.0035, c: '#38bdf8cc', s: '#0369a1', e: 180 },
    { dx: 0.002, dy: 0.013, w: 0.004, h: 0.0038, c: '#f97316cc', s: '#c2410c', e: 220 },
    { dx: 0.009, dy: 0.010, w: 0.005, h: 0.0042, c: '#a78bfa99', s: '#6d28d9', e: 96 },
    { dx: -0.001, dy: 0.004, w: 0.008, h: 0.004, c: '#34d39955', s: '#059669', e: 0 },
  ];
  return {
    type: 'FeatureCollection' as const,
    features: pads.map((p, i) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [lng + p.dx, lat + p.dy],
          [lng + p.dx + p.w, lat + p.dy],
          [lng + p.dx + p.w, lat + p.dy - p.h],
          [lng + p.dx, lat + p.dy - p.h],
          [lng + p.dx, lat + p.dy],
        ]],
      },
      properties: {
        name: `Asset-${i + 1}`,
        fillColor: p.c,
        strokeColor: p.s,
        strokeWidth: 2,
        extrude: p.e,
      },
    })),
  };
}

function StatChip({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <Box
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 999,
        backgroundColor: tone.bg,
        borderWidth: 1,
        borderColor: '#ffffff20',
      }}
    >
      <Text fontSize={11} style={{ color: tone.fg, fontWeight: 'bold' }}>
        {`${label} ${value}`}
      </Text>
    </Box>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      style={{
        backgroundColor: '#0d1835',
        borderWidth: 1,
        borderColor: '#ffffff1a',
        borderRadius: 10,
        padding: 10,
        gap: 8,
      }}
    >
      <Box style={{ gap: 2 }}>
        <Text fontSize={12} style={{ color: '#e4edff', fontWeight: 'bold' }}>
          {title}
        </Text>
        {subtitle && (
          <Text fontSize={10} style={{ color: '#8ea0c8' }}>
            {subtitle}
          </Text>
        )}
      </Box>
      {children}
    </Box>
  );
}

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? '#1d4ed8' : '#1a2649',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: active ? '#60a5fa90' : '#ffffff20',
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
      }}
    >
      <Text fontSize={10} style={{ color: '#f8fbff' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MapBasicStory() {
  const firstPreset = PRESETS[0];
  const [presetId, setPresetId] = useState(firstPreset.id);
  const [tileSource, setTileSource] = useState<'osm' | 'osm-cycle'>('osm');
  const [showRoute, setShowRoute] = useState(true);
  const [showZone, setShowZone] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showFleet, setShowFleet] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [loopRoute, setLoopRoute] = useState(false);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const [view, setView] = useState<CameraState>({
    center: clonePoint(firstPreset.center),
    zoom: firstPreset.zoom,
    pitch: firstPreset.pitch,
    bearing: firstPreset.bearing,
  });
  const [waypoints, setWaypoints] = useState<LatLng[]>(() => cloneRoute(firstPreset.route));

  const { distance } = useProjection();

  const preset = useMemo(
    () => PRESETS.find((p) => p.id === presetId) ?? firstPreset,
    [presetId, firstPreset],
  );

  const renderedRoute = useMemo(() => {
    if (!loopRoute || waypoints.length < 3) return waypoints;
    return [...waypoints, clonePoint(waypoints[0])];
  }, [loopRoute, waypoints]);

  const routeDistanceKm = useMemo(() => {
    if (renderedRoute.length < 2) return 0;
    let meters = 0;
    for (let i = 1; i < renderedRoute.length; i += 1) {
      const a = renderedRoute[i - 1];
      const b = renderedRoute[i];
      meters += distance(a[0], a[1], b[0], b[1]);
    }
    return meters / 1000;
  }, [distance, renderedRoute]);

  const fleetMarkers = useMemo(() => makeFleet(preset.center, 16), [preset.center]);
  const buildingData = useMemo(() => makeBuildings(preset.center), [preset.center]);

  const handleViewChange = useCallback((event: any) => {
    setView((prev) => {
      const next: CameraState = { ...prev };
      if (Array.isArray(event?.center) && event.center.length >= 2) {
        const lat = Number(event.center[0]);
        const lng = Number(event.center[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          next.center = [lat, lng];
        }
      }
      if (typeof event?.zoom === 'number' && Number.isFinite(event.zoom)) {
        next.zoom = event.zoom;
      }
      if (typeof event?.bearing === 'number' && Number.isFinite(event.bearing)) {
        next.bearing = event.bearing;
      }
      if (typeof event?.pitch === 'number' && Number.isFinite(event.pitch)) {
        next.pitch = event.pitch;
      }
      return next;
    });
  }, []);

  const jumpToPreset = useCallback((nextId: string) => {
    const next = PRESETS.find((p) => p.id === nextId);
    if (!next) return;
    setPresetId(next.id);
    setSelectedStop(null);
    setWaypoints(cloneRoute(next.route));
    setView({
      center: clonePoint(next.center),
      zoom: next.zoom,
      pitch: next.pitch,
      bearing: next.bearing,
    });
  }, []);

  const rotate = useCallback((delta: number) => {
    setView((prev) => ({ ...prev, bearing: wrapBearing(prev.bearing + delta) }));
  }, []);

  const adjustPitch = useCallback((delta: number) => {
    setView((prev) => ({ ...prev, pitch: clamp(prev.pitch + delta, 0, 60) }));
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setView((prev) => ({ ...prev, zoom: clamp(prev.zoom + delta, 2, 18.8) }));
  }, []);

  const fitRoute = useCallback(() => {
    if (waypoints.length === 0) return;
    let minLat = waypoints[0][0];
    let maxLat = waypoints[0][0];
    let minLng = waypoints[0][1];
    let maxLng = waypoints[0][1];
    for (let i = 1; i < waypoints.length; i += 1) {
      const p = waypoints[i];
      minLat = Math.min(minLat, p[0]);
      maxLat = Math.max(maxLat, p[0]);
      minLng = Math.min(minLng, p[1]);
      maxLng = Math.max(maxLng, p[1]);
    }
    setView((prev) => ({
      ...prev,
      center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
      zoom: estimateZoom(waypoints),
    }));
  }, [waypoints]);

  const addStopAtCenter = useCallback(() => {
    const nextPoint: LatLng = [view.center[0], view.center[1]];
    setWaypoints((prev) => [...prev, nextPoint]);
    setSelectedStop(waypoints.length);
  }, [view.center, waypoints.length]);

  const trimRoute = useCallback(() => {
    setWaypoints((prev) => (prev.length > 2 ? prev.slice(0, prev.length - 1) : prev));
    setSelectedStop((prev) => {
      if (prev == null) return null;
      return Math.max(0, prev - 1);
    });
  }, []);

  const resetRoute = useCallback(() => {
    setWaypoints(cloneRoute(preset.route));
    setSelectedStop(null);
  }, [preset.route]);

  const nudgeStop = useCallback((index: number, latDelta: number, lngDelta: number) => {
    setWaypoints((prev) => prev.map((p, i) => (i === index ? [p[0] + latDelta, p[1] + lngDelta] : p)));
  }, []);

  const etaMinutes = Math.max(1, Math.round((routeDistanceKm / 33) * 60));
  const modeText = view.pitch > 2 ? '3D' : '2D';
  const primitiveCount =
    (showRoute ? 1 : 0) +
    (showZone ? 1 : 0) +
    (showBuildings ? 1 : 0) +
    (showStops ? renderedRoute.length : 0) +
    (showFleet ? fleetMarkers.length : 0);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#040d22' }}>
      <Box style={{ width: '100%', height: '100%', flexDirection: 'row', gap: 10, padding: 10 }}>
        <Box
          style={{
            width: 326,
            height: '100%',
            flexShrink: 0,
            gap: 8,
            backgroundColor: '#091430',
            borderWidth: 1,
            borderColor: '#ffffff22',
            borderRadius: 12,
            padding: 10,
          }}
        >
          <Box style={{ gap: 2 }}>
            <Text fontSize={16} style={{ color: '#eef4ff', fontWeight: 'bold' }}>
              Mission Map Console
            </Text>
            <Text fontSize={11} style={{ color: '#90a4cf' }}>
              Dispatch planning with route shaping, scene overlays, and 3D context.
            </Text>
          </Box>

          <Section title="Preset Cities" subtitle="Load different operating environments">
            <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {PRESETS.map((p) => (
                <ToggleButton
                  key={p.id}
                  label={p.label}
                  active={preset.id === p.id}
                  onPress={() => jumpToPreset(p.id)}
                />
              ))}
            </Box>
          </Section>

          <Section title="Layers" subtitle="Compose overlays and base map">
            <Box style={{ flexDirection: 'row', gap: 6 }}>
              <ToggleButton label="OSM" active={tileSource === 'osm'} onPress={() => setTileSource('osm')} />
              <ToggleButton
                label="Cycle"
                active={tileSource === 'osm-cycle'}
                onPress={() => setTileSource('osm-cycle')}
              />
            </Box>
            <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <ToggleButton label="Route" active={showRoute} onPress={() => setShowRoute((v) => !v)} />
              <ToggleButton label="Fleet" active={showFleet} onPress={() => setShowFleet((v) => !v)} />
              <ToggleButton label="Stops" active={showStops} onPress={() => setShowStops((v) => !v)} />
              <ToggleButton label="Zone" active={showZone} onPress={() => setShowZone((v) => !v)} />
              <ToggleButton label="Buildings" active={showBuildings} onPress={() => setShowBuildings((v) => !v)} />
              <ToggleButton label="Loop" active={loopRoute} onPress={() => setLoopRoute((v) => !v)} />
            </Box>
          </Section>

          <Section title="Camera" subtitle="Direct control without leaving the map">
            <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <ToggleButton label="Zoom +" active={false} onPress={() => adjustZoom(0.6)} />
              <ToggleButton label="Zoom -" active={false} onPress={() => adjustZoom(-0.6)} />
              <ToggleButton label="Pitch +" active={false} onPress={() => adjustPitch(8)} />
              <ToggleButton label="Pitch -" active={false} onPress={() => adjustPitch(-8)} />
              <ToggleButton label="Rotate L" active={false} onPress={() => rotate(-15)} />
              <ToggleButton label="Rotate R" active={false} onPress={() => rotate(15)} />
              <ToggleButton label="North Up" active={false} onPress={() => setView((prev) => ({ ...prev, bearing: 0 }))} />
              <ToggleButton label="Fit Route" active={false} onPress={fitRoute} />
            </Box>
          </Section>

          <Section title="Route Builder" subtitle="Seed and refine route geometry quickly">
            <Box style={{ flexDirection: 'row', gap: 6 }}>
              <ToggleButton label="Add Center" active={false} onPress={addStopAtCenter} />
              <ToggleButton label="Remove Last" active={false} onPress={trimRoute} />
              <ToggleButton label="Reset" active={false} onPress={resetRoute} />
            </Box>
            <Box style={{ gap: 4 }}>
              {waypoints.slice(0, 4).map((stop, i) => (
                <Box
                  key={`stop-${i}`}
                  style={{
                    backgroundColor: selectedStop === i ? '#2b3f75' : '#132247',
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#ffffff1f',
                    padding: 6,
                    gap: 4,
                  }}
                >
                  <Pressable onPress={() => setSelectedStop(i)}>
                    <Text fontSize={10} style={{ color: '#cddafd' }}>
                      {`Stop ${i + 1}  ${stop[0].toFixed(4)}, ${stop[1].toFixed(4)}`}
                    </Text>
                  </Pressable>
                  <Box style={{ flexDirection: 'row', gap: 4 }}>
                    <ToggleButton label="N" active={false} onPress={() => nudgeStop(i, 0.002, 0)} />
                    <ToggleButton label="S" active={false} onPress={() => nudgeStop(i, -0.002, 0)} />
                    <ToggleButton label="E" active={false} onPress={() => nudgeStop(i, 0, 0.002)} />
                    <ToggleButton label="W" active={false} onPress={() => nudgeStop(i, 0, -0.002)} />
                  </Box>
                </Box>
              ))}
              {waypoints.length > 4 && (
                <Text fontSize={10} style={{ color: '#8ea0c8' }}>
                  {`+${waypoints.length - 4} additional stops`}
                </Text>
              )}
            </Box>
          </Section>
        </Box>

        <Box
          style={{
            flexGrow: 1,
            height: '100%',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#ffffff24',
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: '#0a1531',
          }}
        >
          <Map
            center={view.center}
            zoom={view.zoom}
            pitch={view.pitch}
            bearing={view.bearing}
            minZoom={2}
            maxZoom={18.8}
            style={{ width: '100%', height: '100%' }}
            onViewChange={handleViewChange}
          >
            <TileLayer source={tileSource} />

            {showZone && (
              <Polygon
                positions={preset.zone}
                fillColor="#3b82f640"
                strokeColor="#60a5fa"
                strokeWidth={2}
              />
            )}

            {showRoute && (
              <Polyline
                positions={renderedRoute}
                color="#f97316"
                width={4}
                arrowheads
              />
            )}

            {showStops && renderedRoute.map((stop, i) => (
              <Marker key={`route-stop-${i}`} position={stop} anchor="bottom-center" />
            ))}

            {showFleet && fleetMarkers.map((m) => (
              <Marker key={m.id} position={m.position} anchor="center" />
            ))}

            {showBuildings && <GeoJSON data={buildingData} />}
          </Map>

          <Box
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              right: 10,
              backgroundColor: '#07132bcf',
              borderWidth: 1,
              borderColor: '#ffffff26',
              borderRadius: 10,
              padding: 10,
              gap: 8,
            }}
          >
            <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Text fontSize={22} style={{ color: '#eff6ff', fontWeight: 'bold' }}>
                  Geo Operations Workspace
                </Text>
                <Text fontSize={12} style={{ color: '#93a7d4' }}>
                  {`${preset.label} · ${tileSource === 'osm' ? 'Streets' : 'Cycle'} tiles · ${modeText} mode`}
                </Text>
              </Box>
              <Box style={{ alignItems: 'flex-end' }}>
                <Text fontSize={11} style={{ color: '#dce8ff' }}>
                  {`Center ${view.center[0].toFixed(4)}, ${view.center[1].toFixed(4)}`}
                </Text>
                <Text fontSize={10} style={{ color: '#97acd8' }}>
                  {`Zoom ${view.zoom.toFixed(2)} · Bearing ${Math.round(view.bearing)}° · Pitch ${Math.round(view.pitch)}°`}
                </Text>
              </Box>
            </Box>
            <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <StatChip label="Route" value={`${routeDistanceKm.toFixed(1)}km`} tone={tones.blue} />
              <StatChip label="ETA" value={`${etaMinutes}m`} tone={tones.green} />
              <StatChip label="Stops" value={`${waypoints.length}`} tone={tones.amber} />
              <StatChip label="Fleet" value={showFleet ? `${fleetMarkers.length}` : '0'} tone={tones.green} />
              <StatChip label="Primitives" value={`${primitiveCount}`} tone={tones.red} />
            </Box>
          </Box>

          <Box
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              width: 260,
              backgroundColor: '#06112abf',
              borderWidth: 1,
              borderColor: '#ffffff24',
              borderRadius: 8,
              padding: 8,
              gap: 4,
            }}
          >
            <Text fontSize={11} style={{ color: '#dbeafe', fontWeight: 'bold' }}>
              Operator Notes
            </Text>
            <Text fontSize={10} style={{ color: '#9eb4de' }}>
              Pan and zoom directly on the map. Use presets to switch cities, then use route controls to reshape paths in place.
            </Text>
            <Text fontSize={10} style={{ color: '#9eb4de' }}>
              Toggle loop mode to simulate patrol circuits and switch to cycle tiles for terrain-aware lane planning.
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
