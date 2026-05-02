/**
 * Primitives — the base components the reconciler hands to the Zig host.
 *
 * Each thin wrapper creates a React element with a specific `type` string.
 * The hostConfig (renderer/hostConfig.ts) relays the type through to Zig
 * via CREATE commands. Unknown types pass through unchanged — that's what
 * makes <Native type="Audio" />, <Canvas.Node>, <Graph.Path> etc. work.
 *
 * Every React call is LAZY — a fresh `require('react')` at render time,
 * not a top-level capture. The esbuild inject of `init_ambient_primitives`
 * into react/index.js's own body causes this module to init recursively
 * during require_react's first call, at which point mod.exports is still
 * the partial `{}`. Capturing React.createElement / React.memo at init
 * time would store undefined forever. Deferring the lookup to render time
 * (after require_react's body finishes) resolves to the real React.
 */

const THEME_PREFIX = 'theme:';

function isThemeTokenValue(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(THEME_PREFIX);
}

function hasThemeTokenValue(v: any): boolean {
  if (isThemeTokenValue(v)) return true;
  if (!v || typeof v !== 'object' || v instanceof Function) return false;
  if ((v as any).$$typeof) return false;
  if (Array.isArray(v)) return v.some(hasThemeTokenValue);
  for (const key of Object.keys(v)) {
    if (key === 'children' || key === 'key' || key === 'ref') continue;
    if (hasThemeTokenValue(v[key])) return true;
  }
  return false;
}

function resolveThemeValue(v: any, colors: any, styles: any, resolveToken: any): any {
  if (isThemeTokenValue(v)) return resolveToken(v, colors, styles);
  if (!v || typeof v !== 'object' || v instanceof Function) return v;
  if ((v as any).$$typeof) return v;
  if (Array.isArray(v)) return v.map((item) => resolveThemeValue(item, colors, styles, resolveToken));

  const out: Record<string, any> = {};
  for (const key of Object.keys(v)) {
    out[key] = key === 'children'
      ? v[key]
      : resolveThemeValue(v[key], colors, styles, resolveToken);
  }
  return out;
}

function useResolvedPrimitiveProps(props: any): any {
  // Theme is required lazily for the same reason React is: primitives can be
  // initialized while React's own module body is still bootstrapping.
  const theme = require('./theme');
  const snap = theme.__useClassifierSnapshot();
  if (!props || !hasThemeTokenValue(props)) return props;
  return resolveThemeValue(props, snap.colors, snap.styles, theme.resolveToken);
}

function h(type: any, props: any, ...children: any[]): any {
  return require('react').createElement(type, useResolvedPrimitiveProps(props), ...children);
}

// ── Core building blocks ────────────────────────────────────

export const Box: any = (props: any) => h('View', props, props.children);

/** Row — Box with flexDirection: 'row' pre-applied. */
export const Row: any = (props: any) => {
  const style = { flexDirection: 'row', ...(props.style ?? {}) };
  return h('View', { ...props, style }, props.children);
};

/** Col — Box with flexDirection: 'column' pre-applied (same as Box default, for symmetry with Row). */
export const Col: any = (props: any) => {
  const style = { flexDirection: 'column', ...(props.style ?? {}) };
  return h('View', { ...props, style }, props.children);
};

// Coalesce adjacent string/number children into a single string so the layout
// engine sees one continuous text run, not N independent inline boxes.
// Without this, `<Text>{n} item{n===1?'':'s'}</Text>` lays out "6", " item",
// "s" as three siblings and can wrap mid-word ("item" on one line, "s" on
// the next). React-DOM and React-Native both flatten this; we have to here.
// Element children (nested <strong>, etc.) pass through untouched — true
// inline flow across element boundaries is the framework-side fix.
function flattenTextChildren(children: any): any {
  if (children == null) return children;
  const list = Array.isArray(children) ? children : [children];
  const out: any[] = [];
  let buf = '';
  let bufHas = false;
  const flush = (): void => {
    if (bufHas) { out.push(buf); buf = ''; bufHas = false; }
  };
  for (const c of list) {
    if (c == null || c === false || c === true) continue;
    const t = typeof c;
    if (t === 'string' || t === 'number') {
      buf += String(c);
      bufHas = true;
    } else {
      flush();
      out.push(c);
    }
  }
  flush();
  if (out.length === 0) return undefined;
  if (out.length === 1) return out[0];
  return out;
}

export const Text: any = (props: any) => {
  const { size, bold, style, children, ...rest } = props;
  const flat = flattenTextChildren(children);
  if (size == null && !bold) return h('Text', { ...rest, style }, flat);
  const shorthand: Record<string, any> = {};
  if (size != null) shorthand.fontSize = size;
  if (bold) shorthand.fontWeight = 'bold';
  return h('Text', { ...rest, style: { ...shorthand, ...(style ?? {}) } }, flat);
};

/**
 * Sentinel byte (SOH, 0x01) — embed inside `<Text>` content to reserve a
 * fontSize×fontSize slot that an `inlineGlyphs` entry paints into.
 *   <Text inlineGlyphs={[{ d: 'M0 0…', fill: '#fff' }]}>
 *     status: {GLYPH_SLOT} ok
 *   </Text>
 */
export const GLYPH_SLOT = '\x01';
export const Image: any = (props: any) => h('Image', props, props.children);
export const Pressable: any = (props: any) => h('Pressable', props, props.children);
// ScrollView auto-persists its scroll position across dev-mode hot reloads.
//
// scroll_y lives on the Zig Node, so a fresh tree after a reload starts at
// 0 even though every useState atom survives via useHotState. This wrapper
// keys scroll on React.useId() (stable per call-site), seeds the primitive
// with initialScrollY on render from __hot_get, and writes every onScroll
// tick back through __hot_set. v8_app applies initialScrollY once on CREATE
// (UPDATE paths skip it), so re-reading the hot value per-render is safe —
// it only affects the very first CREATE command after a reload.
//
// We deliberately DON'T use React.useState for the read: the auto-patched
// useState caches its first value under its own useId, so it would freeze
// on 0 from the first-ever mount and never observe later __hot_set writes.
export const ScrollView: any = (props: any) => {
  const React = require('react');
  const hotId: string = React.useId();
  const hotKey = 'scroll:' + hotId;
  const host: any = globalThis as any;

  let initialY = 0;
  if (typeof host.__hot_get === 'function') {
    try {
      const raw = host.__hot_get(hotKey);
      if (raw != null) {
        const n = parseFloat(raw);
        if (Number.isFinite(n)) initialY = n;
      }
    } catch {}
  }

  const userOnScroll = props.onScroll;
  const onScroll = (payload: any): void => {
    try {
      if (typeof host.__hot_set === 'function' && Number.isFinite(payload?.scrollY)) {
        host.__hot_set(hotKey, String(payload.scrollY));
      }
    } catch {}
    if (typeof userOnScroll === 'function') userOnScroll(payload);
  };

  const forwardedProps = {
    ...props,
    onScroll,
    initialScrollY: props.initialScrollY ?? initialY,
  };
  return h('ScrollView', forwardedProps, props.children);
};
export const TextInput: any = (props: any) => h('TextInput', props, props.children);
export const TextArea: any = (props: any) => h('TextArea', props, props.children);
export const TextEditor: any = (props: any) => h('TextEditor', props, props.children);
export const Terminal: any = (props: any) => h('Terminal', props, props.children);
export const terminal: any = Terminal;
export const Window: any = (props: any) => h('Window', props, props.children);
export const window: any = Window;
export const Notification: any = (props: any) => h('Notification', props, props.children);
export const notification: any = Notification;

// ── Video — Image-shaped host node, but routed through framework/videos.zig ──
// Pass `src` (or `videoSrc` for clarity); engine.zig:1232 promotes any node
// with video_src to the Video paint path.
export const Video: any = ({ src, videoSrc, ...rest }: any) =>
  h('Image', { ...rest, videoSrc: videoSrc ?? src }, rest.children);

// ── Cartridge — embeds another cart's binary as a nested host instance.
// engine.zig:619 walks the tree and lifts any node with cartridge_src.
export const Cartridge: any = ({ src, cartridgeSrc, ...rest }: any) =>
  h('View', { ...rest, cartridgeSrc: cartridgeSrc ?? src }, rest.children);

// ── RenderTarget — render-to-texture surface. Hot-loadable .so render hook
// keyed by the `src` id (matches a registered render pass).
export const RenderTarget: any = ({ src, renderSrc, ...rest }: any) =>
  h('View', { ...rest, renderSrc: renderSrc ?? src }, rest.children);

// ── StaticSurface — GPU-cached subtree. Children remain present for layout
// and hit testing, while paint collapses into a render-to-texture quad.
export const StaticSurface: any = ({
  staticKey,
  staticSurfaceKey,
  scale,
  staticSurfaceScale,
  warmupFrames,
  staticSurfaceWarmupFrames,
  introFrames,
  staticSurfaceIntroFrames,
  ...rest
}: any) => {
  const React = require('react');
  const id = React.useId();
  return h('View', {
    ...rest,
    staticSurface: true,
    staticSurfaceKey: staticSurfaceKey ?? staticKey ?? id,
    staticSurfaceScale: staticSurfaceScale ?? scale ?? 1,
    staticSurfaceWarmupFrames: staticSurfaceWarmupFrames ?? warmupFrames ?? 0,
    staticSurfaceIntroFrames: staticSurfaceIntroFrames ?? introFrames ?? 0,
  }, rest.children);
};

// ── Filter — post-process shader filter on a subtree. Children render
// into an offscreen texture every frame and are composited via the named
// fragment shader (deepfry, crt, vhs, chromatic, posterize, scanlines,
// invert, grayscale, pixelate, dither). Hit-test, layout, and animations
// inside the subtree are unaffected — the filter is purely presentation.
//
//   <Filter shader="deepfry" intensity={1}>
//     <App />
//   </Filter>
export const Filter: any = ({ shader, intensity, ...rest }: any) =>
  h('View', {
    ...rest,
    filterName: shader,
    filterIntensity: intensity ?? 1,
  }, rest.children);

// ── Physics — Box2D 2D physics. Three sub-components:
//   <Physics.World gravityX gravityY>          container that owns the simulation
//     <Physics.Body type="dynamic" x y bullet> rigid body, props alias to physicsX/Y/etc.
//       <Physics.Collider shape="box" radius friction restitution density />
//
// Each just spreads typed physics props onto a host node — the engine reads
// physics_world/body/collider flags to decide how to thread it into Box2D.
const PhysicsBase: any = ({ gravityX, gravityY, ...rest }: any) =>
  h('View', {
    ...rest,
    physicsWorld: true,
    physicsGravityX: gravityX ?? 0,
    physicsGravityY: gravityY ?? 980,
  }, rest.children);
PhysicsBase.World = PhysicsBase;
PhysicsBase.Body = ({ type, x, y, angle, fixedRotation, bullet, gravityScale, ...rest }: any) =>
  h('View', {
    ...rest,
    physicsBody: true,
    physicsBodyType: type ?? 'dynamic',
    physicsX: x ?? 0,
    physicsY: y ?? 0,
    physicsAngle: angle ?? 0,
    physicsFixedRotation: fixedRotation ?? false,
    physicsBullet: bullet ?? false,
    physicsGravityScale: gravityScale ?? 1.0,
  }, rest.children);
PhysicsBase.Collider = ({ shape, radius, density, friction, restitution, ...rest }: any) =>
  h('View', {
    ...rest,
    physicsCollider: true,
    physicsShape: shape ?? 'box',
    physicsRadius: radius ?? 0,
    physicsDensity: density ?? 1.0,
    physicsFriction: friction ?? 0.3,
    physicsRestitution: restitution ?? 0.1,
  }, rest.children);
export const Physics: any = PhysicsBase;

// ── Scene3D — React-side 3D scene graph (lifted from sweatshop) ─────────────
//
// Surface mirrors Physics: a base component plus typed sub-components for
// camera / mesh / lights / orbit-controls. The actual implementation lives
// in runtime/scene3d/ — we lazy-require it here so primitives.tsx doesn't
// drag the whole 3D module into the init graph.
//
//   <Scene3D backgroundColor="#0a0e18">
//     <Scene3D.Camera position={[3, 2, 4]} target={[0, 0, 0]} />
//     <Scene3D.AmbientLight intensity={0.3} />
//     <Scene3D.DirectionalLight direction={[0.5, 1, -0.3]} />
//     <Scene3D.PointLight position={[0, 3, 0]} color="#ffc48a" />
//     <Scene3D.Mesh geometry="sphere" material="#4aa3ff" />
//     <Scene3D.OrbitControls />
//   </Scene3D>
//
// Today the renderer is a CPU 2D perspective mockup over Canvas.Node. When
// the host registers a wgpu-backed Scene3D primitive, the registry stays
// the same and Scene3D.tsx swaps its paint path internally.
const Scene3DBase: any = function Scene3D(props: any) {
  return require('./scene3d/Scene3D').Scene3D(props);
};
Scene3DBase.Camera           = function Camera(props: any)           { return require('./scene3d/Camera').Camera(props); };
Scene3DBase.Mesh             = function Mesh(props: any)             { return require('./scene3d/Mesh').Mesh(props); };
Scene3DBase.AmbientLight     = function AmbientLight(props: any)     { return require('./scene3d/AmbientLight').AmbientLight(props); };
Scene3DBase.DirectionalLight = function DirectionalLight(props: any) { return require('./scene3d/DirectionalLight').DirectionalLight(props); };
Scene3DBase.PointLight       = function PointLight(props: any)       { return require('./scene3d/PointLight').PointLight(props); };
Scene3DBase.OrbitControls    = function OrbitControls(props: any)    { return require('./scene3d/OrbitControls').OrbitControls(props); };
export const Scene3D: any = Scene3DBase;

// ── Audio — declarative wrapper around framework/audio.zig ─────────────────
//
// Mirrors Physics / Scene3D: a base <Audio> root plus typed sub-components.
// Lazy require() keeps audio.tsx out of the primitives init graph until a
// cart actually mounts an <Audio> tree.
//
//   <Audio gain={0.8}>
//     <Audio.Module id="voice1" type="pocket_voice" tone={0.5} drive={0.3} />
//     <Audio.Module id="delay1" type="delay" feedback={0.4} time={0.25} />
//     <Audio.Connection from="voice1" to="delay1" />
//   </Audio>
//
//   const audio = useAudio();
//   audio.noteOn('voice1', 60);
const AudioBase: any = function Audio(props: any) {
  return require('./audio').Audio(props);
};
AudioBase.Module     = function Module(props: any)     { return require('./audio').Audio.Module(props); };
AudioBase.Connection = function Connection(props: any) { return require('./audio').Audio.Connection(props); };
export const Audio: any = AudioBase;

// ── Canvas — pan/zoomable node surface ──────────────────────

const CanvasBase: any = (props: any) => h('Canvas', props, props.children);
CanvasBase.Node = (props: any) => h('Canvas.Node', props, props.children);
CanvasBase.Path = (props: any) => h('Canvas.Path', props, props.children);
CanvasBase.Clamp = (props: any) => h('Canvas.Clamp', props, props.children);
export const Canvas: any = CanvasBase;

// ── Graph — lightweight charting surface (no pan/zoom/drag) ──

const GraphBase: any = (props: any) => h('Graph', props, props.children);
GraphBase.Path = (props: any) => h('Graph.Path', props, props.children);
GraphBase.Node = (props: any) => h('Graph.Node', props, props.children);
export const Graph: any = GraphBase;

// ── Render — external display/app capture surface ─────────────

export const Render: any = (props: any) => h('Render', props, props.children);

// ── Effect — per-pixel generative surface ─────────────────────
export const Effect: any = (props: any) => h('Effect', props, props.children);

// ── Native — universal escape hatch for host-handled types ──

function nativePropsEqual(prev: any, next: any): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of nextKeys) {
    if (key === 'children') continue;
    if (key.startsWith('on') && key.length > 2 && key[2] === key[2].toUpperCase()) {
      if ((key in prev) !== (key in next)) return false;
      continue;
    }
    if ((prev as any)[key] !== (next as any)[key]) return false;
  }
  return true;
}

// React.memo deferred to first render — calling require('react').memo at
// module init time captures undefined (see header comment). First render
// memoizes the inner component; subsequent renders reuse the cached memo
// component, so equality comparisons fire as usual.
let _NativeMemoized: any = null;
function getNativeMemoized(): any {
  if (_NativeMemoized) return _NativeMemoized;
  const R: any = require('react');
  _NativeMemoized = R.memo(function NativeInner({ type, ...props }: any) {
    return R.createElement(type, props);
  }, nativePropsEqual);
  return _NativeMemoized;
}

export const Native: any = function Native(props: any) {
  return h(getNativeMemoized(), props);
};
