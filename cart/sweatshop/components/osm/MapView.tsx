const React: any = require('react');

import { Box, Image, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { tileUrl } from '../../lib/osm/tile-url';
import { latLonToWorld, worldToLatLon } from '../../lib/osm/viewport';

type LatLon = { lat: number; lon: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeZoom(value: number): number {
  return clamp(Math.round(value), 1, 19);
}

export function MapView(props: {
  center: LatLon;
  zoom: number;
  onCenterChange: (next: LatLon) => void;
  onZoomChange: (next: number) => void;
  onErrorChange?: (message: string | null) => void;
}) {
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const dragRef = React.useRef<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = React.useState<Record<string, string>>({});

  const zoom = normalizeZoom(props.zoom);
  const centerWorld = latLonToWorld(props.center.lat, props.center.lon, zoom);
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  const minTileX = Math.floor((centerWorld.x - halfWidth) / 256) - 1;
  const maxTileX = Math.ceil((centerWorld.x + halfWidth) / 256) + 1;
  const minTileY = Math.floor((centerWorld.y - halfHeight) / 256) - 1;
  const maxTileY = Math.ceil((centerWorld.y + halfHeight) / 256) + 1;
  const scale = 1 << zoom;

  const tiles = [];
  for (let ty = minTileY; ty <= maxTileY; ty += 1) {
    if (ty < 0 || ty >= scale) continue;
    for (let tx = minTileX; tx <= maxTileX; tx += 1) {
      const wrappedX = ((tx % scale) + scale) % scale;
      const key = `${zoom}:${wrappedX}:${ty}`;
      const left = wrappedX * 256 - centerWorld.x + halfWidth;
      const top = ty * 256 - centerWorld.y + halfHeight;
      tiles.push({ key, z: zoom, x: wrappedX, y: ty, left, top });
    }
  }

  React.useEffect(() => {
    const errs = Object.values(failed);
    props.onErrorChange?.(errs.length > 0 ? errs[0] : null);
  }, [failed, props.onErrorChange]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextErrors: Record<string, string> = {};
      await Promise.all(tiles.slice(0, 12).map(async (tile) => {
        try {
          const res = await fetch(tileUrl(tile.z, tile.x, tile.y), {
            method: 'HEAD',
            headers: { 'User-Agent': 'reactjit-sweatshop/1.0' },
          } as any);
          if (!res.ok) nextErrors[tile.key] = `tile ${tile.key} failed: ${res.status}`;
        } catch (err) {
          nextErrors[tile.key] = `tile ${tile.key} failed: ${String(err)}`;
        }
      }));
      if (!cancelled) setFailed(nextErrors);
    })();
    return () => { cancelled = true; };
  }, [zoom, centerWorld.x, centerWorld.y, viewport.width, viewport.height]);

  function updateCenterFromDrag(dx: number, dy: number) {
    const nextX = centerWorld.x - dx;
    const nextY = centerWorld.y - dy;
    props.onCenterChange(worldToLatLon(nextX, nextY, zoom));
  }

  return (
    <Box
      onLayout={(layout: any) => {
        const width = Math.max(1, Number(layout?.width || layout?.layout?.width || 0));
        const height = Math.max(1, Number(layout?.height || layout?.layout?.height || 0));
        setViewport((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      style={{ position: 'relative', flexGrow: 1, flexBasis: 0, minHeight: 320, borderRadius: TOKENS.radiusLg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#0b1220' }}
    >
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={tileUrl(tile.z, tile.x, tile.y)}
          style={{
            position: 'absolute',
            left: tile.left,
            top: tile.top,
            width: 256,
            height: 256,
          }}
        />
      ))}
      <Box
        style={{ position: 'absolute', inset: 0 }}
        onPointerDown={(evt: any) => {
          dragRef.current = { x: evt.x ?? evt.clientX ?? 0, y: evt.y ?? evt.clientY ?? 0 };
        }}
        onPointerMove={(evt: any) => {
          const current = dragRef.current;
          if (!current) return;
          const x = evt.x ?? evt.clientX ?? 0;
          const y = evt.y ?? evt.clientY ?? 0;
          updateCenterFromDrag(x - current.x, y - current.y);
          dragRef.current = { x, y };
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onWheel={(evt: any) => {
          const next = evt.deltaY < 0 ? zoom + 1 : zoom - 1;
          props.onZoomChange(normalizeZoom(next));
        }}
      />
      <Box style={{ position: 'absolute', left: 12, bottom: 12, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, backgroundColor: '#0a1020cc', borderWidth: 1, borderColor: COLORS.border }}>
        <Text fontSize={10} color={COLORS.textBright}>{`z${zoom} · ${tiles.length} tiles`}</Text>
      </Box>
      {Object.keys(failed).length > 0 ? (
        <Box style={{ position: 'absolute', left: 12, right: 12, top: 12, padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
          <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>{Object.values(failed)[0]}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
