/**
 * Primitives — the base components the reconciler hands to the Zig host.
 *
 * Each thin wrapper creates a React element with a specific `type` string.
 * The hostConfig (renderer/hostConfig.ts) relays the type through to Zig
 * via CREATE commands. Unknown types pass through unchanged — that's what
 * makes <Native type="Audio" />, <Canvas.Node>, <Graph.Path> etc. work.
 */

const React: any = require('react');

// ── Core building blocks ────────────────────────────────────

export const Box: any = (props: any) => React.createElement('View', props, props.children);

/** Row — Box with flexDirection: 'row' pre-applied. */
export const Row: any = (props: any) => {
  const style = { flexDirection: 'row', ...(props.style ?? {}) };
  return React.createElement('View', { ...props, style }, props.children);
};

/** Col — Box with flexDirection: 'column' pre-applied (same as Box default, for symmetry with Row). */
export const Col: any = (props: any) => {
  const style = { flexDirection: 'column', ...(props.style ?? {}) };
  return React.createElement('View', { ...props, style }, props.children);
};

export const Text: any = (props: any) => React.createElement('Text', props, props.children);
export const Image: any = (props: any) => React.createElement('Image', props, props.children);
export const Pressable: any = (props: any) => React.createElement('Pressable', props, props.children);
export const ScrollView: any = (props: any) => React.createElement('ScrollView', props, props.children);
export const TextInput: any = (props: any) => React.createElement('TextInput', props, props.children);
export const TextArea: any = (props: any) => React.createElement('TextArea', props, props.children);
export const TextEditor: any = (props: any) => React.createElement('TextEditor', props, props.children);

// ── Canvas — pan/zoomable node surface ──────────────────────
//
// Usage:
//   <Canvas style={{ flexGrow: 1 }} viewX={0} viewY={0} viewZoom={1}>
//     <Canvas.Node gx={24} gy={24} gw={500} gh={460}>...</Canvas.Node>
//     <Canvas.Path d="M 0 0 L 100 100" stroke="#f00" strokeWidth={2} />
//     <Canvas.Clamp>...viewport-pinned overlay...</Canvas.Clamp>
//   </Canvas>

const CanvasBase: any = (props: any) => React.createElement('Canvas', props, props.children);
CanvasBase.Node = (props: any) => React.createElement('Canvas.Node', props, props.children);
CanvasBase.Path = (props: any) => React.createElement('Canvas.Path', props, props.children);
CanvasBase.Clamp = (props: any) => React.createElement('Canvas.Clamp', props, props.children);
export const Canvas: any = CanvasBase;

// ── Graph — lightweight charting surface (no pan/zoom/drag) ──
//
// Usage:
//   <Graph style={{ flexGrow: 1 }} viewX={0} viewY={0} viewZoom={1}>
//     <Graph.Path d="M -270,110 L 270,110" stroke="#30363d" strokeWidth={1} />
//     <Graph.Node gx={0} gy={0} gw={20} gh={20}>...</Graph.Node>
//   </Graph>

const GraphBase: any = (props: any) => React.createElement('Graph', props, props.children);
GraphBase.Path = (props: any) => React.createElement('Graph.Path', props, props.children);
GraphBase.Node = (props: any) => React.createElement('Graph.Node', props, props.children);
export const Graph: any = GraphBase;

// ── Native — universal escape hatch for host-handled types ──
//
// Any type string the Zig host recognizes can be created without a JSX
// component. Audio, Video, Cartridge, LLMAgent, RigidBody, etc.
//
//   <Native type="Audio" src="song.mp3" onEnded={...} />
//   <Native type="Cartridge" src="sidebar.so" style={{ width: 250 }} />

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

export const Native: any = React.memo(function Native({ type, ...props }: any) {
  return React.createElement(type, props);
}, nativePropsEqual);
