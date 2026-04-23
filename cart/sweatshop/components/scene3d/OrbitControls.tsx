// =============================================================================
// OrbitControls — drag to rotate, scroll to zoom
// =============================================================================
// Child component: renders a transparent Pressable overlay that captures
// pointer drags and updates the Scene3D registry's camera. Parent Scene3D
// positions the overlay absolutely to cover the whole scene.
//
// Orbit math: spherical coords around the camera target. Drag X rotates the
// azimuth, drag Y rotates the elevation (clamped to avoid poles). Scroll
// (when exposed by the primitive layer) zooms by scaling the (camera -
// target) distance between minDistance and maxDistance.
// =============================================================================


import { Pressable } from '../../../runtime/primitives';
import type { OrbitControlsProps, Vec3 } from './types';
import { useScene3D } from './useScene3D';

function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function len(v: Vec3): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }

function cartesianFromSpherical(r: number, az: number, el: number): Vec3 {
  const cosEl = Math.cos(el);
  return [r * Math.sin(az) * cosEl, r * Math.sin(el), r * Math.cos(az) * cosEl];
}

function sphericalFromOffset(offset: Vec3): { r: number; az: number; el: number } {
  const r = Math.max(1e-6, len(offset));
  const el = Math.asin(Math.max(-1, Math.min(1, offset[1] / r)));
  const az = Math.atan2(offset[0], offset[2]);
  return { r, az, el };
}

export function OrbitControls(props: OrbitControlsProps = {}) {
  const enabled = props.enabled !== false;
  const minDistance = props.minDistance ?? 1;
  const maxDistance = props.maxDistance ?? 80;
  const scene = useScene3D();
  const dragRef = useRef<{ sx: number; sy: number; az: number; el: number; r: number } | null>(null);

  // If the registry isn't around yet, bail early — the overlay would have
  // nothing to mutate. Inside a Scene3D this never happens.
  if (!scene) return null;
  if (!enabled) return null;

  const beginDrag = (sx: number, sy: number) => {
    const cam = scene.camera.get();
    const offset = sub(cam.position, cam.target);
    const sph = sphericalFromOffset(offset);
    dragRef.current = { sx, sy, az: sph.az, el: sph.el, r: sph.r };
  };

  const moveDrag = (dx: number, dy: number) => {
    if (!dragRef.current) return;
    const { az, el, r } = dragRef.current;
    // 360deg across ~600px feels comfortable; tune per cart later.
    const nextAz = az - dx * (Math.PI * 2 / 600);
    const nextEl = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, el + dy * (Math.PI / 600)));
    const cam = scene.camera.get();
    scene.camera.set({ ...cam, position: add(cam.target, cartesianFromSpherical(r, nextAz, nextEl)) });
  };

  const zoom = (delta: number) => {
    const cam = scene.camera.get();
    const offset = sub(cam.position, cam.target);
    const r = len(offset);
    const nextR = Math.max(minDistance, Math.min(maxDistance, r * (delta > 0 ? 1.1 : 0.9)));
    const scale = nextR / (r || 1);
    scene.camera.set({ ...cam, position: add(cam.target, [offset[0] * scale, offset[1] * scale, offset[2] * scale]) });
  };

  useEffect(() => () => { dragRef.current = null; }, []);

  return (
    <Pressable
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      onPointerDown={(e: any) => beginDrag(e.x ?? 0, e.y ?? 0)}
      onPointerMove={(e: any) => {
        if (!dragRef.current) return;
        moveDrag((e.x ?? 0) - dragRef.current.sx, (e.y ?? 0) - dragRef.current.sy);
      }}
      onPointerUp={() => { dragRef.current = null; }}
      onWheel={(e: any) => zoom(e?.deltaY ?? e?.delta ?? 0)}
    />
  );
}
