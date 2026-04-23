import { Box, Col, Row, Text, Graph } from '../../../runtime/primitives';
import { lookupIcon } from '../../../runtime/icons/registry';
import '../icons-boot';

export type IconName = string;
export type IconData = number[][];

// Lucide icons author polylines in a 24×24 viewBox (origin top-left).
// Graph uses a centered viewport (viewX=0,viewY=0 is the midpoint), so shift
// each coord by -12 to center the icon on Graph's origin.
const VIEW = 24;
const HALF = 12;
const SIMPLIFY_EPSILON = 0.35;

const namedPathCache = new Map<string, IconData>();
const directPathCache = new WeakMap<IconData, IconData>();

function pointLineDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function simplifyPointRange(points: number[][], start: number, end: number, keep: boolean[]) {
  if (end <= start + 1) return;
  const ax = points[start][0];
  const ay = points[start][1];
  const bx = points[end][0];
  const by = points[end][1];
  let maxDistance = 0;
  let split = start;

  for (let i = start + 1; i < end; i += 1) {
    const distance = pointLineDistance(points[i][0], points[i][1], ax, ay, bx, by);
    if (distance > maxDistance) {
      maxDistance = distance;
      split = i;
    }
  }

  if (maxDistance > SIMPLIFY_EPSILON) {
    keep[split] = true;
    simplifyPointRange(points, start, split, keep);
    simplifyPointRange(points, split, end, keep);
  }
}

function simplifyPolyline(poly: number[]): number[] {
  if (poly.length <= 8) return poly;
  const points: number[][] = [];
  for (let i = 0; i + 1 < poly.length; i += 2) {
    points.push([poly[i], poly[i + 1]]);
  }
  if (points.length <= 2) return poly;

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  simplifyPointRange(points, 0, points.length - 1, keep);

  const out: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (keep[i]) out.push(points[i][0], points[i][1]);
  }
  return out.length >= 4 ? out : poly;
}

function simplifyIconData(paths: IconData): IconData {
  return paths.map(simplifyPolyline);
}

function resolvePaths(name?: IconName, icon?: IconData): IconData | undefined {
  if (icon) {
    const cached = directPathCache.get(icon);
    if (cached) return cached;
    const simplified = simplifyIconData(icon);
    directPathCache.set(icon, simplified);
    return simplified;
  }

  if (!name) return undefined;
  const cached = namedPathCache.get(name);
  if (cached) return cached;
  const paths = lookupIcon(name);
  if (!paths) return undefined;
  const simplified = simplifyIconData(paths);
  namedPathCache.set(name, simplified);
  return simplified;
}

function polylineToD(poly: number[]): string {
  if (poly.length < 4) return '';
  let out = `M ${poly[0] - HALF},${poly[1] - HALF}`;
  for (let i = 2; i < poly.length; i += 2) {
    out += ` L ${poly[i] - HALF},${poly[i + 1] - HALF}`;
  }
  return out;
}

function renderPaths(paths: IconData, color: string, strokeWidth: number) {
  return paths.map((poly, i) => (
    <Graph.Path
      key={i}
      d={polylineToD(poly)}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
    />
  ));
}

export function Icon(props: {
  name?: IconName;
  icon?: IconData;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const size = props.size ?? 16;
  const color = props.color || '#ccc';
  // Graph.drawCurve() already multiplies strokeWidth by viewZoom when a
  // transform is active, so keep stroke width in source-space units here.
  // Lucide's native stroke width is 2 on the 24-unit canvas.
  const strokeWidth = props.strokeWidth ?? 2;
  const paths = resolvePaths(props.name, props.icon);

  if (!paths || paths.length === 0) {
    return <Box style={{ width: size, height: size }} />;
  }

  const viewZoom = size / VIEW;

  return (
    <Box style={{ width: size, height: size, overflow: 'hidden' }}>
      <Graph
        style={{ width: size, height: size }}
        viewX={0}
        viewY={0}
        viewZoom={viewZoom}
      >
        {renderPaths(paths, color, strokeWidth)}
      </Graph>
    </Box>
  );
}

// Kept for IconGallery smoke test — a small curated list of names the cart
// registers at boot. Not a full Lucide catalog.
export const ICON_NAMES = [
  'folder', 'file', 'file-code', 'file-json', 'file-text', 'folder-open',
  'git-branch', 'git-commit', 'terminal', 'settings', 'search',
  'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right',
  'play', 'pause', 'stop', 'plus', 'x', 'refresh', 'save', 'copy', 'paste',
  'check', 'warn', 'error', 'clock', 'menu', 'dots-vertical',
  'arrow-up', 'arrow-down', 'panel-left', 'panel-right', 'panel-bottom',
  'message', 'pencil', 'trash', 'download', 'upload', 'home',
  'wallet', 'question-mark', 'keyboard', 'palette', 'braces',
  'bot', 'globe', 'sparkles', 'command', 'flame', 'map', 'graph', 'send',
  'hash', 'at', 'info', 'package',
] as const;

export const ICON_CATALOG = ICON_NAMES.map((name) => ({
  name,
  glyph: lookupIcon(name) ? `${lookupIcon(name)!.length} stroke${lookupIcon(name)!.length === 1 ? '' : 's'}` : 'missing',
}));

export function IconGallery() {
  return (
    <Box
      style={{
        padding: 12,
        gap: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#273142',
        backgroundColor: '#0f141c',
      }}
    >
      <Col style={{ gap: 4 }}>
        <Text fontSize={13} color="#e6edf3" style={{ fontWeight: 'bold' }}>
          Icon Gallery
        </Text>
        <Text fontSize={10} color="#8b949e">
          Lucide icons — polyline paths scaled into Graph surfaces.
        </Text>
      </Col>
      <Row style={{ flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
        {ICON_CATALOG.map((entry) => (
          <Box
            key={entry.name}
            style={{
              width: 108,
              padding: 10,
              gap: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#243041',
              backgroundColor: '#121926',
            }}
          >
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#182233',
              }}
            >
              <Icon name={entry.name} size={18} color="#d7dde8" />
            </Box>
            <Text fontSize={10} color="#c9d1d9" style={{ fontWeight: 'bold' }}>
              {entry.name}
            </Text>
            <Text fontSize={9} color="#8b949e">
              {entry.glyph}
            </Text>
          </Box>
        ))}
      </Row>
    </Box>
  );
}
