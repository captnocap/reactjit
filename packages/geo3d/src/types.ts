import type { Style } from '@reactjit/core';
import type { LatLngExpression, LatLngTuple, PathOptions } from '@reactjit/geo';

/** Props for <GeoScene> — a 3D geographic viewport */
export interface GeoSceneProps {
  /** Center coordinates [lat, lng] */
  center?: LatLngExpression;
  /** Zoom level (affects terrain tile resolution, default: 15) */
  zoom?: number;
  /** Camera mode: "orbit" (default) or "fps" */
  cameraMode?: 'orbit' | 'fps';
  /** Style for the viewport box in the 2D layout */
  style?: Style;
  children?: React.ReactNode;
}

/** Props for <TerrainLayer> — elevation + imagery */
export interface TerrainLayerProps {
  /** URL template for Terrain-RGB elevation tiles (Mapbox format) */
  elevation: string;
  /** URL template for satellite/map imagery tiles (draped over terrain) */
  imagery?: string;
  /** Vertical exaggeration factor (default: 1.0 = real meters) */
  heightScale?: number;
  /** Mesh grid resolution per tile (default: 32, higher = more detail) */
  resolution?: number;
}

/** Props for <BuildingLayer> — GeoJSON polygon extrusion */
export interface BuildingLayerProps {
  /** GeoJSON FeatureCollection with Polygon features */
  data: any;
  /** Default building height in meters when not specified in properties (default: 12) */
  defaultHeight?: number;
  /** Default building color (hex string) */
  color?: string;
}

/** Props for <GeoPath3D> — polyline rendered as ribbon on terrain */
export interface GeoPath3DProps {
  /** Array of [lat, lng] coordinates */
  positions: LatLngExpression[];
  /** Ribbon width in meters (default: 3) */
  width?: number;
  /** Color (hex string) */
  color?: string;
}

/** Props for <GeoMarker3D> — 3D object at a geographic position */
export interface GeoMarker3DProps {
  /** Position [lat, lng] */
  position: LatLngExpression;
  /** Built-in geometry type (default: "sphere") */
  geometry?: 'sphere' | 'box' | 'cube';
  /** Color (hex string) */
  color?: string;
  /** Scale factor (default: 5) */
  scale?: number;
  /** Altitude above ground in meters (default: 0) */
  altitude?: number;
}

/** Props for <Sky> — atmosphere and fog */
export interface SkyProps {
  /** Fog density (0 = no fog, 0.001 = light, 0.005 = heavy, default: 0.0008) */
  fog?: number;
  /** Fog color (hex string) */
  fogColor?: string;
  /** Background/sky color (hex string) */
  backgroundColor?: string;
}
