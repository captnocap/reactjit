/**
 * Imaging — GIMP-style image processing in Lua + GLSL.
 *
 * Live demos for color adjustments, filters, blend modes.
 * All GPU-accelerated via GLSL shaders. Lua does the pixel work,
 * React declares the pipeline.
 *
 * PERF: No timers. Demos update only on user interaction (button press).
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useRef, useState } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, Native, useMount, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useImagingComposer, useImagingHistory, useImaging, useImagingSelection, useDrawCanvas } from '../../../packages/imaging/src';
import type { BlendMode, ImagingComposition, ImagingLayerCrop, ImagingLayerPivot, ImagingSelectionShape } from '../../../packages/imaging/src';
import {Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn} from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#e67e22',
  accentDim: 'rgba(230, 126, 34, 0.12)',
  callout: 'rgba(230, 126, 34, 0.06)',
  calloutBorder: 'rgba(230, 126, 34, 0.30)',
  color: '#f9e2af',
  filter: '#89b4fa',
  blend: '#cba6f7',
  pipeline: '#a6e3a1',
  gpu: '#94e2d5',
  pattern: '#f5c2e7',
  graph: '#74c7ec',
  transform: '#f4b8e4',
  selection: '#fab387',
  canvas: '#a6da95',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useImaging, useBlendModes }
  from '@reactjit/imaging'

-- Lua (standalone, no React needed):
local Imaging = require("lua.imaging")`;

const PIPELINE_CODE = `local result = Imaging.from("photo.jpg")
  :brightness(0.2)
  :contrast(1.3)
  :gaussianBlur(3)
  :apply()

Imaging.save(result, "output.png")`;

const REACT_CODE = `<Native type="Imaging"
  src="photo.jpg"
  operations={JSON.stringify([
    { op: 'brightness', amount: 0.2 },
    { op: 'gaussian_blur', radius: 5 },
  ])}
  style={{ width: 300, height: 200 }}
/>`;

const COLOR_OPS_CODE = `:brightness(amount)     // -1 to 1
:contrast(factor)       // 0.5 to 3
:levels(inB,inW,gamma,outB,outW)
:curves([[0,0],[0.5,0.7],[1,1]])
:hueSaturation(hue, sat, val)
:invert()
:threshold(0.5)         // binary B&W
:posterize(4)           // reduce colors
:desaturate("luminosity")
:colorize(180, 0.5, 0)
:channelMixer(matrix3x3)
:gradientMap(gradient)`;

const FILTER_OPS_CODE = `:gaussianBlur(radius)   // soft blur
:boxBlur(radius)        // fast blur
:motionBlur(angle,dist) // directional
:sharpen(amount)        // unsharp mask
:edgeDetect("sobel")    // or "laplacian"
:emboss(angle, depth)   // relief
:pixelize(blockSize)    // mosaic`;

const BLEND_CODE = `:blend("multiply", layer, opacity)
:blend("screen", layer)
:blend("overlay", layer)
:blend("soft_light", layer)
:blend("hard_light", layer)
:blend("dodge", layer)
:blend("burn", layer)
:blend("difference", layer)
:blend("exclusion", layer)
:blend("addition", layer)
:blend("subtract", layer)
:blend("hue", layer)
:blend("saturation", layer)
:blend("color", layer)
:blend("value", layer)`;

const CUSTOM_CODE = `Imaging.registerOp("my_filter", {
  gpu = function(canvas, w, h, params)
    -- GLSL shader path
    return applyShader(...)
  end,
  cpu = function(canvas, w, h, params)
    -- ImageData pixel path
    local data = canvas:newImageData()
    data:mapPixel(function(x,y,r,g,b,a)
      return r, g * 0.5, b, a
    end)
    ...
  end,
})`;

const SELECTION_CODE = `const { addShape, rasterize, clearMask } = useImagingSelection();
const { apply } = useImaging();

// 1. Define a selection shape
addShape({ type: 'rect', x: 0, y: 0, width: 130, height: 180 });

// 2. Rasterize to an in-memory mask (returns a maskId handle)
const maskId = await rasterize(260, 180, undefined, { featherRadius: 12 });

// 3. Apply ops only inside the selected region
await apply({
  src: 'photo.jpg',
  operations: [{ op: 'gaussian_blur', radius: 8 }],
  maskId,
  output: 'result.png',
});

// 4. Release mask when done
await clearMask();`;

const DRAW_CANVAS_CODE = `const dc = useDrawCanvas(400, 300);

// Declare the canvas node
<Native type="DrawCanvas"
  canvasId={dc.canvasId}
  width={400}
  height={300}
  style={{ width: 400, height: 300 }}
/>

// Draw
await dc.paint([[0,0],[200,150],[400,300]], [1, 0.3, 0, 1], 12);
await dc.erase([[100,80],[200,120]], 20);
await dc.fill(50, 50, [0, 0, 1, 1]);
await dc.clear();

// Compose as a layer
const composition = {
  width: 400, height: 300,
  layers: [
    { id: 'bg', src: 'photo.jpg' },
    { id: 'paint', drawCanvasId: dc.canvasId, blendMode: 'overlay' },
  ],
};`;

const LAYER_GRAPH_CODE = `const composition = {
  width: 320,
  height: 180,
  layers: [
    {
      id: 'base',
      src: 'lib/placeholders/landscape.png',
      operations: [{ op: 'contrast', factor: 1.15 }],
    },
    {
      id: 'overlay',
      src: 'lib/placeholders/poster.png',
      blendMode: 'overlay',
      opacity: 0.45,
      operations: [{ op: 'desaturate', method: 'luminosity' }],
    },
  ],
}

await compose({ composition, output: 'imaging_compose_1.png' })`;

const TRANSFORM_GRAPH_CODE = `const composition = {
  width: 320,
  height: 180,
  layers: [
    { id: 'base', src: 'lib/placeholders/landscape.png' },
    {
      id: 'subject',
      src: 'lib/placeholders/avatar.png',
      x: 160,
      y: 90,
      scale: 1.2,
      rotation: 25,
      pivot: { x: 0.5, y: 0.5, relative: true },
      crop: { x: 16, y: 16, width: 96, height: 96 },
      blendMode: 'overlay',
      opacity: 0.7,
    },
  ],
}

await compose({ composition, output: 'imaging_transform_1.png' })`;

// ── Helpers ──────────────────────────────────────────────

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <Box style={{ backgroundColor: color + '22', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
      <Text style={{ color, fontSize: 8, fontFamily: 'monospace' }}>{text}</Text>
    </Box>
  );
}

function Label({ label, value, color }: { label: string; value: string; color?: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG8>
      <S.StoryCap>{label}</S.StoryCap>
      <Text style={{ color: color || c.text, fontSize: 9, fontFamily: 'monospace' }}>{value}</Text>
    </S.RowCenterG8>
  );
}

function ActionBtn({ label, color, onPress, active }: { label: string; color: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress}>
      <Box style={{
        backgroundColor: active ? color + '55' : color + '33',
        paddingLeft: 12, paddingRight: 12,
        paddingTop: 6, paddingBottom: 6,
        borderRadius: 4,
        borderWidth: active ? 1 : 0,
        borderColor: color,
      }}>
        <Text style={{ color, fontSize: 10 }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

const DEMO_ACTION_ROW_STYLE = {
  flexDirection: 'row' as const,
  gap: 6,
  flexWrap: 'wrap' as const,
  alignSelf: 'stretch' as const,
  justifyContent: 'center' as const,
};

// ── Live Imaging Preview ─────────────────────────────────
// Thin wrapper around <Native type="Imaging"> with labeled pipeline display

function ImagingPreview({ ops, src, width, height }: {
  ops: any[];
  src?: string;
  width?: number;
  height?: number;
}) {
  const opsJson = JSON.stringify(ops);
  return (
    <Native
      type="Imaging"
      src={src || ''}
      operations={opsJson}
      style={{
        width: width || 260,
        height: height || 180,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    />
  );
}

// ── Demo 1: Color Adjustments ────────────────────────────

type ColorOp = 'none' | 'brightness' | 'contrast' | 'invert' | 'threshold' | 'posterize' | 'desaturate' | 'hue_shift' | 'colorize';

const COLOR_PRESETS: { name: ColorOp; label: string; ops: any[] }[] = [
  { name: 'none', label: 'Original', ops: [] },
  { name: 'brightness', label: 'Bright +0.3', ops: [{ op: 'brightness', amount: 0.3 }] },
  { name: 'contrast', label: 'High Contrast', ops: [{ op: 'contrast', factor: 2.0 }] },
  { name: 'invert', label: 'Invert', ops: [{ op: 'invert' }] },
  { name: 'threshold', label: 'Threshold', ops: [{ op: 'threshold', level: 0.5 }] },
  { name: 'posterize', label: 'Posterize 4', ops: [{ op: 'posterize', levels: 4 }] },
  { name: 'desaturate', label: 'Grayscale', ops: [{ op: 'desaturate', method: 'luminosity' }] },
  { name: 'hue_shift', label: 'Hue +120\u00B0', ops: [{ op: 'hue_saturation', hue: 120, saturation: 1.0, value: 1.0 }] },
  { name: 'colorize', label: 'Sepia', ops: [{ op: 'colorize', hue: 35, saturation: 0.4, lightness: 0.0 }] },
];

function ColorDemo() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(0);
  const preset = COLOR_PRESETS[selected];

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="brightness" color={C.color} />
        <Tag text="contrast" color={C.color} />
        <Tag text="invert" color={C.color} />
        <Tag text="hue_saturation" color={C.color} />
      </S.RowG6>

      <ImagingPreview
        src="lib/placeholders/landscape.png"
        ops={preset.ops}
      />

      <Label label="operation" value={preset.label} color={C.color} />
      <Label label="pipeline" value={preset.ops.length === 0 ? 'passthrough' : JSON.stringify(preset.ops[0])} />

      <Box style={DEMO_ACTION_ROW_STYLE}>
        {COLOR_PRESETS.map((p, i) => (
          <ActionBtn
            key={p.name}
            label={p.label}
            color={C.color}
            active={i === selected}
            onPress={() => setSelected(i)}
          />
        ))}
      </Box>
    </S.CenterW100>
  );
}

// ── Demo 2: Filters ──────────────────────────────────────

const FILTER_PRESETS: { label: string; ops: any[] }[] = [
  { label: 'Original', ops: [] },
  { label: 'Blur 3', ops: [{ op: 'gaussian_blur', radius: 3 }] },
  { label: 'Blur 8', ops: [{ op: 'gaussian_blur', radius: 8 }] },
  { label: 'Sharpen', ops: [{ op: 'sharpen', amount: 1.5 }] },
  { label: 'Sobel Edge', ops: [{ op: 'edge_detect', method: 'sobel' }] },
  { label: 'Laplacian', ops: [{ op: 'edge_detect', method: 'laplacian' }] },
  { label: 'Emboss', ops: [{ op: 'emboss', angle: 135, depth: 1.0 }] },
  { label: 'Pixelize 8', ops: [{ op: 'pixelize', size: 8 }] },
  { label: 'Pixelize 16', ops: [{ op: 'pixelize', size: 16 }] },
  { label: 'Motion Blur', ops: [{ op: 'motion_blur', angle: 45, distance: 15 }] },
];

function FilterDemo() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(0);
  const preset = FILTER_PRESETS[selected];

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="gaussian_blur" color={C.filter} />
        <Tag text="edge_detect" color={C.filter} />
        <Tag text="sharpen" color={C.filter} />
        <Tag text="pixelize" color={C.filter} />
      </S.RowG6>

      <ImagingPreview
        src="lib/placeholders/landscape.png"
        ops={preset.ops}
      />

      <Label label="filter" value={preset.label} color={C.filter} />
      {preset.ops.length > 0 && (
        <Label label="params" value={JSON.stringify(preset.ops[0])} />
      )}

      <Box style={DEMO_ACTION_ROW_STYLE}>
        {FILTER_PRESETS.map((p, i) => (
          <ActionBtn
            key={p.label}
            label={p.label}
            color={C.filter}
            active={i === selected}
            onPress={() => setSelected(i)}
          />
        ))}
      </Box>
    </S.CenterW100>
  );
}

// ── Demo 3: Pipeline Chaining ────────────────────────────

const PIPELINE_PRESETS: { label: string; ops: any[] }[] = [
  { label: 'Original', ops: [] },
  { label: 'Vintage', ops: [
    { op: 'desaturate', method: 'luminosity' },
    { op: 'colorize', hue: 35, saturation: 0.35, lightness: 0.0 },
    { op: 'contrast', factor: 1.2 },
  ]},
  { label: 'Neon Edge', ops: [
    { op: 'edge_detect', method: 'sobel' },
    { op: 'invert' },
    { op: 'hue_saturation', hue: 180, saturation: 2.0, value: 1.0 },
  ]},
  { label: 'Dream', ops: [
    { op: 'gaussian_blur', radius: 4 },
    { op: 'brightness', amount: 0.15 },
    { op: 'contrast', factor: 0.8 },
    { op: 'hue_saturation', hue: 30, saturation: 1.3, value: 1.0 },
  ]},
  { label: 'Comic', ops: [
    { op: 'posterize', levels: 5 },
    { op: 'contrast', factor: 1.5 },
    { op: 'sharpen', amount: 2.0 },
  ]},
  { label: 'Thermal', ops: [
    { op: 'desaturate', method: 'luminosity' },
    { op: 'gradient_map', gradient: [
      [0, 0, 0, 0.2],
      [0.25, 0.2, 0, 0.8],
      [0.5, 0.8, 0.2, 0],
      [0.75, 1, 0.8, 0],
      [1, 1, 1, 1],
    ]},
  ]},
  { label: 'Glitch', ops: [
    { op: 'pixelize', size: 4 },
    { op: 'channel_mixer', matrix: [[1.2, 0, -0.2], [-0.1, 1.1, 0], [0, -0.2, 1.2]] },
    { op: 'contrast', factor: 1.8 },
  ]},
];

function PipelineDemo() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(0);
  const preset = PIPELINE_PRESETS[selected];

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6>
        <Tag text="pipeline" color={C.pipeline} />
        <Tag text={`${preset.ops.length} ops`} color={C.pipeline} />
      </S.RowG6>

      <ImagingPreview
        src="lib/placeholders/landscape.png"
        ops={preset.ops}
      />

      <Label label="preset" value={preset.label} color={C.pipeline} />
      <Label label="chain" value={preset.ops.map(o => o.op).join(' \u2192 ') || 'none'} />

      <Box style={DEMO_ACTION_ROW_STYLE}>
        {PIPELINE_PRESETS.map((p, i) => (
          <ActionBtn
            key={p.label}
            label={p.label}
            color={C.pipeline}
            active={i === selected}
            onPress={() => setSelected(i)}
          />
        ))}
      </Box>
    </S.CenterW100>
  );
}

// ── Demo 4: Test Pattern (no source image) ───────────────

const PATTERN_PRESETS: { label: string; ops: any[] }[] = [
  { label: 'Original', ops: [] },
  { label: 'Levels', ops: [{ op: 'levels', inBlack: 0.2, inWhite: 0.8, gamma: 1.5, outBlack: 0.0, outWhite: 1.0 }] },
  { label: 'Curves S', ops: [{ op: 'curves', points: [[0, 0], [0.25, 0.15], [0.5, 0.5], [0.75, 0.85], [1, 1]] }] },
  { label: 'Channel Swap', ops: [{ op: 'channel_mixer', matrix: [[0, 1, 0], [0, 0, 1], [1, 0, 0]] }] },
  { label: 'Gradient Map', ops: [{ op: 'gradient_map', gradient: [[0, 0.1, 0, 0.2], [0.5, 0.9, 0.3, 0.1], [1, 1, 1, 0.8]] }] },
];

function PatternDemo() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(0);
  const preset = PATTERN_PRESETS[selected];

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6>
        <Tag text="test pattern" color={C.pattern} />
        <Tag text="no source file" color={C.pattern} />
      </S.RowG6>

      <ImagingPreview ops={preset.ops} />

      <Label label="effect" value={preset.label} color={C.pattern} />
      <S.StoryCap>
        {'Omit src to get a procedural test pattern — color bars, grayscale gradient, and HSV sweep'}
      </S.StoryCap>

      <Box style={DEMO_ACTION_ROW_STYLE}>
        {PATTERN_PRESETS.map((p, i) => (
          <ActionBtn
            key={p.label}
            label={p.label}
            color={C.pattern}
            active={i === selected}
            onPress={() => setSelected(i)}
          />
        ))}
      </Box>
    </S.CenterW100>
  );
}

// ── Demo 5: Layer Graph Compose ──────────────────────────

const COMPOSE_TONES = [
  { label: 'Natural', ops: [] as any[] },
  { label: 'Cinema', ops: [{ op: 'contrast', factor: 1.25 }, { op: 'colorize', hue: 30, saturation: 0.18, lightness: 0 }] as any[] },
  { label: 'Noir', ops: [{ op: 'desaturate', method: 'luminosity' }, { op: 'contrast', factor: 1.45 }] as any[] },
];

const COMPOSE_OVERLAYS = [
  { label: 'Poster', src: 'lib/placeholders/poster.png', ops: [] as any[] },
  { label: 'Spotlight', src: 'lib/placeholders/spotlight.png', ops: [{ op: 'gaussian_blur', radius: 2 }] as any[] },
  { label: 'Avatar', src: 'lib/placeholders/avatar.png', ops: [{ op: 'hue_saturation', hue: 210, saturation: 1.4, value: 1 }] as any[] },
];

const GRAPH_BLEND_MODES: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'soft_light'];

type GraphState = {
  toneIndex: number;
  overlayIndex: number;
  blendIndex: number;
};

const GRAPH_INITIAL: GraphState = {
  toneIndex: 0,
  overlayIndex: 0,
  blendIndex: 3,
};

function buildComposition(state: GraphState): ImagingComposition {
  const tone = COMPOSE_TONES[state.toneIndex];
  const overlay = COMPOSE_OVERLAYS[state.overlayIndex];
  const blendMode = GRAPH_BLEND_MODES[state.blendIndex];

  return {
    width: 320,
    height: 180,
    layers: [
      {
        id: 'base',
        src: 'lib/placeholders/landscape.png',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        operations: tone.ops,
      },
      {
        id: 'overlay',
        src: overlay.src,
        visible: true,
        opacity: 0.45,
        blendMode,
        x: 0,
        y: 0,
        operations: overlay.ops,
      },
    ],
  };
}

function LayerGraphDemo() {
  const c = useThemeColors();
  const { compose, processing, error } = useImagingComposer();
  const { history, commit, undo, redo, canUndo, canRedo } = useImagingHistory<GraphState>(GRAPH_INITIAL);
  const state = history.present?.state || GRAPH_INITIAL;
  const [previewSrc, setPreviewSrc] = useState('');
  const [composeInfo, setComposeInfo] = useState('pending');

  const runCompose = (s: GraphState) => {
    const composition = buildComposition(s);
    const nonce = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const output = `imaging_compose_${nonce}.png`;
    compose({ composition, output }).then((result: any) => {
      if (!result) return;
      if (result.ok) {
        setPreviewSrc(output);
        setComposeInfo(`${result.width}x${result.height} cache=${result.cacheHit ? 'hit' : 'miss'}`);
      } else {
        setComposeInfo(result.error || 'compose failed');
      }
    });
  };

  // Trigger compose on mount and whenever state changes (undo/redo)
  const prevStateRef = useRef<GraphState | null>(null);
  if (prevStateRef.current !== state) {
    prevStateRef.current = state;
    runCompose(state);
  }

  const setTone = (index: number) => {
    commit({ ...state, toneIndex: index }, `Tone ${COMPOSE_TONES[index].label}`);
  };

  const setOverlay = (index: number) => {
    commit({ ...state, overlayIndex: index }, `Overlay ${COMPOSE_OVERLAYS[index].label}`);
  };

  const setBlend = (index: number) => {
    commit({ ...state, blendIndex: index }, `Blend ${GRAPH_BLEND_MODES[index]}`);
  };

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="layer graph" color={C.graph} />
        <Tag text="compose rpc" color={C.graph} />
        <Tag text="history undo/redo" color={C.graph} />
      </S.RowG6>

      {previewSrc ? (
        <ImagingPreview src={previewSrc} ops={[]} width={300} height={180} />
      ) : (
        <S.Center style={{ width: 300, height: 180, borderRadius: 6, borderWidth: 1, borderColor: c.border }}>
          <S.StoryMuted>{'waiting for compose output'}</S.StoryMuted>
        </S.Center>
      )}

      <Label label="status" value={processing ? 'processing' : composeInfo} color={C.graph} />
      <Label label="state" value={`tone=${COMPOSE_TONES[state.toneIndex].label} overlay=${COMPOSE_OVERLAYS[state.overlayIndex].label} blend=${GRAPH_BLEND_MODES[state.blendIndex]}`} />
      {error ? <Label label="error" value={error} color="#f38ba8" /> : null}

      <S.StoryCap>{'Tone'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {COMPOSE_TONES.map((tone, i) => (
          <ActionBtn
            key={tone.label}
            label={tone.label}
            color={C.graph}
            active={i === state.toneIndex}
            onPress={() => setTone(i)}
          />
        ))}
      </Box>

      <S.StoryCap>{'Overlay'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {COMPOSE_OVERLAYS.map((overlay, i) => (
          <ActionBtn
            key={overlay.label}
            label={overlay.label}
            color={C.graph}
            active={i === state.overlayIndex}
            onPress={() => setOverlay(i)}
          />
        ))}
      </Box>

      <S.StoryCap>{'Blend'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {GRAPH_BLEND_MODES.map((mode, i) => (
          <ActionBtn
            key={mode}
            label={mode}
            color={C.graph}
            active={i === state.blendIndex}
            onPress={() => setBlend(i)}
          />
        ))}
      </Box>

      <Box style={DEMO_ACTION_ROW_STYLE}>
        <ActionBtn label="Undo" color={C.graph} active={false} onPress={() => { if (canUndo) undo(); }} />
        <ActionBtn label="Redo" color={C.graph} active={false} onPress={() => { if (canRedo) redo(); }} />
      </Box>
      <Label label="history" value={`past=${history.past.length} future=${history.future.length}`} />
    </S.CenterW100>
  );
}

// ── Demo 6: Layer Transform Compose ─────────────────────

const TRANSFORM_SCALES = [0.7, 1.0, 1.3];
const TRANSFORM_ROTATIONS = [-35, -15, 0, 15, 35];
const TRANSFORM_PIVOTS: { label: string; pivot: ImagingLayerPivot }[] = [
  { label: 'Center', pivot: { x: 0.5, y: 0.5, relative: true } },
  { label: 'Top Left', pivot: { x: 0, y: 0, relative: true } },
  { label: 'Bottom Right', pivot: { x: 1, y: 1, relative: true } },
];
const TRANSFORM_CROPS: { label: string; crop?: ImagingLayerCrop }[] = [
  { label: 'Full' },
  { label: 'Portrait', crop: { x: 12, y: 8, width: 104, height: 112 } },
  { label: 'Square', crop: { x: 18, y: 18, width: 92, height: 92 } },
];
const TRANSFORM_BLENDS: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay'];

type TransformState = {
  scaleIndex: number;
  rotationIndex: number;
  pivotIndex: number;
  cropIndex: number;
  blendIndex: number;
};

const TRANSFORM_INITIAL: TransformState = {
  scaleIndex: 1,
  rotationIndex: 2,
  pivotIndex: 0,
  cropIndex: 0,
  blendIndex: 3,
};

function buildTransformComposition(state: TransformState): ImagingComposition {
  const scale = TRANSFORM_SCALES[state.scaleIndex];
  const rotation = TRANSFORM_ROTATIONS[state.rotationIndex];
  const pivot = TRANSFORM_PIVOTS[state.pivotIndex].pivot;
  const crop = TRANSFORM_CROPS[state.cropIndex].crop;
  const blendMode = TRANSFORM_BLENDS[state.blendIndex];

  return {
    width: 320,
    height: 180,
    layers: [
      {
        id: 'base',
        src: 'lib/placeholders/landscape.png',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
      },
      {
        id: 'subject',
        src: 'lib/placeholders/avatar.png',
        visible: true,
        blendMode,
        opacity: 0.72,
        x: 160,
        y: 90,
        scale,
        rotation,
        pivot,
        crop,
        operations: [{ op: 'contrast', factor: 1.1 }, { op: 'hue_saturation', hue: 12, saturation: 1.08, value: 1 }],
      },
    ],
  };
}

function LayerTransformDemo() {
  const c = useThemeColors();
  const { compose, processing, error } = useImagingComposer();
  const { history, commit, undo, redo, canUndo, canRedo } = useImagingHistory<TransformState>(TRANSFORM_INITIAL);
  const state = history.present?.state || TRANSFORM_INITIAL;
  const [previewSrc, setPreviewSrc] = useState('');
  const [composeInfo, setComposeInfo] = useState('pending');

  const runCompose = (s: TransformState) => {
    const composition = buildTransformComposition(s);
    const nonce = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const output = `imaging_transform_${nonce}.png`;
    compose({ composition, output }).then((result: any) => {
      if (!result) return;
      if (result.ok) {
        setPreviewSrc(output);
        setComposeInfo(`${result.width}x${result.height} cache=${result.cacheHit ? 'hit' : 'miss'}`);
      } else {
        setComposeInfo(result.error || 'compose failed');
      }
    });
  };

  // Trigger compose on mount and whenever state changes (undo/redo)
  const prevStateRef = useRef<TransformState | null>(null);
  if (prevStateRef.current !== state) {
    prevStateRef.current = state;
    runCompose(state);
  }

  const patch = (next: Partial<TransformState>, label: string) => {
    commit({ ...state, ...next }, label);
  };

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="transform pass" color={C.transform} />
        <Tag text="crop + pivot + rotate" color={C.transform} />
        <Tag text="non destructive" color={C.transform} />
      </S.RowG6>

      {previewSrc ? (
        <ImagingPreview src={previewSrc} ops={[]} width={300} height={180} />
      ) : (
        <S.Center style={{ width: 300, height: 180, borderRadius: 6, borderWidth: 1, borderColor: c.border }}>
          <S.StoryMuted>{'waiting for compose output'}</S.StoryMuted>
        </S.Center>
      )}

      <Label label="status" value={processing ? 'processing' : composeInfo} color={C.transform} />
      <Label
        label="state"
        value={`scale=${TRANSFORM_SCALES[state.scaleIndex]} rot=${TRANSFORM_ROTATIONS[state.rotationIndex]} pivot=${TRANSFORM_PIVOTS[state.pivotIndex].label} crop=${TRANSFORM_CROPS[state.cropIndex].label}`}
      />
      {error ? <Label label="error" value={error} color="#f38ba8" /> : null}

      <S.StoryCap>{'Scale'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {TRANSFORM_SCALES.map((scale, i) => (
          <ActionBtn
            key={`${scale}`}
            label={`${scale}x`}
            color={C.transform}
            active={i === state.scaleIndex}
            onPress={() => patch({ scaleIndex: i }, `Scale ${scale}`)}
          />
        ))}
      </Box>

      <S.StoryCap>{'Rotation (deg)'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {TRANSFORM_ROTATIONS.map((rotation, i) => (
          <ActionBtn
            key={`${rotation}`}
            label={`${rotation}`}
            color={C.transform}
            active={i === state.rotationIndex}
            onPress={() => patch({ rotationIndex: i }, `Rotate ${rotation}`)}
          />
        ))}
      </Box>

      <S.StoryCap>{'Pivot'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {TRANSFORM_PIVOTS.map((entry, i) => (
          <ActionBtn
            key={entry.label}
            label={entry.label}
            color={C.transform}
            active={i === state.pivotIndex}
            onPress={() => patch({ pivotIndex: i }, `Pivot ${entry.label}`)}
          />
        ))}
      </Box>

      <S.StoryCap>{'Crop'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {TRANSFORM_CROPS.map((entry, i) => (
          <ActionBtn
            key={entry.label}
            label={entry.label}
            color={C.transform}
            active={i === state.cropIndex}
            onPress={() => patch({ cropIndex: i }, `Crop ${entry.label}`)}
          />
        ))}
      </Box>

      <S.StoryCap>{'Blend'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {TRANSFORM_BLENDS.map((mode, i) => (
          <ActionBtn
            key={mode}
            label={mode}
            color={C.transform}
            active={i === state.blendIndex}
            onPress={() => patch({ blendIndex: i }, `Blend ${mode}`)}
          />
        ))}
      </Box>

      <Box style={DEMO_ACTION_ROW_STYLE}>
        <ActionBtn label="Undo" color={C.transform} active={false} onPress={() => { if (canUndo) undo(); }} />
        <ActionBtn label="Redo" color={C.transform} active={false} onPress={() => { if (canRedo) redo(); }} />
      </Box>
      <Label label="history" value={`past=${history.past.length} future=${history.future.length}`} />
    </S.CenterW100>
  );
}

// ── Demo 7: Selection Mask ───────────────────────────────

type SelectionShape = { label: string; shape: ImagingSelectionShape | null };
type SelectionOp    = { label: string; ops: any[] };

const SELECTION_SHAPES: SelectionShape[] = [
  { label: 'Left Half',    shape: { type: 'rect',    x: 0,   y: 0,  width: 130, height: 180 } },
  { label: 'Center Oval',  shape: { type: 'ellipse', x: 130, y: 90, width: 90,  height: 65 } },
  { label: 'Right Third',  shape: { type: 'rect',    x: 174, y: 0,  width: 87,  height: 180 } },
  { label: 'Full (no mask)', shape: null },
];

const SELECTION_OPS: SelectionOp[] = [
  { label: 'Blur',       ops: [{ op: 'gaussian_blur', radius: 10 }] },
  { label: 'Invert',     ops: [{ op: 'invert' }] },
  { label: 'Bright +0.5', ops: [{ op: 'brightness', amount: 0.5 }] },
  { label: 'Pixelize',   ops: [{ op: 'pixelize', size: 14 }] },
  { label: 'Edge',       ops: [{ op: 'edge_detect', method: 'sobel' }] },
];

const SELECTION_FEATHERS = [
  { label: 'Hard', radius: 0 },
  { label: '4px', radius: 4 },
  { label: '10px', radius: 10 },
  { label: '18px', radius: 18 },
];

function SelectionDemo() {
  const c = useThemeColors();
  const [shapeIdx, setShapeIdx] = useState(0);
  const [opIdx, setOpIdx]       = useState(0);
  const [featherIdx, setFeatherIdx] = useState(0);
  const [resultSrc, setResultSrc] = useState('');
  const [status, setStatus]     = useState('pick a shape + op then press Apply');
  const [busy, setBusy]         = useState(false);

  const { apply } = useImaging();
  const { rasterize } = useImagingSelection();

  const doApply = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('rasterizing…');

    const shapeEntry = SELECTION_SHAPES[shapeIdx];
    const opEntry    = SELECTION_OPS[opIdx];
    const feather    = SELECTION_FEATHERS[featherIdx];

    let maskId: string | null = null;
    if (shapeEntry.shape) {
      maskId = await rasterize(260, 180, [shapeEntry.shape], { featherRadius: feather.radius });
      if (!maskId) {
        setStatus('rasterize failed');
        setBusy(false);
        return;
      }
      setStatus('applying ops…');
    }

    const nonce  = `${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const output = `imaging_sel_${nonce}.png`;

    const result = await apply({
      src: 'lib/placeholders/landscape.png',
      operations: opEntry.ops,
      output,
      maskId: maskId || undefined,
    });

    if (result?.ok) {
      setResultSrc(output);
      setStatus(`${shapeEntry.label} -> ${opEntry.label} (${feather.label})`);
    } else {
      setStatus(result?.error || 'apply failed');
    }
    setBusy(false);
  };

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="selection" color={C.selection} />
        <Tag text="rasterize" color={C.selection} />
        <Tag text="maskId" color={C.selection} />
        <Tag text="feather" color={C.selection} />
      </S.RowG6>

      {resultSrc ? (
        <ImagingPreview src={resultSrc} ops={[]} width={260} height={180} />
      ) : (
        <S.Center style={{ width: 260, height: 180, borderRadius: 6, borderWidth: 1, borderColor: c.border }}>
          <S.StoryMuted>{'press Apply to render'}</S.StoryMuted>
        </S.Center>
      )}

      <Label label="status" value={status} color={C.selection} />
      <Label
        label="edge"
        value={shapeIdx === (SELECTION_SHAPES.length - 1) ? 'full frame' : `${SELECTION_FEATHERS[featherIdx].radius}px feather`}
      />

      <S.StoryCap>{'Shape'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {SELECTION_SHAPES.map((s, i) => (
          <ActionBtn key={s.label} label={s.label} color={C.selection} active={i === shapeIdx} onPress={() => setShapeIdx(i)} />
        ))}
      </Box>

      <S.StoryCap>{'Feather'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {SELECTION_FEATHERS.map((entry, i) => (
          <ActionBtn key={entry.label} label={entry.label} color={C.selection} active={i === featherIdx} onPress={() => setFeatherIdx(i)} />
        ))}
      </Box>

      <S.StoryCap>{'Operation'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {SELECTION_OPS.map((op, i) => (
          <ActionBtn key={op.label} label={op.label} color={C.selection} active={i === opIdx} onPress={() => setOpIdx(i)} />
        ))}
      </Box>

      <ActionBtn label={busy ? 'Working…' : 'Apply'} color={C.selection} active={false} onPress={doApply} />
    </S.CenterW100>
  );
}

// ── Demo 8: Draw Canvas ───────────────────────────────────

const DC_W = 260;
const DC_H = 180;

type BrushColor = { label: string; rgba: [number, number, number, number] };
const BRUSH_COLORS: BrushColor[] = [
  { label: 'Red',    rgba: [0.95, 0.2,  0.15, 1] },
  { label: 'Green',  rgba: [0.2,  0.85, 0.3,  1] },
  { label: 'Blue',   rgba: [0.2,  0.4,  0.95, 1] },
  { label: 'Orange', rgba: [0.95, 0.55, 0.1,  1] },
  { label: 'White',  rgba: [1,    1,    1,    1] },
];

type StrokePreset = { label: string; points: [number, number][][] };
const STROKE_PRESETS: StrokePreset[] = [
  {
    label: 'Diagonal',
    points: [[[10, 10], [DC_W - 10, DC_H - 10]]],
  },
  {
    label: 'X',
    points: [
      [[10, 10], [DC_W - 10, DC_H - 10]],
      [[DC_W - 10, 10], [10, DC_H - 10]],
    ],
  },
  {
    label: 'Zigzag',
    points: [[[0, DC_H * 0.5], [DC_W * 0.25, DC_H * 0.15], [DC_W * 0.5, DC_H * 0.5], [DC_W * 0.75, DC_H * 0.85], [DC_W, DC_H * 0.5]]],
  },
  {
    label: 'Dots',
    points: [
      [[40,  45], [40,  45]],
      [[130, 45], [130, 45]],
      [[220, 45], [220, 45]],
      [[85,  90], [85,  90]],
      [[175, 90], [175, 90]],
      [[40,  135], [40,  135]],
      [[130, 135], [130, 135]],
      [[220, 135], [220, 135]],
    ],
  },
];

function DrawCanvasDemo() {
  const c = useThemeColors();
  const dc = useDrawCanvas(DC_W, DC_H);
  const [colorIdx, setColorIdx]  = useState(0);
  const [brushSize, setBrushSize] = useState(8);
  const [status, setStatus]      = useState('canvas ready');

  const doPaint = async (preset: StrokePreset) => {
    const color = BRUSH_COLORS[colorIdx].rgba;
    setStatus(`painting ${preset.label}…`);
    for (const pts of preset.points) {
      await dc.paint(pts, color, brushSize);
    }
    setStatus(`drew ${preset.label}`);
  };

  const doErase = async () => {
    setStatus('erasing center…');
    const cx = DC_W * 0.5;
    const cy = DC_H * 0.5;
    await dc.erase([[cx - 40, cy], [cx + 40, cy], [cx, cy - 30], [cx, cy + 30]], 24);
    setStatus('erased');
  };

  const doClear = async () => {
    await dc.clear();
    setStatus('cleared');
  };

  const doFill = async () => {
    const color = BRUSH_COLORS[colorIdx].rgba;
    setStatus('flood fill top-left…');
    await dc.fill(5, 5, color, 0.1);
    setStatus('filled');
  };

  const SIZE_OPTS = [4, 8, 16, 28];

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="DrawCanvas" color={C.canvas} />
        <Tag text="canvas:paint" color={C.canvas} />
        <Tag text="canvas:erase" color={C.canvas} />
        <Tag text="canvas:fill" color={C.canvas} />
      </S.RowG6>

      <Native
        type="DrawCanvas"
        canvasId={dc.canvasId}
        width={DC_W}
        height={DC_H}
        background="transparent"
        style={{ width: DC_W, height: DC_H, borderRadius: 6, borderWidth: 1, borderColor: c.border }}
      />

      <Label label="status" value={status} color={C.canvas} />
      <Label label="canvasId" value={dc.canvasId} />

      <S.StoryCap>{'Color'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {BRUSH_COLORS.map((col, i) => (
          <ActionBtn key={col.label} label={col.label} color={C.canvas} active={i === colorIdx} onPress={() => setColorIdx(i)} />
        ))}
      </Box>

      <S.StoryCap>{'Brush Size'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {SIZE_OPTS.map(s => (
          <ActionBtn key={`${s}`} label={`${s}px`} color={C.canvas} active={s === brushSize} onPress={() => setBrushSize(s)} />
        ))}
      </Box>

      <S.StoryCap>{'Stroke Presets'}</S.StoryCap>
      <Box style={DEMO_ACTION_ROW_STYLE}>
        {STROKE_PRESETS.map(p => (
          <ActionBtn key={p.label} label={p.label} color={C.canvas} active={false} onPress={() => doPaint(p)} />
        ))}
      </Box>

      <Box style={DEMO_ACTION_ROW_STYLE}>
        <ActionBtn label="Erase Center" color={C.canvas} active={false} onPress={doErase} />
        <ActionBtn label="Fill Corner"  color={C.canvas} active={false} onPress={doFill} />
        <ActionBtn label="Clear"        color={C.canvas} active={false} onPress={doClear} />
      </Box>
    </S.CenterW100>
  );
}

// ── Feature Catalog ──────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  const features = [
    { label: 'brightness', desc: 'Add/subtract luminance. Range: -1 to 1.', color: C.color },
    { label: 'contrast', desc: 'Scale around midpoint. 1 = no change, 2 = double.', color: C.color },
    { label: 'levels', desc: 'Histogram remapping: input range, gamma, output range.', color: C.color },
    { label: 'curves', desc: 'Piecewise linear tone curve (up to 16 control points).', color: C.color },
    { label: 'hue_saturation', desc: 'Shift hue (degrees), scale saturation and value.', color: C.color },
    { label: 'invert', desc: 'Negate RGB channels. Preserves alpha.', color: C.color },
    { label: 'threshold', desc: 'Binary black/white based on luminance cutoff.', color: C.color },
    { label: 'posterize', desc: 'Reduce to N color levels per channel.', color: C.color },
    { label: 'desaturate', desc: 'Grayscale via luminosity, average, or lightness.', color: C.color },
    { label: 'colorize', desc: 'Apply uniform hue+saturation to grayscale values.', color: C.color },
    { label: 'channel_mixer', desc: '3x3 matrix multiplication on RGB channels.', color: C.color },
    { label: 'gradient_map', desc: 'Map luminosity to a color gradient.', color: C.color },
    { label: 'gaussian_blur', desc: 'Two-pass separable blur. O(n) per pixel.', color: C.filter },
    { label: 'box_blur', desc: 'Uniform-weight separable blur. Fast.', color: C.filter },
    { label: 'motion_blur', desc: 'Directional blur along an angle.', color: C.filter },
    { label: 'sharpen', desc: 'Unsharp mask: original + gain \u00d7 (original - blur).', color: C.filter },
    { label: 'edge_detect', desc: 'Sobel or Laplacian convolution kernels.', color: C.filter },
    { label: 'emboss', desc: 'Directional relief. Angle controls light direction.', color: C.filter },
    { label: 'pixelize', desc: 'Mosaic effect — sample from block centers.', color: C.filter },
    { label: 'blend (16 modes)', desc: 'Multiply, screen, overlay, dodge, burn, difference, hue, etc.', color: C.blend },
    { label: 'selection feather', desc: 'Soft-edge grayscale masks for GIMP-style localized edits.', color: C.selection },
  ];
  return (
    <>
      {features.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <S.StoryBody style={{ fontWeight: 'normal', width: 120 }}>{f.label}</S.StoryBody>
          <S.SecondaryBody>{f.desc}</S.SecondaryBody>
        </S.RowCenterG8>
      ))}
    </>
  );
}

// ── ImagingStory ─────────────────────────────────────────

export function ImagingStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="image" tintColor={C.accent} />
        <S.StoryTitle>
          {'Imaging'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/imaging'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'35 ops \u00b7 GPU-accelerated'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'GIMP-style image processing. In Lua. On the GPU.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'12 color adjustments, 7 filters, 16 blend modes. Chainable pipeline with lazy evaluation. GLSL shaders by default, ImageData CPU fallback when needed. Every operation produces a new Canvas \u2014 the original is never modified.'}
          </S.StoryMuted>
        </HeroBand>

        <Divider />

        {/* ── Install: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'The Lua library (lua/imaging/) works standalone \u2014 no React needed. Import @reactjit/imaging for hooks, or use <Native type="Imaging"> for inline visual processing.'}
            </S.StoryBody>
          </Half>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={INSTALL_CODE} />
        </Band>

        <Divider />

        {/* ── Color Adjustments: demo | text + code ── */}
        <Band>
          <Half>
            <ColorDemo />
          </Half>
          <Half>
            <SectionLabel icon="palette" accentColor={C.accent}>{'COLOR ADJUSTMENTS'}</SectionLabel>
            <S.StoryBody>
              {'12 per-pixel operations, all as GLSL fragment shaders. Each runs in microseconds even on large images. Click the presets to see them applied live to the landscape photo.'}
            </S.StoryBody>
            <CodeBlock language="lua" fontSize={9} style={{ width: '100%' }} code={COLOR_OPS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Filters: text + code | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'FILTERS'}</SectionLabel>
            <S.StoryBody>
              {'7 spatial filters. Gaussian blur uses two-pass separable convolution \u2014 O(n) per pixel instead of O(n\u00b2). Sharpen is unsharp mask: amplify the difference from a blurred copy. Edge detection uses Sobel or Laplacian convolution kernels.'}
            </S.StoryBody>
            <CodeBlock language="lua" fontSize={9} style={{ width: '100%' }} code={FILTER_OPS_CODE} />
          </Half>
          <Half>
            <FilterDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'All processing runs in Lua + GLSL. The pipeline compiles shaders once (cached), renders to off-screen Canvases, and composites the result at the node\u2019s position. React just declares the pipeline \u2014 zero pixel work crosses the bridge.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Pipeline Chaining: demo | text + code ── */}
        <Band>
          <Half>
            <PipelineDemo />
          </Half>
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'PIPELINE CHAINING'}</SectionLabel>
            <S.StoryBody>
              {'Chain multiple operations for creative effects. Vintage = desaturate + colorize + contrast boost. Neon Edge = edge detect + invert + hue shift. Thermal = desaturate + gradient map. Each preset demonstrates real multi-op pipelines.'}
            </S.StoryBody>
            <CodeBlock language="lua" fontSize={9} style={{ width: '100%' }} code={PIPELINE_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Test Pattern: text | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.accent}>{'TEST PATTERN'}</SectionLabel>
            <S.StoryBody>
              {'Omit the src prop to get a procedural test pattern with color bars, grayscale gradient, and HSV hue sweep. Useful for verifying color operations \u2014 levels, curves, channel mixer, and gradient map are immediately visible on known input.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={REACT_CODE} />
          </Half>
          <Half>
            <PatternDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Blend Modes: text + code | info ── */}
        <Band>
          <Half>
            <SectionLabel icon="combine" accentColor={C.accent}>{'BLEND MODES'}</SectionLabel>
            <S.StoryBody>
              {'16 Photoshop/GIMP-standard blend modes in a single parameterized GLSL shader. Composites two canvases with configurable opacity. Pass a Canvas or Image as the layer argument.'}
            </S.StoryBody>
            <CodeBlock language="lua" fontSize={9} style={{ width: '100%' }} code={BLEND_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="cpu" accentColor={C.accent}>{'HYBRID COMPUTE'}</SectionLabel>
            <S.StoryBody>
              {'Every operation has a GPU path (GLSL shader) and can have a CPU path (ImageData). GPU runs by default. Register custom operations with Imaging.registerOp() \u2014 provide gpu, cpu, or both.'}
            </S.StoryBody>
            <CodeBlock language="lua" fontSize={9} style={{ width: '100%' }} code={CUSTOM_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Layer Graph: demo | text + code ── */}
        <Band>
          <Half>
            <LayerGraphDemo />
          </Half>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'LAYER GRAPH LAB'}</SectionLabel>
            <S.StoryBody>
              {'Early non-destructive composition pass: stack layers, set per-layer blend and opacity, then compose through imaging:compose. This section also dogfoods undo/redo history snapshots.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={LAYER_GRAPH_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Layer Transform: text + code | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'LAYER TRANSFORM LAB'}</SectionLabel>
            <S.StoryBody>
              {'Per-layer transform pass in compose: crop source pixels, define pivot, then scale and rotate before blend. This stays non-destructive and works with undo/redo snapshots.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={TRANSFORM_GRAPH_CODE} />
          </Half>
          <Half>
            <LayerTransformDemo />
          </Half>
        </Band>

        <Divider />

        <Divider />

        {/* ── Selection Lab: demo | text + code ── */}
        <Band>
          <Half>
            <SelectionDemo />
          </Half>
          <Half>
            <SectionLabel icon="crop" accentColor={C.accent}>{'SELECTION LAB'}</SectionLabel>
            <S.StoryBody>
              {'Pick a shape, feather radius, and operation, then press Apply. The selection is rasterized to a grayscale mask canvas in Lua memory, optionally blurred for soft edges, and reused as a weight map: mix(original, processed, mask.r). This pushes the package closer to GIMP-style localized edits instead of only hard-edged marquee cuts.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SELECTION_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Draw Canvas Lab: text + code | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="edit" accentColor={C.accent}>{'DRAW CANVAS LAB'}</SectionLabel>
            <S.StoryBody>
              {'A mutable Love2D Canvas owned by a capability. React declares it with <Native type="DrawCanvas">; useDrawCanvas() hook sends strokes, erases, and fills via bridge RPCs. All rendering happens on the GPU side — only coordinates cross the bridge. The live canvas can also be composed as a layer via drawCanvasId in the imaging layer graph.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={DRAW_CANVAS_CODE} />
          </Half>
          <Half>
            <DrawCanvasDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Feature catalog ── */}
        <S.StoryFullBand>
          <SectionLabel icon="terminal" accentColor={C.accent}>{'API SURFACE'}</SectionLabel>
          <FeatureCatalog />
        </S.StoryFullBand>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="image" />
        <S.StoryBreadcrumbActive>{'Imaging'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
