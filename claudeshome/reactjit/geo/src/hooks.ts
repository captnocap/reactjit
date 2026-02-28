import { useState, useEffect, useCallback, useRef, useContext, createContext } from 'react';
import { useBridge } from '@reactjit/core';
import type {
  LatLng,
  MapViewState,
  MapHandle,
  MapBounds,
  FlyToOptions,
  TileCacheHandle,
  DownloadProgress,
  DownloadRegionOptions,
  CacheStats,
} from './types';

// ============================================================================
// Map context (set by <Map>, consumed by useMap)
// ============================================================================

export const MapContext = createContext<{ nodeId: number | null }>({ nodeId: null });

// ============================================================================
// useMap — imperative map control
// ============================================================================

/**
 * Returns a handle to control the nearest parent <Map> imperatively.
 *
 * ```tsx
 * const map = useMap();
 * map.panTo([51.5, -0.09], { animate: true });
 * map.flyTo({ center: [51.5, -0.09], zoom: 15, pitch: 45 });
 * ```
 */
export function useMap(): MapHandle {
  const bridge = useBridge();
  const { nodeId } = useContext(MapContext);

  const panTo = useCallback(
    (latlng: LatLng, opts?: { animate?: boolean; duration?: number }) => {
      if (!bridge || nodeId == null) return;
      bridge.rpc('map:panTo', {
        nodeId,
        lat: latlng[0],
        lng: latlng[1],
        animate: opts?.animate,
        duration: opts?.duration,
      });
    },
    [bridge, nodeId],
  );

  const zoomTo = useCallback(
    (zoom: number, opts?: { animate?: boolean; duration?: number }) => {
      if (!bridge || nodeId == null) return;
      bridge.rpc('map:zoomTo', {
        nodeId,
        zoom,
        animate: opts?.animate ?? true,
        duration: opts?.duration,
      });
    },
    [bridge, nodeId],
  );

  const fitBounds = useCallback(
    (bounds: [LatLng, LatLng], opts?: { animate?: boolean }) => {
      if (!bridge || nodeId == null) return;
      bridge.rpc('map:fitBounds', {
        nodeId,
        bounds: [bounds[0], bounds[1]],
        animate: opts?.animate,
      });
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
        center: opts.center,
        zoom: opts.zoom,
        bearing: opts.bearing,
        pitch: opts.pitch,
        duration: opts.duration ?? 2000,
      });
    },
    [bridge, nodeId],
  );

  return { panTo, zoomTo, fitBounds, setPitch, setBearing, flyTo };
}

// ============================================================================
// useMapView — reactive view state
// ============================================================================

/**
 * Returns the current view state of the nearest parent <Map>.
 * Updates reactively when the user pans, zooms, or tilts.
 *
 * ```tsx
 * const { center, zoom, bearing, pitch } = useMapView();
 * ```
 */
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

/**
 * Returns a handle to manage the tile cache (download regions, check stats).
 *
 * ```tsx
 * const cache = useTileCache();
 * const regionId = await cache.downloadRegion(bounds, { minZoom: 10, maxZoom: 16 });
 * const stats = await cache.stats();
 * ```
 */
export function useTileCache(): TileCacheHandle {
  const bridge = useBridge();
  const { nodeId } = useContext(MapContext);

  const downloadRegion = useCallback(
    async (bounds: MapBounds, opts?: DownloadRegionOptions): Promise<string> => {
      if (!bridge) return '';
      const result = await bridge.rpc('map:downloadRegion', {
        nodeId,
        source: opts?.source || 'osm',
        swLat: bounds.sw[0],
        swLng: bounds.sw[1],
        neLat: bounds.ne[0],
        neLng: bounds.ne[1],
        minZoom: opts?.minZoom ?? 0,
        maxZoom: opts?.maxZoom ?? 15,
      });
      return (result as any)?.regionId || '';
    },
    [bridge, nodeId],
  );

  const getProgress = useCallback(
    async (regionId: string): Promise<DownloadProgress | null> => {
      if (!bridge) return null;
      const result = await bridge.rpc('map:downloadProgress', { regionId });
      return result as DownloadProgress | null;
    },
    [bridge],
  );

  const stats = useCallback(async (): Promise<CacheStats> => {
    if (!bridge)
      return { memoryTiles: 0, dbTiles: 0, dbBytes: 0, sources: {} };
    const result = await bridge.rpc('map:cacheStats', {});
    return result as CacheStats;
  }, [bridge]);

  return { downloadRegion, getProgress, stats };
}

// ============================================================================
// useProjection — coordinate utilities
// ============================================================================

/**
 * Pure math projection utilities — no bridge dependency.
 * Web Mercator (EPSG:3857) projection for lat/lng ↔ pixel conversion.
 */
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
