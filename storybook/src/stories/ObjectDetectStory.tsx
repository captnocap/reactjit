/**
 * Object Detection — foreground segmentation + background replacement demo.
 *
 * Uses GPU-accelerated edge-aware color distance segmentation to separate
 * the robot (avatar.png) from its background, then composites it onto
 * the mountain landscape (landscape.png).
 *
 * All compute runs in Lua/GLSL. React just declares the layout and buttons.
 */

import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, Native, CodeBlock, classifiers as S } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useObjectDetect, useImaging } from '../../../packages/imaging/src';
import type { DetectForegroundParams } from '../../../packages/imaging/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#06b6d4',
  accentDim: 'rgba(6, 182, 212, 0.12)',
  callout: 'rgba(6, 182, 212, 0.06)',
  calloutBorder: 'rgba(6, 182, 212, 0.30)',
  detect: '#22d3ee',
  mask: '#a78bfa',
  composite: '#34d399',
  param: '#fbbf24',
};

// ── Static images ────────────────────────────────────────

const FG_SRC = 'lib/placeholders/avatar.png';
const BG_SRC = 'lib/placeholders/landscape.png';
const OUTPUT_PATH = 'object_detect_result.png';

// ── Code samples ─────────────────────────────────────────

const HOOK_CODE = `import { useObjectDetect }
  from '@reactjit/imaging'

const { detectForeground,
        compositeBackground,
        releaseMask } = useObjectDetect();

// Step 1: detect
const det = await detectForeground(
  'avatar.png'
);

// Step 2: composite
await compositeBackground(
  'avatar.png',
  'landscape.png',
  det.maskId,
  'output.png'
);

// Step 3: cleanup
await releaseMask(det.maskId);`;

const LUA_CODE = `local Detect = require("lua.imaging.ops.detect")
local Imaging = require("lua.imaging")

-- Load source
local img = love.graphics.newImage("avatar.png")
local canvas = love.graphics.newCanvas(
  img:getWidth(), img:getHeight()
)
-- ... draw img to canvas ...

-- Detect foreground -> grayscale mask
local mask = Detect.detectForeground(canvas, {
  threshold = 0.25,
  edgeWeight = 0.8,
  featherRadius = 4,
})

-- Composite with new background
local bg = love.graphics.newImage("landscape.png")
local bgCanvas = -- ... load to canvas ...
local result = Detect.compositeBackground(
  canvas, bgCanvas, mask
)`;

// ── Param presets ────────────────────────────────────────

interface Preset {
  label: string;
  icon: string;
  params: DetectForegroundParams;
}

const PRESETS: Preset[] = [
  {
    label: 'Auto',
    icon: 'A',
    params: {},
  },
  {
    label: 'Tight',
    icon: 'T',
    params: { threshold: 0.15, softness: 0.04, morphRadius: 3, featherRadius: 2, edgeWeight: 1.0 },
  },
  {
    label: 'Soft',
    icon: 'S',
    params: { threshold: 0.25, softness: 0.12, morphRadius: 2, featherRadius: 6, edgeWeight: 0.5 },
  },
  {
    label: 'Wide',
    icon: 'W',
    params: { threshold: 0.35, softness: 0.15, morphRadius: 1, featherRadius: 4, edgeWeight: 0.3 },
  },
];

// ── Styles (hoisted) ─────────────────────────────────────

const S_ROOT = { width: '100%' as const, height: '100%' as const };
const S_HEADER = { paddingTop: 32, paddingBottom: 16, paddingLeft: 24, paddingRight: 24, alignItems: 'center' as const };
const S_TITLE = { fontSize: 28, fontWeight: 'bold' as const };
const S_SUBTITLE = { fontSize: 14, marginTop: 4 };
const S_PREVIEW_ROW = { flexDirection: 'row' as const, gap: 12, justifyContent: 'center' as const, paddingLeft: 16, paddingRight: 16 };
const S_PREVIEW_BOX = { borderRadius: 8, overflow: 'hidden' as const };
const S_PREVIEW_LABEL = { fontSize: 11, textAlign: 'center' as const, marginTop: 4, marginBottom: 2 };
const S_IMG = { width: 220, height: 220 };
const S_RESULT_IMG = { width: 280, height: 280 };
const S_ACTIONS = { flexDirection: 'row' as const, gap: 8, justifyContent: 'center' as const, paddingTop: 12, paddingBottom: 12 };
const S_BTN = { paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8 };
const S_BTN_TXT = { fontSize: 13, fontWeight: 'bold' as const };
const S_PRESETS = { flexDirection: 'row' as const, gap: 6, justifyContent: 'center' as const, paddingBottom: 8 };
const S_PRESET_BTN = { paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 6 };
const S_PRESET_TXT = { fontSize: 12 };
const S_STATUS = { fontSize: 12, textAlign: 'center' as const, paddingTop: 4, paddingBottom: 8 };
const S_RESULT_WRAP = { alignItems: 'center' as const, paddingTop: 8, paddingBottom: 16 };
const S_SECTION = { paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 };
const S_DIVIDER = { height: 1, marginTop: 16, marginBottom: 16 };

// ── Component ────────────────────────────────────────────

export function ObjectDetectStory() {
  const c = useThemeColors();
  const { detectForeground, compositeBackground, releaseMask, processing, error } = useObjectDetect();
  const { apply } = useImaging();

  const [maskId, setMaskId] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [hasMaskPreview, setHasMaskPreview] = useState(false);
  const [activePreset, setActivePreset] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Ready. Press Detect to begin.');

  const runDetect = async () => {
    // Clean up previous mask
    if (maskId) {
      await releaseMask(maskId);
      setMaskId(null);
    }
    setHasResult(false);
    setHasMaskPreview(false);
    setStatusMsg('Detecting foreground...');

    const params = PRESETS[activePreset].params;
    const det = await detectForeground(FG_SRC, params);
    if (!det || !det.ok) {
      setStatusMsg(`Detection failed: ${det?.error || 'unknown'}`);
      return;
    }

    setMaskId(det.maskId);
    setStatusMsg(`Mask generated (${det.width}x${det.height}). Generating mask preview...`);

    // Generate mask preview by applying the mask as an image op
    const maskPreview = await apply({
      src: FG_SRC,
      operations: [{ op: 'detect_foreground', ...params }],
      output: 'object_detect_mask.png',
    });

    if (maskPreview?.ok) {
      setHasMaskPreview(true);
    }

    setStatusMsg(`Mask ready. Press Composite to swap background.`);
  };

  const runComposite = async () => {
    if (!maskId) {
      setStatusMsg('No mask. Run Detect first.');
      return;
    }
    setStatusMsg('Compositing foreground onto mountain landscape...');

    const result = await compositeBackground(FG_SRC, BG_SRC, maskId, OUTPUT_PATH);
    if (!result || !result.ok) {
      setStatusMsg(`Composite failed: ${result?.error || 'unknown'}`);
      return;
    }

    setHasResult(true);
    setStatusMsg(`Done! ${result.width}x${result.height} composited.`);
  };

  const runAll = async () => {
    if (maskId) {
      await releaseMask(maskId);
      setMaskId(null);
    }
    setHasResult(false);
    setHasMaskPreview(false);
    setStatusMsg('Running full pipeline...');

    const params = PRESETS[activePreset].params;
    const det = await detectForeground(FG_SRC, params);
    if (!det || !det.ok) {
      setStatusMsg(`Detection failed: ${det?.error || 'unknown'}`);
      return;
    }
    setMaskId(det.maskId);

    // Mask preview
    const maskPreview = await apply({
      src: FG_SRC,
      operations: [{ op: 'detect_foreground', ...params }],
      output: 'object_detect_mask.png',
    });
    if (maskPreview?.ok) setHasMaskPreview(true);

    // Composite
    const result = await compositeBackground(FG_SRC, BG_SRC, det.maskId, OUTPUT_PATH);
    if (!result || !result.ok) {
      setStatusMsg(`Composite failed: ${result?.error || 'unknown'}`);
      return;
    }

    setHasResult(true);
    setStatusMsg(`Pipeline complete! ${result.width}x${result.height}`);
  };

  return (
    <ScrollView style={S_ROOT}>
      <PageColumn>
        {/* ── Header ── */}
        <Box style={S_HEADER}>
          <Text style={{ ...S_TITLE, color: c.text }}>Object Detection</Text>
          <Text style={{ ...S_SUBTITLE, color: c.muted }}>
            {`GPU-accelerated foreground segmentation + background replacement`}
          </Text>
        </Box>

        {/* ── Source images ── */}
        <SectionLabel color={C.detect} label="Source Images" />
        <Box style={S_PREVIEW_ROW}>
          <Box>
            <Text style={{ ...S_PREVIEW_LABEL, color: C.detect }}>Foreground</Text>
            <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.detect }}>
              <Image src={FG_SRC} style={S_IMG} />
            </Box>
          </Box>
          <Box>
            <Text style={{ ...S_PREVIEW_LABEL, color: C.composite }}>New Background</Text>
            <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.composite }}>
              <Image src={BG_SRC} style={S_IMG} />
            </Box>
          </Box>
        </Box>

        {/* ── Preset selector ── */}
        <Box style={{ ...S_DIVIDER, backgroundColor: c.border }} />
        <SectionLabel color={C.param} label="Detection Preset" />
        <Box style={S_PRESETS}>
          {PRESETS.map((p, i) => (
            <Pressable key={p.label} onPress={() => setActivePreset(i)}>
              <Box style={{
                ...S_PRESET_BTN,
                backgroundColor: i === activePreset ? C.accent : c.bgElevated,
                borderWidth: 1,
                borderColor: i === activePreset ? C.accent : c.border,
              }}>
                <Text style={{
                  ...S_PRESET_TXT,
                  color: i === activePreset ? '#000' : c.text,
                  fontWeight: i === activePreset ? 'bold' as const : 'normal' as const,
                }}>
                  {`${p.icon} ${p.label}`}
                </Text>
              </Box>
            </Pressable>
          ))}
        </Box>

        {/* ── Action buttons ── */}
        <Box style={S_ACTIONS}>
          <Pressable onPress={runDetect}>
            <Box style={{ ...S_BTN, backgroundColor: C.detect }}>
              <Text style={{ ...S_BTN_TXT, color: '#000' }}>Detect</Text>
            </Box>
          </Pressable>
          <Pressable onPress={runComposite}>
            <Box style={{ ...S_BTN, backgroundColor: C.composite }}>
              <Text style={{ ...S_BTN_TXT, color: '#000' }}>Composite</Text>
            </Box>
          </Pressable>
          <Pressable onPress={runAll}>
            <Box style={{ ...S_BTN, backgroundColor: C.mask }}>
              <Text style={{ ...S_BTN_TXT, color: '#000' }}>Run All</Text>
            </Box>
          </Pressable>
        </Box>

        {/* ── Status ── */}
        <Text style={{
          ...S_STATUS,
          color: error ? '#ef4444' : processing ? C.accent : c.muted,
        }}>
          {processing ? 'Processing...' : error || statusMsg}
        </Text>

        {/* ── Mask preview ── */}
        {hasMaskPreview && (
          <Box>
            <SectionLabel color={C.mask} label="Detection Mask" />
            <Box style={S_RESULT_WRAP}>
              <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.mask }}>
                <Native
                  type="Imaging"
                  src="object_detect_mask.png"
                  operations="[]"
                  style={S_IMG}
                />
              </Box>
              <Text style={{ ...S_PREVIEW_LABEL, color: C.mask, marginTop: 6 }}>
                {`White = foreground, Black = background`}
              </Text>
            </Box>
          </Box>
        )}

        {/* ── Final result ── */}
        {hasResult && (
          <Box>
            <Box style={{ ...S_DIVIDER, backgroundColor: c.border }} />
            <SectionLabel color={C.composite} label="Result: Robot on Mountains" />
            <Box style={S_RESULT_WRAP}>
              <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.composite }}>
                <Native
                  type="Imaging"
                  src={OUTPUT_PATH}
                  operations="[]"
                  style={S_RESULT_IMG}
                />
              </Box>
            </Box>
          </Box>
        )}

        {/* ── How it works ── */}
        <Box style={{ ...S_DIVIDER, backgroundColor: c.border }} />
        <SectionLabel color={C.accent} label="How It Works" />
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Text style={{ fontSize: 13, color: c.text, lineHeight: 20 }}>
            {`1. Sample border pixels as "definite background" colors\n2. K-means cluster border samples into 4 representative colors\n3. GPU shader: per-pixel color distance to nearest cluster center\n4. Sobel edge detection refines mask along object boundaries\n5. Morphological cleanup (erode + dilate) removes noise\n6. Gaussian feather softens mask edges\n7. Composite: mask blends foreground over new background`}
          </Text>
        </CalloutBand>

        {/* ── Code samples ── */}
        <Box style={{ ...S_DIVIDER, backgroundColor: c.border }} />
        <SectionLabel color={C.detect} label="React Hook API" />
        <Band>
          <Half>
            <CodeBlock value={HOOK_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
          </Half>
          <Half>
            <CodeBlock value={LUA_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
          </Half>
        </Band>

        {/* ── Pipeline params reference ── */}
        <Box style={{ ...S_DIVIDER, backgroundColor: c.border }} />
        <SectionLabel color={C.param} label="Detection Parameters" />
        <Box style={S_SECTION}>
          {[
            { name: 'threshold', desc: 'Color distance cutoff (0-1). Higher = more foreground.' },
            { name: 'softness', desc: 'Transition width. Higher = more gradual fg/bg edge.' },
            { name: 'borderWidth', desc: 'Pixels from edges sampled as background. Default: 5% of image.' },
            { name: 'morphRadius', desc: 'Cleanup radius. Erode removes noise, dilate restores shape.' },
            { name: 'featherRadius', desc: 'Gaussian blur on final mask edges for smooth compositing.' },
            { name: 'edgeWeight', desc: 'Sobel edge refinement strength (0-1). Sharpens mask at boundaries.' },
          ].map((p) => (
            <Box key={p.name} style={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}>
              <Text style={{ fontSize: 12, color: C.param, fontWeight: 'bold', width: 100 }}>{p.name}</Text>
              <Text style={{ fontSize: 12, color: c.muted, flexGrow: 1 }}>{p.desc}</Text>
            </Box>
          ))}
        </Box>

        <Box style={{ height: 32 }} />
      </PageColumn>
    </ScrollView>
  );
}
