// @reactjit/geo — Type definitions for the mapping system

export type LatLng = [number, number]; // [latitude, longitude]

export type TileSourceType = 'raster' | 'vector';

export type MarkerAnchor =
  | 'center'
  | 'top-center'
  | 'bottom-center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface MapViewState {
  center: LatLng;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface MapBounds {
  sw: LatLng;
  ne: LatLng;
}

export interface MapClickEvent {
  latlng: LatLng;
  pixel: [number, number];
}

export interface MapViewChangeEvent extends MapViewState {}

export interface MapProps {
  center?: LatLng;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  minZoom?: number;
  maxZoom?: number;
  projection?: string;
  style?: Record<string, any>;
  onViewChange?: (event: MapViewChangeEvent) => void;
  onClick?: (event: MapClickEvent) => void;
  onLongPress?: (event: MapClickEvent) => void;
  children?: React.ReactNode;
}

export interface TileLayerProps {
  source?: string;
  urlTemplate?: string;
  type?: TileSourceType;
  minZoom?: number;
  maxZoom?: number;
  tileSize?: number;
  opacity?: number;
  attribution?: string;
  headers?: Record<string, string>;
}

export interface MarkerProps {
  position: LatLng;
  anchor?: MarkerAnchor;
  draggable?: boolean;
  onDragEnd?: (event: { latlng: LatLng }) => void;
  onClick?: () => void;
  children?: React.ReactNode;
}

export interface PolylineProps {
  positions: LatLng[];
  color?: string;
  width?: number;
  dashArray?: number[];
  animated?: boolean;
  arrowheads?: boolean;
}

export interface PolygonProps {
  positions: LatLng[];
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  extrude?: number;
}

export interface GeoJSONFeatureStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  extrude?: number;
}

export interface GeoJSONProps {
  data: any; // GeoJSON FeatureCollection or Feature
  style?: (feature: any) => GeoJSONFeatureStyle;
  onFeatureClick?: (feature: any) => void;
}

export interface FlyToOptions {
  center?: LatLng;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  duration?: number;
  animate?: boolean;
}

export interface MapHandle {
  panTo: (latlng: LatLng, opts?: { animate?: boolean; duration?: number }) => void;
  zoomTo: (zoom: number, opts?: { animate?: boolean; duration?: number }) => void;
  fitBounds: (bounds: [LatLng, LatLng], opts?: { animate?: boolean }) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
  flyTo: (opts: FlyToOptions) => void;
}

export interface DownloadRegionOptions {
  source?: string;
  minZoom?: number;
  maxZoom?: number;
}

export interface DownloadProgress {
  total: number;
  done: number;
  failed: number;
  percent: number;
  cancelled: boolean;
  complete: boolean;
}

export interface CacheStats {
  memoryTiles: number;
  dbTiles: number;
  dbBytes: number;
  sources: Record<string, number>;
}

export interface TileCacheHandle {
  downloadRegion: (bounds: MapBounds, opts?: DownloadRegionOptions) => Promise<string>;
  getProgress: (regionId: string) => Promise<DownloadProgress | null>;
  stats: () => Promise<CacheStats>;
}
