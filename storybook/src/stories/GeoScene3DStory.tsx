import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text, Pressable, ScrollView } from '@reactjit/core';
import {
  GeoScene, TerrainLayer, BuildingLayer,
  GeoPath3D, GeoMarker3D, Sky,
} from '@reactjit/geo3d';
import type { LatLngTuple } from '@reactjit/geo';

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

type CityPreset = {
  id: string;
  label: string;
  center: LatLngTuple;
  zoom: number;
  route: LatLngTuple[];
  buildings: any;
  markers: { id: string; position: LatLngTuple; color: string }[];
};

const makeBuildings = (center: LatLngTuple): any => {
  const [lat, lng] = center;
  const pads = [
    { dx: -0.004, dy: 0.003, w: 0.002, h: 0.0015, height: 25, fill: '#667799' },
    { dx: -0.001, dy: 0.004, w: 0.0018, h: 0.0012, height: 40, fill: '#7788aa' },
    { dx: 0.001, dy: 0.003, w: 0.0015, h: 0.0018, height: 18, fill: '#8899bb' },
    { dx: 0.003, dy: 0.002, w: 0.002, h: 0.0014, height: 55, fill: '#5577aa' },
    { dx: -0.003, dy: -0.001, w: 0.003, h: 0.0016, height: 32, fill: '#6688aa' },
    { dx: 0.000, dy: -0.002, w: 0.0025, h: 0.002, height: 70, fill: '#4466aa' },
    { dx: 0.002, dy: -0.003, w: 0.0018, h: 0.0013, height: 22, fill: '#7799bb' },
    { dx: -0.002, dy: 0.001, w: 0.001, h: 0.001, height: 15, fill: '#99aabb' },
    { dx: 0.004, dy: 0.001, w: 0.0012, h: 0.0015, height: 45, fill: '#5588bb' },
    { dx: -0.001, dy: -0.004, w: 0.002, h: 0.001, height: 28, fill: '#6699aa' },
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
      properties: { name: `Building-${i + 1}`, height: p.height, fill: p.fill },
    })),
  };
};

const PRESETS: CityPreset[] = [
  {
    id: 'sf',
    label: 'San Francisco',
    center: [37.7749, -122.4194],
    zoom: 14,
    route: [
      [37.7938, -122.3965], [37.7842, -122.4072], [37.7751, -122.4193],
      [37.7664, -122.4335], [37.7582, -122.4471],
    ],
    buildings: makeBuildings([37.7749, -122.4194]),
    markers: [
      { id: 'm1', position: [37.7749, -122.4194], color: '#ef4444' },
      { id: 'm2', position: [37.7938, -122.3965], color: '#22c55e' },
      { id: 'm3', position: [37.7582, -122.4471], color: '#3b82f6' },
    ],
  },
  {
    id: 'tokyo',
    label: 'Tokyo',
    center: [35.6895, 139.6917],
    zoom: 14,
    route: [
      [35.7098, 139.7745], [35.7007, 139.7589], [35.6895, 139.6917],
      [35.6764, 139.6503], [35.6673, 139.7309],
    ],
    buildings: makeBuildings([35.6895, 139.6917]),
    markers: [
      { id: 'm1', position: [35.6895, 139.6917], color: '#ef4444' },
      { id: 'm2', position: [35.6762, 139.6503], color: '#f59e0b' },
    ],
  },
  {
    id: 'alps',
    label: 'Swiss Alps',
    center: [46.5615, 7.9719],
    zoom: 12,
    route: [
      [46.58, 7.94], [46.57, 7.96], [46.56, 7.97],
      [46.55, 7.98], [46.54, 8.00],
    ],
    buildings: { type: 'FeatureCollection', features: [] },
    markers: [
      { id: 'm1', position: [46.5615, 7.9719], color: '#ef4444' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tile sources
// ---------------------------------------------------------------------------

const ELEVATION_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const IMAGERY_URLS: Record<string, string> = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const C = {
  bg: '#0a0e1a',
  panel: '#0f1628',
  panelBorder: '#ffffff18',
  sectionBg: '#141d33',
  sectionBorder: '#ffffff12',
  btnBg: '#1a2649',
  btnBgActive: '#1d4ed8',
  btnBorder: '#ffffff18',
  btnBorderActive: '#60a5fa80',
  textPrimary: '#e8eeff',
  textSecondary: '#8ea0c8',
  textMuted: '#6b7fa8',
  accent: '#3b82f6',
  hudBg: '#0a1020e0',
  hudBorder: '#ffffff20',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Btn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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
        paddingTop: 5,
        paddingBottom: 5,
      }}
    >
      <Text style={{ fontSize: 11, color: C.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      style={{
        backgroundColor: C.sectionBg,
        borderWidth: 1,
        borderColor: C.sectionBorder,
        borderRadius: 8,
        padding: 8,
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 10, color: C.textMuted }}>{title}</Text>
      {children}
    </Box>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>{children}</Box>;
}

// ---------------------------------------------------------------------------
// Main Story
// ---------------------------------------------------------------------------

export function GeoScene3DStory() {
  const [presetId, setPresetId] = useState('sf');
  const [imagery, setImagery] = useState<'osm' | 'satellite'>('osm');
  const [showBuildings, setShowBuildings] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'fps'>('orbit');
  const [fogLevel, setFogLevel] = useState(0.0008);
  const [heightScale, setHeightScale] = useState(1.5);

  const preset = useMemo(
    () => PRESETS.find((p) => p.id === presetId) || PRESETS[0],
    [presetId],
  );

  const jumpTo = useCallback((id: string) => {
    setPresetId(id);
  }, []);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, flexDirection: 'row', gap: 8, padding: 8 }}>
      {/* Sidebar */}
      <Box
        style={{
          width: 210,
          flexShrink: 0,
          height: '100%',
          backgroundColor: C.panel,
          borderWidth: 1,
          borderColor: C.panelBorder,
          borderRadius: 10,
          padding: 8,
          gap: 6,
        }}
      >
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 14, color: C.textPrimary }}>GeoScene3D</Text>
          <Text style={{ fontSize: 9, color: C.textSecondary }}>3D terrain + buildings</Text>
        </Box>

        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ gap: 6 }}>
            <Section title="LOCATION">
              <Row>
                {PRESETS.map((p) => (
                  <Btn key={p.id} label={p.label} active={preset.id === p.id} onPress={() => jumpTo(p.id)} />
                ))}
              </Row>
            </Section>

            <Section title="IMAGERY">
              <Row>
                <Btn label="Streets" active={imagery === 'osm'} onPress={() => setImagery('osm')} />
                <Btn label="Satellite" active={imagery === 'satellite'} onPress={() => setImagery('satellite')} />
              </Row>
            </Section>

            <Section title="CAMERA">
              <Row>
                <Btn label="Orbit" active={cameraMode === 'orbit'} onPress={() => setCameraMode('orbit')} />
                <Btn label="FPS" active={cameraMode === 'fps'} onPress={() => setCameraMode('fps')} />
              </Row>
            </Section>

            <Section title="LAYERS">
              <Row>
                <Btn label="Buildings" active={showBuildings} onPress={() => setShowBuildings((v) => !v)} />
                <Btn label="Route" active={showRoute} onPress={() => setShowRoute((v) => !v)} />
                <Btn label="Markers" active={showMarkers} onPress={() => setShowMarkers((v) => !v)} />
              </Row>
            </Section>

            <Section title="ATMOSPHERE">
              <Row>
                <Btn label="Clear" active={fogLevel < 0.0005} onPress={() => setFogLevel(0.0002)} />
                <Btn label="Light Fog" active={fogLevel >= 0.0005 && fogLevel < 0.002} onPress={() => setFogLevel(0.0008)} />
                <Btn label="Heavy Fog" active={fogLevel >= 0.002} onPress={() => setFogLevel(0.003)} />
              </Row>
            </Section>

            <Section title="TERRAIN">
              <Row>
                <Btn label="Flat" active={heightScale < 0.5} onPress={() => setHeightScale(0)} />
                <Btn label="1x" active={heightScale >= 0.5 && heightScale < 2} onPress={() => setHeightScale(1)} />
                <Btn label="3x" active={heightScale >= 2 && heightScale < 4} onPress={() => setHeightScale(3)} />
                <Btn label="5x" active={heightScale >= 4} onPress={() => setHeightScale(5)} />
              </Row>
            </Section>

            <Section title="CONTROLS">
              <Box style={{ gap: 3 }}>
                <Text style={{ fontSize: 10, color: C.textMuted }}>Orbit: drag to rotate, scroll to zoom</Text>
                <Text style={{ fontSize: 10, color: C.textMuted }}>FPS: WASD + Space/Shift to move</Text>
              </Box>
            </Section>
          </Box>
        </ScrollView>
      </Box>

      {/* 3D Viewport */}
      <Box
        style={{
          flexGrow: 1,
          height: '100%',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#ffffff16',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <GeoScene
          center={preset.center}
          zoom={preset.zoom}
          cameraMode={cameraMode}
          style={{ width: '100%', height: '100%' }}
        >
          <TerrainLayer
            elevation={ELEVATION_URL}
            imagery={IMAGERY_URLS[imagery]}
            heightScale={heightScale}
            resolution={32}
          />

          {showBuildings && (
            <BuildingLayer data={preset.buildings} defaultHeight={15} />
          )}

          {showRoute && (
            <GeoPath3D positions={preset.route} width={4} color="#f97316" />
          )}

          {showMarkers && preset.markers.map((m) => (
            <GeoMarker3D key={m.id} position={m.position} color={m.color} scale={8} />
          ))}

          <Sky fog={fogLevel} fogColor="#b0c4de" backgroundColor="#6b8cbe" />
        </GeoScene>

        {/* HUD */}
        <Box
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: C.hudBg,
            borderWidth: 1,
            borderColor: C.hudBorder,
            borderRadius: 8,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            gap: 2,
          }}
        >
          <Text style={{ fontSize: 12, color: C.textPrimary }}>{preset.label}</Text>
          <Text style={{ fontSize: 9, color: C.textSecondary }}>
            {`${preset.center[0].toFixed(4)}, ${preset.center[1].toFixed(4)}  z${preset.zoom}`}
          </Text>
          <Text style={{ fontSize: 9, color: C.textMuted }}>
            {`${cameraMode.toUpperCase()} | height ${heightScale}x | fog ${fogLevel.toFixed(4)}`}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
