import React, { useCallback, useMemo, useState } from 'react';
import { Box, Text, Pressable, ScrollView } from '@reactjit/core';
import { Map, TileLayer, Marker, Polyline, Polygon, GeoJSON, useProjection, type LatLng } from '@reactjit/geo';

type MapPreset = {
  id: string;
  label: string;
  center: LatLng;
  zoom: number;
  route: LatLng[];
  zone: LatLng[];
};

const PRESETS: MapPreset[] = [
  {
    id: 'sf',
    label: 'San Francisco',
    center: [37.7749, -122.4194],
    zoom: 12.2,
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

const C = {
  bg: '#040d22',
  panel: '#091430',
  panelBorder: '#ffffff22',
  sectionBg: '#0d1835',
  sectionBorder: '#ffffff1a',
  btnBg: '#1a2649',
  btnBgActive: '#1d4ed8',
  btnBorder: '#ffffff20',
  btnBorderActive: '#60a5fa90',
  textPrimary: '#eef4ff',
  textSecondary: '#90a4cf',
  textMuted: '#8ea0c8',
  accent: '#f97316',
  mapBorder: '#ffffff24',
  hudBg: '#07132bcf',
  hudBorder: '#ffffff26',
};

function makeFleet(center: LatLng, count: number) {
  const out: { id: string; position: LatLng }[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const wave = 0.005 + (i % 4) * 0.002;
    out.push({
      id: `fleet-${i}`,
      position: [
        center[0] + Math.sin(angle) * (0.018 + wave),
        center[1] + Math.cos(angle * 1.1) * (0.026 + wave),
      ],
    });
  }
  return out;
}

function makeBuildings(center: LatLng) {
  const [lat, lng] = center;
  const pads = [
    { dx: -0.018, dy: 0.013, w: 0.006, h: 0.004, fill: '#22c55ecc', stroke: '#15803d' },
    { dx: -0.008, dy: 0.015, w: 0.005, h: 0.0035, fill: '#38bdf8cc', stroke: '#0369a1' },
    { dx: 0.002, dy: 0.013, w: 0.004, h: 0.0038, fill: '#f97316cc', stroke: '#c2410c' },
    { dx: 0.009, dy: 0.010, w: 0.005, h: 0.0042, fill: '#a78bfa99', stroke: '#6d28d9' },
    { dx: -0.001, dy: 0.004, w: 0.008, h: 0.004, fill: '#34d39955', stroke: '#059669' },
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
        fillColor: p.fill,
        strokeColor: p.stroke,
        strokeWidth: 2,
      },
    })),
  };
}

function Btn({
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
        backgroundColor: active ? C.btnBgActive : C.btnBg,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: active ? C.btnBorderActive : C.btnBorder,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 6,
        paddingBottom: 6,
      }}
    >
      <Text style={{ fontSize: 11, color: C.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      style={{
        backgroundColor: C.sectionBg,
        borderWidth: 1,
        borderColor: C.sectionBorder,
        borderRadius: 10,
        padding: 10,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 11, color: C.textSecondary, fontWeight: 'bold' }}>{title}</Text>
      {children}
    </Box>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {children}
    </Box>
  );
}

export function MapBasicStory() {
  const first = PRESETS[0];
  const [presetId, setPresetId] = useState(first.id);
  const [tileSource, setTileSource] = useState<'osm' | 'osm-cycle'>('osm');
  const [showRoute, setShowRoute] = useState(true);
  const [showZone, setShowZone] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showFleet, setShowFleet] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [center, setCenter] = useState<LatLng>([...first.center]);
  const [zoom, setZoom] = useState(first.zoom);
  const [pitch, setPitch] = useState(0);
  const [bearing, setBearing] = useState(0);

  const { distance } = useProjection();

  const preset = useMemo(
    () => PRESETS.find((p) => p.id === presetId) ?? first,
    [presetId],
  );

  const fleetMarkers = useMemo(() => makeFleet(preset.center, 16), [preset.center]);
  const buildingData = useMemo(() => makeBuildings(preset.center), [preset.center]);

  const routeDistanceKm = useMemo(() => {
    const pts = preset.route;
    if (pts.length < 2) return 0;
    let m = 0;
    for (let i = 1; i < pts.length; i += 1) {
      m += distance(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    }
    return m / 1000;
  }, [distance, preset.route]);

  const handleViewChange = useCallback((event: any) => {
    if (Array.isArray(event?.center) && event.center.length >= 2) {
      const lat = Number(event.center[0]);
      const lng = Number(event.center[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) setCenter([lat, lng]);
    }
    if (typeof event?.zoom === 'number' && Number.isFinite(event.zoom)) setZoom(event.zoom);
    if (typeof event?.bearing === 'number' && Number.isFinite(event.bearing)) setBearing(event.bearing);
    if (typeof event?.pitch === 'number' && Number.isFinite(event.pitch)) setPitch(event.pitch);
  }, []);

  const jumpTo = useCallback((id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(p.id);
    setCenter([...p.center]);
    setZoom(p.zoom);
    setPitch(0);
    setBearing(0);
  }, []);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, flexDirection: 'row', gap: 10, padding: 10 }}>
      {/* Sidebar */}
      <Box
        style={{
          width: 230,
          flexShrink: 0,
          height: '100%',
          backgroundColor: C.panel,
          borderWidth: 1,
          borderColor: C.panelBorder,
          borderRadius: 12,
          padding: 10,
          gap: 8,
        }}
      >
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 15, color: C.textPrimary, fontWeight: 'bold' }}>Map</Text>
          <Text style={{ fontSize: 10, color: C.textSecondary }}>
            Tiles · Markers · Polylines · Polygons · GeoJSON
          </Text>
        </Box>

        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ gap: 8 }}>
            <SectionBox title="CITY">
              <Row>
                {PRESETS.map((p) => (
                  <Btn key={p.id} label={p.label} active={preset.id === p.id} onPress={() => jumpTo(p.id)} />
                ))}
              </Row>
            </SectionBox>

            <SectionBox title="BASE MAP">
              <Row>
                <Btn label="Streets" active={tileSource === 'osm'} onPress={() => setTileSource('osm')} />
                <Btn label="Cycle" active={tileSource === 'osm-cycle'} onPress={() => setTileSource('osm-cycle')} />
              </Row>
            </SectionBox>

            <SectionBox title="LAYERS">
              <Row>
                <Btn label="Route" active={showRoute} onPress={() => setShowRoute((v) => !v)} />
                <Btn label="Stops" active={showStops} onPress={() => setShowStops((v) => !v)} />
                <Btn label="Zone" active={showZone} onPress={() => setShowZone((v) => !v)} />
                <Btn label="Fleet" active={showFleet} onPress={() => setShowFleet((v) => !v)} />
                <Btn label="Assets" active={showBuildings} onPress={() => setShowBuildings((v) => !v)} />
              </Row>
            </SectionBox>

            <SectionBox title="CAMERA">
              <Row>
                <Btn label="Z+" active={false} onPress={() => setZoom((z) => clamp(z + 0.8, 2, 18.8))} />
                <Btn label="Z−" active={false} onPress={() => setZoom((z) => clamp(z - 0.8, 2, 18.8))} />
                <Btn label="P+" active={false} onPress={() => setPitch((p) => clamp(p + 8, 0, 60))} />
                <Btn label="P−" active={false} onPress={() => setPitch((p) => clamp(p - 8, 0, 60))} />
                <Btn label="◀" active={false} onPress={() => setBearing((b) => (b - 15 + 360) % 360)} />
                <Btn label="▶" active={false} onPress={() => setBearing((b) => (b + 15) % 360)} />
                <Btn label="N↑" active={false} onPress={() => setBearing(0)} />
              </Row>
            </SectionBox>

            <SectionBox title="STATS">
              <Box style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  {`Route  ${routeDistanceKm.toFixed(1)} km`}
                </Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  {`ETA  ~${Math.max(1, Math.round((routeDistanceKm / 33) * 60))} min`}
                </Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  {`Stops  ${preset.route.length}`}
                </Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  {`Fleet  ${showFleet ? fleetMarkers.length : 0}`}
                </Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  {`Mode  ${pitch > 2 ? '3D' : '2D'}`}
                </Text>
              </Box>
            </SectionBox>
          </Box>
        </ScrollView>
      </Box>

      {/* Map */}
      <Box
        style={{
          flexGrow: 1,
          height: '100%',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: C.mapBorder,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#0a1531',
        }}
      >
        <Map
          center={center}
          zoom={zoom}
          pitch={pitch}
          bearing={bearing}
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
              positions={preset.route}
              color={C.accent}
              width={4}
              arrowheads
            />
          )}

          {showStops && preset.route.map((stop, i) => (
            <Marker key={`stop-${i}`} position={stop} anchor="bottom-center" />
          ))}

          {showFleet && fleetMarkers.map((m) => (
            <Marker key={m.id} position={m.position} anchor="center" />
          ))}

          {showBuildings && <GeoJSON data={buildingData} />}
        </Map>

        {/* HUD */}
        <Box
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            backgroundColor: C.hudBg,
            borderWidth: 1,
            borderColor: C.hudBorder,
            borderRadius: 8,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 2,
          }}
        >
          <Text style={{ fontSize: 13, color: C.textPrimary, fontWeight: 'bold' }}>
            {`${preset.label} · ${tileSource === 'osm' ? 'Streets' : 'Cycle'}`}
          </Text>
          <Text style={{ fontSize: 10, color: C.textSecondary }}>
            {`${center[0].toFixed(4)}, ${center[1].toFixed(4)}  ·  z${zoom.toFixed(1)}  ·  ${Math.round(bearing)}°  ·  ${Math.round(pitch)}°p`}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
