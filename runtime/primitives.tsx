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

function h(type: any, props: any, ...children: any[]): any {
  return require('react').createElement(type, props, ...children);
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

export const Text: any = (props: any) => h('Text', props, props.children);
export const Image: any = (props: any) => h('Image', props, props.children);
export const Pressable: any = (props: any) => h('Pressable', props, props.children);
export const ScrollView: any = (props: any) => h('ScrollView', props, props.children);
export const TextInput: any = (props: any) => h('TextInput', props, props.children);
export const TextArea: any = (props: any) => h('TextArea', props, props.children);
export const TextEditor: any = (props: any) => h('TextEditor', props, props.children);
export const Terminal: any = (props: any) => h('Terminal', props, props.children);
export const terminal: any = Terminal;

// ── Generated bulk-rendering primitives ─────────────────────
//
// These are framework primitives that paint natively in Zig from a single
// host node. Edit the source-of-truth .tslx files in framework/primitives/
// and run `node scripts/tslx_compile.mjs --all` to regenerate. Do not edit
// the wrappers under runtime/primitives_gen/ by hand.
export { CodeGutter } from './primitives_gen/CodeGutter';
export { Minimap } from './primitives_gen/Minimap';

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
