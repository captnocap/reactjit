// @reactjit/geo — Type definitions (react-leaflet compatible)

// -- Coordinate types ---------------------------------------------------

export type LatLngTuple = [number, number]; // [latitude, longitude]

export type LatLngLiteral = { lat: number; lng: number };

export type LatLngExpression = LatLngTuple | LatLngLiteral;

export type LatLngBoundsExpression =
  | [LatLngExpression, LatLngExpression]
  | { southWest: LatLngExpression; northEast: LatLngExpression };

// -- Control positions --------------------------------------------------

export type ControlPosition =
  | 'topleft'
  | 'topright'
  | 'bottomleft'
  | 'bottomright';

// -- Path options (shared by vector layers) -----------------------------

export interface PathOptions {
  color?: string;
  weight?: number;
  opacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  dashArray?: number[];
  fill?: boolean;
  stroke?: boolean;
}

// -- Event types --------------------------------------------------------

export interface LeafletMouseEvent {
  latlng: LatLngTuple;
  pixel: [number, number];
}

export interface MapViewState {
  center: LatLngTuple;
  zoom: number;
  bearing: number;
  pitch: number;
}

export type MapEventHandlerFnMap = {
  click?: (event: LeafletMouseEvent) => void;
  dblclick?: (event: LeafletMouseEvent) => void;
  mousedown?: (event: LeafletMouseEvent) => void;
  mouseup?: (event: LeafletMouseEvent) => void;
  mousemove?: (event: LeafletMouseEvent) => void;
  contextmenu?: (event: LeafletMouseEvent) => void;
  zoom?: () => void;
  zoomstart?: () => void;
  zoomend?: () => void;
  move?: () => void;
  movestart?: () => void;
  moveend?: () => void;
  drag?: () => void;
  dragstart?: () => void;
  dragend?: (event: { latlng: LatLngTuple }) => void;
  popupopen?: () => void;
  popupclose?: () => void;
  tooltipopen?: () => void;
  tooltipclose?: () => void;
};

// -- Component props ----------------------------------------------------

export interface MapContainerProps {
  center?: LatLngExpression;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: LatLngBoundsExpression;
  scrollWheelZoom?: boolean;
  dragging?: boolean;
  zoomControl?: boolean;
  doubleClickZoom?: boolean;
  attributionControl?: boolean;
  projection?: string;
  style?: Record<string, any>;
  whenReady?: () => void;
  children?: React.ReactNode;
}

export interface TileLayerProps {
  url: string;
  attribution?: string;
  maxZoom?: number;
  minZoom?: number;
  opacity?: number;
  tileSize?: number;
  zIndex?: number;
  subdomains?: string | string[];
  headers?: Record<string, string>;
  eventHandlers?: MapEventHandlerFnMap;
}

export interface MarkerProps {
  position: LatLngExpression;
  icon?: string;
  draggable?: boolean;
  opacity?: number;
  zIndexOffset?: number;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface PopupProps {
  position?: LatLngExpression;
  maxWidth?: number;
  minWidth?: number;
  closeButton?: boolean;
  autoClose?: boolean;
  closeOnClick?: boolean;
  closeOnEscapeKey?: boolean;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface TooltipProps {
  position?: LatLngExpression;
  direction?: 'right' | 'left' | 'top' | 'bottom' | 'center' | 'auto';
  permanent?: boolean;
  sticky?: boolean;
  opacity?: number;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface PolylineProps {
  positions: LatLngExpression[] | LatLngExpression[][];
  pathOptions?: PathOptions;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface PolygonProps {
  positions: LatLngExpression[] | LatLngExpression[][] | LatLngExpression[][][];
  pathOptions?: PathOptions;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface CircleProps {
  center: LatLngExpression;
  radius: number;
  pathOptions?: PathOptions;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface CircleMarkerProps {
  center: LatLngExpression;
  radius?: number;
  pathOptions?: PathOptions;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface RectangleProps {
  bounds: LatLngBoundsExpression;
  pathOptions?: PathOptions;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface GeoJSONProps {
  data: any;
  style?: PathOptions | ((feature: any) => PathOptions);
  filter?: (feature: any) => boolean;
  onEachFeature?: (feature: any, nodeId: string) => void;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface LayerGroupProps {
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface FeatureGroupProps {
  pathOptions?: PathOptions;
  eventHandlers?: MapEventHandlerFnMap;
  children?: React.ReactNode;
}

export interface PaneProps {
  name: string;
  zIndex?: number;
  children?: React.ReactNode;
}

export interface ImageOverlayProps {
  url: string;
  bounds: LatLngBoundsExpression;
  opacity?: number;
  zIndex?: number;
  eventHandlers?: MapEventHandlerFnMap;
}

export interface ZoomControlProps {
  position?: ControlPosition;
  zoomInText?: string;
  zoomOutText?: string;
}

export interface ScaleControlProps {
  position?: ControlPosition;
  maxWidth?: number;
  metric?: boolean;
  imperial?: boolean;
}

export interface AttributionControlProps {
  position?: ControlPosition;
  prefix?: string | false;
}

export interface LayersControlProps {
  position?: ControlPosition;
  collapsed?: boolean;
  children?: React.ReactNode;
}

export interface ControlledLayerProps {
  checked?: boolean;
  name: string;
  children: React.ReactNode;
}

// -- Imperative handles -------------------------------------------------

export interface FlyToOptions {
  center?: LatLngExpression;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  duration?: number;
  animate?: boolean;
}

export interface MapHandle {
  panTo: (latlng: LatLngExpression, opts?: { animate?: boolean; duration?: number }) => void;
  zoomTo: (zoom: number, opts?: { animate?: boolean; duration?: number }) => void;
  fitBounds: (bounds: LatLngBoundsExpression, opts?: { animate?: boolean }) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
  flyTo: (opts: FlyToOptions) => void;
  getCenter: () => LatLngTuple;
  getZoom: () => number;
  getBounds: () => LatLngBoundsExpression;
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
  downloadRegion: (bounds: LatLngBoundsExpression, opts?: DownloadRegionOptions) => Promise<string>;
  getProgress: (regionId: string) => Promise<DownloadProgress | null>;
  stats: () => Promise<CacheStats>;
}
