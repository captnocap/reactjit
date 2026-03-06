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

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, Native } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

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
    <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Text style={{ color: c.textDim, fontSize: 9 }}>{label}</Text>
      <Text style={{ color: color || c.text, fontSize: 9, fontFamily: 'monospace' }}>{value}</Text>
    </Box>
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
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Tag text="brightness" color={C.color} />
        <Tag text="contrast" color={C.color} />
        <Tag text="invert" color={C.color} />
        <Tag text="hue_saturation" color={C.color} />
      </Box>

      <ImagingPreview
        src="lib/placeholders/landscape.png"
        ops={preset.ops}
      />

      <Label label="operation" value={preset.label} color={C.color} />
      <Label label="pipeline" value={preset.ops.length === 0 ? 'passthrough' : JSON.stringify(preset.ops[0])} />

      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
    </Box>
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
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Tag text="gaussian_blur" color={C.filter} />
        <Tag text="edge_detect" color={C.filter} />
        <Tag text="sharpen" color={C.filter} />
        <Tag text="pixelize" color={C.filter} />
      </Box>

      <ImagingPreview
        src="lib/placeholders/landscape.png"
        ops={preset.ops}
      />

      <Label label="filter" value={preset.label} color={C.filter} />
      {preset.ops.length > 0 && (
        <Label label="params" value={JSON.stringify(preset.ops[0])} />
      )}

      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
    </Box>
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
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Tag text="pipeline" color={C.pipeline} />
        <Tag text={`${preset.ops.length} ops`} color={C.pipeline} />
      </Box>

      <ImagingPreview
        src="lib/placeholders/landscape.png"
        ops={preset.ops}
      />

      <Label label="preset" value={preset.label} color={C.pipeline} />
      <Label label="chain" value={preset.ops.map(o => o.op).join(' \u2192 ') || 'none'} />

      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
    </Box>
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
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Tag text="test pattern" color={C.pattern} />
        <Tag text="no source file" color={C.pattern} />
      </Box>

      <ImagingPreview ops={preset.ops} />

      <Label label="effect" value={preset.label} color={C.pattern} />
      <Text style={{ fontSize: 9, color: c.textDim }}>
        {'Omit src to get a procedural test pattern — color bars, grayscale gradient, and HSV sweep'}
      </Text>

      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
    </Box>
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
  ];
  return (
    <>
      {features.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 120 }}>{f.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{f.desc}</Text>
        </Box>
      ))}
    </>
  );
}

// ── ImagingStory ─────────────────────────────────────────

export function ImagingStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="image" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Imaging'}
        </Text>
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
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'35 ops \u00b7 GPU-accelerated'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'GIMP-style image processing. In Lua. On the GPU.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'12 color adjustments, 7 filters, 16 blend modes. Chainable pipeline with lazy evaluation. GLSL shaders by default, ImageData CPU fallback when needed. Every operation produces a new Canvas \u2014 the original is never modified.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── Install: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The Lua library (lua/imaging/) works standalone \u2014 no React needed. Import @reactjit/imaging for hooks, or use <Native type="Imaging"> for inline visual processing.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Band>

        <Divider />

        {/* ── Color Adjustments: demo | text + code ── */}
        <Band>
          <Half>
            <ColorDemo />
          </Half>
          <Half>
            <SectionLabel icon="palette" accentColor={C.accent}>{'COLOR ADJUSTMENTS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'12 per-pixel operations, all as GLSL fragment shaders. Each runs in microseconds even on large images. Click the presets to see them applied live to the landscape photo.'}
            </Text>
            <CodeBlock language="lua" fontSize={9} code={COLOR_OPS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Filters: text + code | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'FILTERS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'7 spatial filters. Gaussian blur uses two-pass separable convolution \u2014 O(n) per pixel instead of O(n\u00b2). Sharpen is unsharp mask: amplify the difference from a blurred copy. Edge detection uses Sobel or Laplacian convolution kernels.'}
            </Text>
            <CodeBlock language="lua" fontSize={9} code={FILTER_OPS_CODE} />
          </Half>
          <Half>
            <FilterDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'All processing runs in Lua + GLSL. The pipeline compiles shaders once (cached), renders to off-screen Canvases, and composites the result at the node\u2019s position. React just declares the pipeline \u2014 zero pixel work crosses the bridge.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Pipeline Chaining: demo | text + code ── */}
        <Band>
          <Half>
            <PipelineDemo />
          </Half>
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'PIPELINE CHAINING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Chain multiple operations for creative effects. Vintage = desaturate + colorize + contrast boost. Neon Edge = edge detect + invert + hue shift. Thermal = desaturate + gradient map. Each preset demonstrates real multi-op pipelines.'}
            </Text>
            <CodeBlock language="lua" fontSize={9} code={PIPELINE_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Test Pattern: text | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.accent}>{'TEST PATTERN'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Omit the src prop to get a procedural test pattern with color bars, grayscale gradient, and HSV hue sweep. Useful for verifying color operations \u2014 levels, curves, channel mixer, and gradient map are immediately visible on known input.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={REACT_CODE} />
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'16 Photoshop/GIMP-standard blend modes in a single parameterized GLSL shader. Composites two canvases with configurable opacity. Pass a Canvas or Image as the layer argument.'}
            </Text>
            <CodeBlock language="lua" fontSize={9} code={BLEND_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="cpu" accentColor={C.accent}>{'HYBRID COMPUTE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Every operation has a GPU path (GLSL shader) and can have a CPU path (ImageData). GPU runs by default. Register custom operations with Imaging.registerOp() \u2014 provide gpu, cpu, or both.'}
            </Text>
            <CodeBlock language="lua" fontSize={9} code={CUSTOM_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Feature catalog ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 8,
        }}>
          <SectionLabel icon="terminal" accentColor={C.accent}>{'API SURFACE'}</SectionLabel>
          <FeatureCatalog />
        </Box>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="image" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Imaging'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
