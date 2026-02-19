import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { Map, TileLayer, Marker, Polyline, Polygon, GeoJSON, useMapView } from '@ilovereact/geo';

function MapControls() {
  const view = useMapView();

  return (
    <Box style={{
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: '#000000cc',
      padding: 8,
      borderRadius: 6,
    }}>
      <Text fontSize={11} style={{ color: '#ffffff' }}>
        {`${view.center[0].toFixed(4)}, ${view.center[1].toFixed(4)}`}
      </Text>
      <Text fontSize={10} style={{ color: '#888888' }}>
        {`zoom ${view.zoom.toFixed(1)}  bearing ${view.bearing.toFixed(0)}  pitch ${view.pitch.toFixed(0)}`}
      </Text>
    </Box>
  );
}

// Sample GeoJSON buildings in central London (approximate footprints)
const londonBuildings = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-0.0876, 51.5045],
          [-0.0870, 51.5045],
          [-0.0870, 51.5040],
          [-0.0876, 51.5040],
          [-0.0876, 51.5045],
        ]],
      },
      properties: { name: 'Building A', fillColor: '#2980b9cc', strokeColor: '#1a5276', extrude: 80 },
    },
    {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-0.0862, 51.5048],
          [-0.0855, 51.5048],
          [-0.0855, 51.5042],
          [-0.0862, 51.5042],
          [-0.0862, 51.5048],
        ]],
      },
      properties: { name: 'Building B', fillColor: '#e74c3ccc', strokeColor: '#922b21', extrude: 120 },
    },
    {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-0.0845, 51.5043],
          [-0.0838, 51.5043],
          [-0.0840, 51.5038],
          [-0.0843, 51.5036],
          [-0.0847, 51.5038],
          [-0.0845, 51.5043],
        ]],
      },
      properties: { name: 'Tower C', fillColor: '#27ae60cc', strokeColor: '#1e8449', extrude: 200 },
    },
    {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-0.0900, 51.5035],
          [-0.0890, 51.5035],
          [-0.0890, 51.5028],
          [-0.0900, 51.5028],
          [-0.0900, 51.5035],
        ]],
      },
      properties: { name: 'Block D', fillColor: '#8e44adcc', strokeColor: '#6c3483', extrude: 50 },
    },
    // A flat polygon (no extrusion) — park area
    {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-0.0920, 51.5050],
          [-0.0905, 51.5050],
          [-0.0905, 51.5042],
          [-0.0920, 51.5042],
          [-0.0920, 51.5050],
        ]],
      },
      properties: { name: 'Park', fillColor: '#27ae6040', strokeColor: '#27ae60', strokeWidth: 2, extrude: 0 },
    },
  ],
};

export function MapBasicStory() {
  const [markers] = useState([
    { id: 1, position: [51.505, -0.09] as [number, number], label: 'London' },
    { id: 2, position: [48.8566, 2.3522] as [number, number], label: 'Paris' },
    { id: 3, position: [52.52, 13.405] as [number, number], label: 'Berlin' },
  ]);

  const routePositions: [number, number][] = [
    [51.505, -0.09],
    [50.85, 0.58],
    [49.44, 1.09],
    [48.8566, 2.3522],
  ];

  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [pitch, setPitch] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [showBuildings, setShowBuildings] = useState(true);

  // Memoize GeoJSON data to avoid unnecessary rerenders
  const buildingData = useMemo(() => showBuildings ? londonBuildings : null, [showBuildings]);

  const handleViewChange = useCallback((event: any) => {
    // View changes from pan/zoom are handled reactively via useMapView
  }, []);

  const pitchPresets = [
    { label: 'Flat', value: 0 },
    { label: '30', value: 30 },
    { label: '45', value: 45 },
    { label: '60', value: 60 },
  ];

  const bearingPresets = [
    { label: 'N', value: 0 },
    { label: 'E', value: 90 },
    { label: 'S', value: 180 },
    { label: 'W', value: 270 },
  ];

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      {/* Header */}
      <Box style={{
        height: 48,
        backgroundColor: '#1a1a2e',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
        justifyContent: 'space-between',
        width: '100%',
      }}>
        <Text fontSize={16} style={{ color: '#e0e0e0', fontWeight: 'bold' }}>
          Map Demo
        </Text>
        <Text fontSize={12} style={{ color: '#888888' }}>
          {selectedCity ? `Selected: ${selectedCity}` : 'Pitch > 0 for 3D buildings'}
        </Text>
      </Box>

      {/* Map */}
      <Box style={{ flexGrow: 1, width: '100%' }}>
        <Map
          center={[50.0, 2.0]}
          zoom={5}
          pitch={pitch}
          bearing={bearing}
          style={{ width: '100%', height: '100%' }}
          onViewChange={handleViewChange}
        >
          <TileLayer source="osm" />

          {markers.map(m => (
            <Marker
              key={m.id}
              position={m.position}
              anchor="bottom-center"
            />
          ))}

          <Polyline
            positions={routePositions}
            color="#e74c3c"
            width={3}
            arrowheads
          />

          <Polygon
            positions={[
              [51.52, -0.12],
              [51.52, -0.06],
              [51.49, -0.06],
              [51.49, -0.12],
            ]}
            fillColor="#3498db30"
            strokeColor="#3498db"
            strokeWidth={2}
          />

          {buildingData && <GeoJSON data={buildingData} />}
        </Map>

        <MapControls />
      </Box>

      {/* Controls bar */}
      <Box style={{
        height: 44,
        backgroundColor: '#16213e',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        paddingRight: 12,
        width: '100%',
      }}>
        {/* City selectors */}
        {markers.map(m => (
          <Pressable
            key={m.id}
            onClick={() => setSelectedCity(m.label)}
            style={{
              backgroundColor: selectedCity === m.label ? '#3498db' : '#2a2a4a',
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: 4,
            }}
          >
            <Text fontSize={11} style={{ color: '#ffffff' }}>
              {m.label}
            </Text>
          </Pressable>
        ))}

        {/* Separator */}
        <Box style={{ width: 1, height: 24, backgroundColor: '#333355' }} />

        {/* Pitch controls */}
        <Text fontSize={10} style={{ color: '#666688' }}>Pitch:</Text>
        {pitchPresets.map(p => (
          <Pressable
            key={p.label}
            onClick={() => setPitch(p.value)}
            style={{
              backgroundColor: pitch === p.value ? '#e67e22' : '#2a2a4a',
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 3,
            }}
          >
            <Text fontSize={10} style={{ color: '#ffffff' }}>
              {p.label}
            </Text>
          </Pressable>
        ))}

        {/* Separator */}
        <Box style={{ width: 1, height: 24, backgroundColor: '#333355' }} />

        {/* Bearing controls */}
        <Text fontSize={10} style={{ color: '#666688' }}>Bearing:</Text>
        {bearingPresets.map(b => (
          <Pressable
            key={b.label}
            onClick={() => setBearing(b.value)}
            style={{
              backgroundColor: bearing === b.value ? '#27ae60' : '#2a2a4a',
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 3,
            }}
          >
            <Text fontSize={10} style={{ color: '#ffffff' }}>
              {b.label}
            </Text>
          </Pressable>
        ))}

        {/* Separator */}
        <Box style={{ width: 1, height: 24, backgroundColor: '#333355' }} />

        {/* Buildings toggle */}
        <Pressable
          onClick={() => setShowBuildings(!showBuildings)}
          style={{
            backgroundColor: showBuildings ? '#f39c12' : '#2a2a4a',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 3,
          }}
        >
          <Text fontSize={10} style={{ color: '#ffffff' }}>
            {showBuildings ? '3D ON' : '3D OFF'}
          </Text>
        </Pressable>
      </Box>
    </Box>
  );
}
