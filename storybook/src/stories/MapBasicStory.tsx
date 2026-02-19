import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { Map, TileLayer, Marker, Polyline, Polygon, useMapView } from '@ilovereact/geo';

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

export function MapBasicStory() {
  const [markers, setMarkers] = useState([
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

  const handleViewChange = useCallback((event: any) => {
    // View changes from pan/zoom are handled reactively via useMapView
  }, []);

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
          {selectedCity ? `Selected: ${selectedCity}` : 'Click a marker'}
        </Text>
      </Box>

      {/* Map */}
      <Box style={{ flexGrow: 1, width: '100%' }}>
        <Map
          center={[50.0, 2.0]}
          zoom={5}
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
        </Map>

        <MapControls />
      </Box>

      {/* City buttons */}
      <Box style={{
        height: 44,
        backgroundColor: '#16213e',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 12,
        width: '100%',
      }}>
        {markers.map(m => (
          <Pressable
            key={m.id}
            onClick={() => setSelectedCity(m.label)}
            style={{
              backgroundColor: selectedCity === m.label ? '#3498db' : '#2a2a4a',
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 4,
            }}
          >
            <Text fontSize={12} style={{ color: '#ffffff' }}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </Box>
    </Box>
  );
}
