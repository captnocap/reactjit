import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { useBridge } from '@reactjit/core';
import type {
  LatLngExpression,
  LatLngTuple,
  LatLngBoundsExpression,
  MapViewState,
  MapHandle,
  FlyToOptions,
  TileCacheHandle,
  DownloadProgress,
  DownloadRegionOptions,
  CacheStats,
  MapEventHandlerFnMap,
} from './types';

// ============================================================================
// Context (set by MapContainer, consumed by hooks)
// ============================================================================

export const MapContext = createContext<{ nodeId: number | null }>({ nodeId: null });

// ============================================================================
// Helpers
// ============================================================================

const toTuple = (ll: LatLngExpression): LatLngTuple =>
  Array.isArray(ll) ? ll : [ll.lat, ll.lng];

const boundsToArgs = (b: LatLngBoundsExpression) => {
  if (Array.isArray(b)) return [toTuple(b[0]), toTuple(b[1])];
  return [toTuple(b.southWest), toTuple(b.northEast)];
};

// ============================================================================
// useMap — returns imperative handle to the nearest MapContainer
// ============================================================================

export function useMap(): MapHandle {
  const bridge = useBridge();
  const { nodeId } = useContext(MapContext);

  const panTo = useCallback(
    (latlng: LatLngExpression, opts?: { animate?: boolean; duration?: number }) => {
      if (!bridge || nodeId == null) return;
      const [lat, lng] = toTuple(latlng);
      bridge.rpc('map:panTo', { nodeId, lat, lng, animate: opts?.animate, duration: opts?.duration });
    },
    [bridge, nodeId],
  );

  const zoomTo = useCallback(
    (zoom: number, opts?: { animate?: boolean; duration?: number }) => {
      if (!bridge || nodeId == null) return;
      bridge.rpc('map:zoomTo', { nodeId, zoom, animate: opts?.animate ?? true, duration: opts?.duration });
    },
    [bridge, nodeId],
  );

  const fitBounds = useCallback(
    (bounds: LatLngBoundsExpression, opts?: { animate?: boolean }) => {
      if (!bridge || nodeId == null) return;
      bridge.rpc('map:fitBounds', { nodeId, bounds: boundsToArgs(bounds), animate: opts?.animate });
    },
    [bridge, nodeId],
  );

  const setPitch = useCallback(
    (pitch: number) => {
      if (!bridge || nodeId == null) return;
      bridge.rpc('map:setPitch', { nodeId, pitch });
    },
    [bridge, nodeId],
  );

  const setBearing = useCallback(
    (bearing: number) => {
      if (!bridge || nodeId == null) return;
      bridge.rpc('map:setBearing', { nodeId, bearing });
    },
    [bridge, nodeId],
  );

  const flyTo = useCallback(
    (opts: FlyToOptions) => {
      if (!bridge || nodeId == null) return;
      bridge.rpc('map:flyTo', {
        nodeId,
        center: opts.center ? toTuple(opts.center) : undefined,
        zoom: opts.zoom,
        bearing: opts.bearing,
        pitch: opts.pitch,
        duration: opts.duration ?? 2000,
      });
    },
    [bridge, nodeId],
  );

  const getCenter = useCallback((): LatLngTuple => [0, 0], []);
  const getZoom = useCallback((): number => 0, []);
  const getBounds = useCallback((): LatLngBoundsExpression => [[0, 0], [0, 0]], []);

  return { panTo, zoomTo, fitBounds, setPitch, setBearing, flyTo, getCenter, getZoom, getBounds };
}

// ============================================================================
// useMapEvent — subscribe to a single map event (react-leaflet compatible)
// ============================================================================

export function useMapEvent<K extends keyof MapEventHandlerFnMap>(
  type: K,
  handler: NonNullable<MapEventHandlerFnMap[K]>,
): MapHandle {
  const map = useMap();
  const bridge = useBridge();

  useEffect(() => {
    if (!bridge) return;
    const unsub = bridge.subscribe(`map:${type}`, handler as any);
    return unsub;
  }, [bridge, type, handler]);

  return map;
}

// ============================================================================
// useMapEvents — subscribe to multiple map events (react-leaflet compatible)
// ============================================================================

export function useMapEvents(handlers: MapEventHandlerFnMap): MapHandle {
  const map = useMap();
  const bridge = useBridge();

  useEffect(() => {
    if (!bridge) return;
    const unsubs: (() => void)[] = [];
    for (const [event, handler] of Object.entries(handlers)) {
      if (handler) {
        unsubs.push(bridge.subscribe(`map:${event}`, handler as any));
      }
    }
    return () => unsubs.forEach(u => u());
  }, [bridge, handlers]);

  return map;
}

// ============================================================================
// useMapView — reactive view state
// ============================================================================

export function useMapView(): MapViewState {
  const bridge = useBridge();
  const [view, setView] = useState<MapViewState>({
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
  });

  useEffect(() => {
    if (!bridge) return;
    const unsub = bridge.subscribe('map:viewchange', (event: any) => {
      setView({
        center: event.center || [0, 0],
        zoom: event.zoom ?? 2,
        bearing: event.bearing ?? 0,
        pitch: event.pitch ?? 0,
      });
    });
    return unsub;
  }, [bridge]);

  return view;
}

// ============================================================================
// useTileCache — offline tile management
// ============================================================================

export function useTileCache(): TileCacheHandle {
  const bridge = useBridge();

  const downloadRegion = useCallback(
    async (bounds: LatLngBoundsExpression, opts?: DownloadRegionOptions): Promise<string> => {
      if (!bridge) return '';
      const [sw, ne] = boundsToArgs(bounds);
      const result = await bridge.rpc('map:downloadRegion', {
        source: opts?.source || '',
        swLat: sw[0], swLng: sw[1],
        neLat: ne[0], neLng: ne[1],
        minZoom: opts?.minZoom ?? 0,
        maxZoom: opts?.maxZoom ?? 15,
      });
      return (result as any)?.regionId || '';
    },
    [bridge],
  );

  const getProgress = useCallback(
    async (regionId: string): Promise<DownloadProgress | null> => {
      if (!bridge) return null;
      return (await bridge.rpc('map:downloadProgress', { regionId })) as DownloadProgress | null;
    },
    [bridge],
  );

  const stats = useCallback(async (): Promise<CacheStats> => {
    if (!bridge) return { memoryTiles: 0, dbTiles: 0, dbBytes: 0, sources: {} };
    return (await bridge.rpc('map:cacheStats', {})) as CacheStats;
  }, [bridge]);

  return { downloadRegion, getProgress, stats };
}

// ============================================================================
// useProjection — pure math coordinate utilities
// ============================================================================

export function useProjection() {
  const TILE_SIZE = 256;
  const MAX_LAT = 85.0511287798;
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;

  const worldSize = (zoom: number) => TILE_SIZE * Math.pow(2, zoom);

  const latlngToPixel = useCallback(
    (lat: number, lng: number, zoom: number): [number, number] => {
      const ws = worldSize(zoom);
      const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
      const x = ((lng + 180) / 360) * ws;
      const sinLat = Math.sin(clampedLat * RAD);
      const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * ws;
      return [x, y];
    },
    [],
  );

  const pixelToLatlng = useCallback(
    (px: number, py: number, zoom: number): [number, number] => {
      const ws = worldSize(zoom);
      const lng = (px / ws) * 360 - 180;
      const n = Math.PI - (2 * Math.PI * py) / ws;
      const lat = DEG * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      return [lat, lng];
    },
    [],
  );

  const distance = useCallback(
    (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6378137;
      const dLat = (lat2 - lat1) * RAD;
      const dLng = (lng2 - lng1) * RAD;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },
    [],
  );

  return { latlngToPixel, pixelToLatlng, distance };
}
