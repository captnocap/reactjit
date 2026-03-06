/**
 * Imaging — GIMP-style image processing in Lua + GLSL.
 *
 * Color adjustments, filters, blend modes — all GPU-accelerated.
 * Lua does the pixel work, React declares the pipeline.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, Slider } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useImaging, useBlendModes }
  from '@reactjit/imaging'`;

const LUA_PIPELINE_CODE = `local Imaging = require("lua.imaging")

-- Chain operations (lazy — execute on :apply())
local result = Imaging.from("photo.jpg")
  :brightness(0.2)
  :contrast(1.3)
  :gaussianBlur(3)
  :apply()

-- Save to file
Imaging.save(result, "output.png")`;

const REACT_HOOK_CODE = `const { apply, processing, error }
  = useImaging()

apply([
  { op: 'brightness', amount: 0.2 },
  { op: 'contrast', factor: 1.3 },
  { op: 'gaussian_blur', radius: 3 },
])`;

const REACT_COMPONENT_CODE = `<Imaging
  src="photo.jpg"
  operations={[
    { op: 'hue_saturation', hue: 30,
      saturation: 1.2 },
    { op: 'sharpen', amount: 0.8 },
  ]}
  onComplete={({ width, height }) =>
    console.log(\`Done: \${width}x\${height}\`)
  }
  onError={({ message }) =>
    console.error(message)
  }
/>`;

const COLOR_OPS_CODE = `// 12 color adjustment operations
:brightness(amount)       // -1 to 1
:contrast(factor)         // 0.5 to 3
:levels(inB, inW, gamma, outB, outW)
:curves([[0,0], [0.5,0.7], [1,1]])
:hueSaturation(hue, sat, val)
:invert()
:threshold(0.5)           // binary B&W
:posterize(4)             // reduce colors
:desaturate("luminosity") // grayscale
:colorize(180, 0.5, 0)    // tint
:channelMixer(matrix3x3)
:gradientMap(gradient)     // tone map`;

const FILTER_OPS_CODE = `// 7 spatial filter operations
:gaussianBlur(radius)     // soft blur
:boxBlur(radius)          // fast blur
:motionBlur(angle, dist)  // directional
:sharpen(amount)          // unsharp mask
:edgeDetect("sobel")      // or "laplacian"
:emboss(angle, depth)     // relief
:pixelize(blockSize)      // mosaic`;

const BLEND_MODES_CODE = `// 16 blend modes — all GPU shaders
:blend("multiply", layer)
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

const HYBRID_CODE = `-- GPU shaders by default, CPU fallback
-- Each op has: { gpu = fn, cpu = fn }
-- Pipeline tries GPU first, falls back
-- to ImageData for complex ops

-- Manual CPU-only:
local data = Imaging.toImageData(canvas)
data:mapPixel(function(x, y, r, g, b, a)
  return r, g * 0.5, b, a  -- custom
end)

-- Register custom operations:
Imaging.registerOp("my_filter", {
  gpu = function(canvas, w, h, params)
    -- GLSL shader path
  end,
  cpu = function(canvas, w, h, params)
    -- ImageData pixel path
  end,
})`;

// ── Shared styles ────────────────────────────────────────

const bandStyle = {
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const halfStyle = {
  flexGrow: 1,
  flexBasis: 0,
  gap: 8,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

// ── Section helpers ──────────────────────────────────────

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
  );
}

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, backgroundColor: c.border }} />;
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <Box style={{
      backgroundColor: color + '20',
      borderRadius: 4,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
    }}>
      <Text style={{ color, fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

// ── Operation categories overview ────────────────────────

function OpCategoryGrid() {
  const c = useThemeColors();
  const categories = [
    { name: 'Color', count: '12 ops', color: C.peach, desc: 'Brightness, contrast, levels, curves, hue/sat, invert, threshold, posterize, desaturate, colorize, channel mixer, gradient map' },
    { name: 'Filters', count: '7 ops', color: C.blue, desc: 'Gaussian blur, box blur, motion blur, sharpen, edge detect, emboss, pixelize' },
    { name: 'Blend', count: '16 modes', color: C.mauve, desc: 'Normal, multiply, screen, overlay, soft/hard light, dodge, burn, difference, exclusion, add, subtract, hue, sat, color, value' },
  ];

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      {categories.map(cat => (
        <Box key={cat.name} style={{
          backgroundColor: c.surface,
          borderRadius: 8,
          padding: 10,
          gap: 4,
          borderLeftWidth: 3,
          borderColor: cat.color,
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: cat.color, fontSize: 11, fontWeight: 'bold' }}>{cat.name}</Text>
            <Chip label={cat.count} color={cat.color} />
          </Box>
          <Text style={{ color: c.muted, fontSize: 9 }}>{cat.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Blend mode visual reference ──────────────────────────

function BlendModeGrid() {
  const c = useThemeColors();
  const modes = [
    { name: 'multiply', formula: 'a × b', group: 'darken' },
    { name: 'screen', formula: '1-(1-a)(1-b)', group: 'lighten' },
    { name: 'overlay', formula: 'conditional', group: 'contrast' },
    { name: 'soft_light', formula: 'Pegtop', group: 'contrast' },
    { name: 'hard_light', formula: 'swap overlay', group: 'contrast' },
    { name: 'dodge', formula: 'a/(1-b)', group: 'lighten' },
    { name: 'burn', formula: '1-(1-a)/b', group: 'darken' },
    { name: 'difference', formula: '|a-b|', group: 'inversion' },
    { name: 'exclusion', formula: 'a+b-2ab', group: 'inversion' },
    { name: 'hue', formula: 'HSV hue', group: 'component' },
    { name: 'saturation', formula: 'HSV sat', group: 'component' },
    { name: 'color', formula: 'HSV h+s', group: 'component' },
    { name: 'value', formula: 'HSV val', group: 'component' },
  ];

  const groupColors: Record<string, string> = {
    darken: C.red,
    lighten: C.yellow,
    contrast: C.peach,
    inversion: C.blue,
    component: C.mauve,
  };

  return (
    <Box style={{ gap: 4, width: '100%' }}>
      {modes.map(m => (
        <Box key={m.name} style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
          borderRadius: 4,
          backgroundColor: c.surface,
        }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: groupColors[m.group] || C.accent }} />
          <Text style={{ color: c.text, fontSize: 9, minWidth: 70 }}>{m.name}</Text>
          <Text style={{ color: c.muted, fontSize: 8 }}>{m.formula}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Architecture diagram ─────────────────────────────────

function ArchDiagram() {
  const c = useThemeColors();
  const layers = [
    { label: 'React', desc: '<Imaging> component + useImaging() hook', color: C.blue },
    { label: 'Capability', desc: 'capabilities/imaging.lua — lifecycle + RPC', color: C.mauve },
    { label: 'Pipeline', desc: 'imaging/pipeline.lua — lazy chaining + apply', color: C.peach },
    { label: 'Operations', desc: 'ops/color.lua, filter.lua, blend.lua', color: C.green },
    { label: 'GPU / CPU', desc: 'GLSL shaders (default) | ImageData fallback', color: C.teal },
  ];

  return (
    <Box style={{ gap: 2, width: '100%' }}>
      {layers.map((l, i) => (
        <Box key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Box style={{
            width: 50,
            backgroundColor: l.color + '30',
            borderRadius: 4,
            padding: 4,
            alignItems: 'center',
          }}>
            <Text style={{ color: l.color, fontSize: 8, fontWeight: 'bold' }}>{l.label}</Text>
          </Box>
          {i < layers.length - 1 && (
            <Text style={{ color: c.muted, fontSize: 8 }}>{'→'}</Text>
          )}
          <Text style={{ color: c.muted, fontSize: 8, flexShrink: 1 }}>{l.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Main Story ───────────────────────────────────────────

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
          {'35 operations \u00b7 GPU-accelerated'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'GIMP-style image processing. In Lua. On the GPU.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'12 color adjustments, 7 filters, 16 blend modes. Chainable pipeline with lazy evaluation. GLSL shaders by default, ImageData CPU fallback when needed. Extend with custom operations.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: text + overview | code — INSTALL ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The Lua library (lua/imaging/) works standalone — no React needed. The @reactjit/imaging package adds hooks for React integration.'}
            </Text>
            <OpCategoryGrid />
          </Box>
          <Box style={{ ...halfStyle }}>
            <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
            <ArchDiagram />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 2: code | text — LUA PIPELINE ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <CodeBlock language="lua" fontSize={9} code={LUA_PIPELINE_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="code">{'LUA PIPELINE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Load an image, chain operations, call :apply(). Operations are lazy — nothing runs until apply. Each step produces a new Canvas, so the original is never modified.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Imaging.from() loads the file into a Canvas. fromCanvas() and fromImageData() wrap existing data. Pipeline:preview(0.5) runs at half resolution for real-time feedback.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: text | code — REACT HOOK ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="zap">{'REACT HOOK'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useImaging() returns apply(), processing flag, and error state. Pass an array of operations — each is { op: name, ...params }.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Under the hood, the hook sends the operation list to Lua via bridge RPC. The Lua capability runs the pipeline and fires onComplete/onError events back.'}
            </Text>
          </Box>
          <Box style={{ ...halfStyle }}>
            <CodeBlock language="tsx" fontSize={9} code={REACT_HOOK_CODE} />
            <CodeBlock language="tsx" fontSize={9} code={REACT_COMPONENT_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 4: code | text — COLOR ADJUSTMENTS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <CodeBlock language="lua" fontSize={9} code={COLOR_OPS_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="palette">{'COLOR ADJUSTMENTS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'12 per-pixel color operations, all as GLSL fragment shaders. Embarrassingly parallel — runs in microseconds even on large images.'}
            </Text>
            <Box style={{ gap: 4, width: '100%' }}>
              <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                <Chip label="brightness" color={C.peach} />
                <Chip label="contrast" color={C.peach} />
                <Chip label="levels" color={C.peach} />
                <Chip label="curves" color={C.peach} />
                <Chip label="hue/sat" color={C.yellow} />
                <Chip label="invert" color={C.blue} />
                <Chip label="threshold" color={C.blue} />
                <Chip label="posterize" color={C.blue} />
                <Chip label="desaturate" color={C.mauve} />
                <Chip label="colorize" color={C.mauve} />
                <Chip label="channel mixer" color={C.teal} />
                <Chip label="gradient map" color={C.teal} />
              </Box>
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 5: text | code — FILTERS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="layers">{'FILTERS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'7 spatial filter operations. Blur uses two-pass separable convolution — O(n) per pixel instead of O(n\u00b2). Sharpen is unsharp mask (original + gain \u00d7 difference from blur).'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Edge detect supports Sobel (gradient magnitude) and Laplacian (second derivative). Emboss is directional — angle controls the light direction. Pixelize samples from block centers.'}
            </Text>
          </Box>
          <Box style={{ ...halfStyle }}>
            <CodeBlock language="lua" fontSize={9} code={FILTER_OPS_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 6: blend grid | code — BLEND MODES ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <BlendModeGrid />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="combine">{'BLEND MODES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'16 Photoshop/GIMP-standard blend modes in a single parameterized GLSL shader. Composites two canvases with configurable opacity.'}
            </Text>
            <CodeBlock language="lua" fontSize={9} code={BLEND_MODES_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: text | code — HYBRID COMPUTE ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="cpu">{'HYBRID COMPUTE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Every operation has a GPU path (GLSL shader) and can have a CPU path (ImageData pixel manipulation). GPU runs by default. CPU kicks in as fallback or for operations that need per-pixel logic GLSL can\'t express.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Register custom operations with Imaging.registerOp(). Provide gpu, cpu, or both. The pipeline picks the best path automatically.'}
            </Text>
            <Box style={{
              backgroundColor: C.callout,
              borderLeftWidth: 2,
              borderColor: C.calloutBorder,
              borderRadius: 4,
              padding: 8,
              gap: 4,
            }}>
              <Text style={{ color: C.blue, fontSize: 9, fontWeight: 'bold' }}>{'Extensibility'}</Text>
              <Text style={{ color: c.muted, fontSize: 9 }}>
                {'This is the base layer. Flood fill, selections, brushes, layers — all can be added as new operations on top. The pipeline and shader cache handle the plumbing.'}
              </Text>
            </Box>
          </Box>
          <Box style={{ ...halfStyle }}>
            <CodeBlock language="lua" fontSize={9} code={HYBRID_CODE} />
          </Box>
        </Box>

        {/* Bottom spacer */}
        <Box style={{ height: 40 }} />

      </ScrollView>
    </Box>
  );
}
