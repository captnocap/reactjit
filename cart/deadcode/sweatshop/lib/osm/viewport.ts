const TILE_SIZE = 256;
const MAX_LAT = 85.05112878;

export type LatLon = { lat: number; lon: number };
export type TileCoord = { z: number; x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const scale = 1 << z;
  const clippedLat = clamp(lat, -MAX_LAT, MAX_LAT);
  const latRad = clippedLat * Math.PI / 180;
  const x = (lon + 180) / 360 * scale;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;
  return { x, y };
}

export function tileToLonLat(x: number, y: number, z: number): LatLon {
  const scale = 1 << z;
  const lon = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

export function latLonToWorld(lat: number, lon: number, z: number): { x: number; y: number } {
  const scale = TILE_SIZE * (1 << z);
  const clippedLat = clamp(lat, -MAX_LAT, MAX_LAT);
  const sinLat = Math.sin(clippedLat * Math.PI / 180);
  const x = (lon + 180) / 360 * scale;
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function worldToLatLon(x: number, y: number, z: number): LatLon {
  const scale = TILE_SIZE * (1 << z);
  const lon = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}
