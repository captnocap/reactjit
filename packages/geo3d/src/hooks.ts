import { useState, useEffect, useCallback } from 'react';
import { useBridge } from '@reactjit/core';
import type { LatLngTuple } from '@reactjit/geo';

/** Camera state returned by useGeoCamera */
export interface GeoCameraState {
  /** Camera position in lat/lng */
  position: LatLngTuple;
  /** Camera altitude in meters */
  altitude: number;
  /** Camera heading in degrees (0 = north) */
  heading: number;
  /** Camera pitch in degrees */
  pitch: number;
}

/** Reactive camera state for the nearest GeoScene */
export function useGeoCamera(): GeoCameraState {
  const [state, setState] = useState<GeoCameraState>({
    position: [0, 0],
    altitude: 50,
    heading: 0,
    pitch: -15,
  });

  const bridge = useBridge();

  useEffect(() => {
    if (!bridge) return;
    const unsub = bridge.subscribe('geoscene:camera', (event: any) => {
      setState({
        position: event.position || [0, 0],
        altitude: event.altitude ?? 50,
        heading: event.heading ?? 0,
        pitch: event.pitch ?? -15,
      });
    });
    return unsub;
  }, [bridge]);

  return state;
}

/** Hook to get terrain height at a given lat/lng (async) */
export function useTerrainHeight() {
  const bridge = useBridge();

  const getHeight = useCallback(
    async (lat: number, lng: number): Promise<number> => {
      if (!bridge) return 0;
      const result = await bridge.rpc('geoscene:terrainHeight', { lat, lng });
      return (result as any)?.height ?? 0;
    },
    [bridge],
  );

  return { getHeight };
}
