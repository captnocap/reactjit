import React from 'react';
import { Box, Text, TextEffect, type TextEffectType } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StorySection } from './_shared/StoryScaffold';

type VariantDef = {
  id: TextEffectType;
  label: string;
  sample: string;
  note: string;
  sentence?: string;
  speed?: number;
  amplitude?: number;
  fontSize?: number;
  letterSpacing?: number;
  typingSpeed?: number;
  previewFontSize?: number;
};

const VARIANTS: VariantDef[] = [
  { id: 'burst-hover', label: 'Explosive Burst', sample: 'HOVER DETECTED', note: 'Explosive letter burst on hover', speed: 1.08, amplitude: 0.9, fontSize: 62, letterSpacing: 1.4 },
  { id: 'dancing-shadow', label: 'Dancing Shadow', sample: 'DANCING SHADOW', note: 'Layered moving shadows under text', speed: 1.05, amplitude: 0.78, fontSize: 60, letterSpacing: 1.3 },
  { id: 'melting', label: 'Melting Text', sample: 'MELT MODE', note: 'Drip/stretch text treatment', speed: 0.9, amplitude: 0.86, fontSize: 60, letterSpacing: 1.25 },
  { id: 'text-mask', label: 'Text Masking', sample: 'MASKED TYPE', sentence: 'Color and form, revealed only through the shape of letters.', note: 'Animated color bands masked by glyphs', speed: 1.0, amplitude: 0.82, fontSize: 58, letterSpacing: 1.1 },
  { id: 'spin-3d', label: '3D Spin Cylinder', sample: 'EAT SLEEP RAVE', sentence: 'Geometry in motion, rotated and revealed across three axes.', note: 'X-axis style cylinder spin with depth', speed: 1.2, amplitude: 0.72, fontSize: 44, letterSpacing: 1.2 },
  { id: 'neon-glow', label: 'Neon Glow', sample: 'MIDNIGHT SIGNAL', note: 'Electric glow, flicker, shimmer sweep', speed: 1.16, amplitude: 0.9, fontSize: 62, letterSpacing: 1.5 },
  { id: 'wavy-text', label: 'Wavy Text', sample: 'TIDAL LETTERS', note: 'Sinusoidal motion per character', speed: 1.05, amplitude: 0.9, fontSize: 60, letterSpacing: 1.35 },
  { id: 'typewriter', label: 'Typewriter Effect', sample: 'BOOT_SEQUENCE_OK', note: 'Single-pass typed reveal', speed: 1.0, amplitude: 0.6, fontSize: 54, letterSpacing: 1.1, typingSpeed: 14 },
  { id: 'typewriter-text', label: 'Typewriter Loop', sample: 'WRITING...ERASING...', sentence: 'Every character arrives and departs on its own rhythm.', note: 'Typewriter text animation (type + erase)', speed: 1.0, amplitude: 0.6, fontSize: 52, letterSpacing: 1.05, typingSpeed: 15 },
  { id: 'gradient-typing', label: 'Gradient Typing', sample: 'SPECTRUM TYPING', note: 'Typed reveal with gradient glyphs', speed: 1.0, amplitude: 0.86, fontSize: 56, letterSpacing: 1.2, typingSpeed: 15 },
  { id: 'editor-illustration', label: 'Editor Illustration', sample: 'const fx = "LUA TYPE";', sentence: 'The painter draws to a canvas, and the canvas becomes the world.', note: 'Code editor style animated card', speed: 1.0, amplitude: 0.5, fontSize: 40, letterSpacing: 0.8, typingSpeed: 16, previewFontSize: 16 },
  { id: 'hover-transition', label: 'Hover Transition', sample: 'HOVER TRANSITION', sentence: 'Motion arrives when you move the mouse across this text.', note: 'Reveal bar and chroma shift on hover', speed: 1.0, amplitude: 0.7, fontSize: 58, letterSpacing: 1.25 },
  { id: 'terminal', label: 'Terminal', sample: 'boot_sequence::ok', sentence: 'All systems nominal. Awaiting your next instruction to proceed.', note: 'Classic CRT scanline terminal', speed: 1.04, amplitude: 0.58, fontSize: 52, letterSpacing: 1.2 },
  { id: 'gradient-wave', label: 'Gradient Wave', sample: 'LUA TYPE FX', sentence: 'Color flows across letters like water across stone.', note: 'Per-glyph rainbow wave', speed: 0.95, amplitude: 0.9, fontSize: 60, letterSpacing: 1.4 },
  { id: 'glitch', label: 'Glitch', sample: 'PACKET_LOSS_12%', sentence: 'Signals degrade and reassemble in the space between bits.', note: 'RGB split + scan slices', speed: 1.12, amplitude: 0.66, fontSize: 56, letterSpacing: 1.18 },
];

const INLINE_EFFECT_IDS: TextEffectType[] = [
  'melting',
  'wavy-text',
  'neon-glow',
  'gradient-wave',
  'glitch',
  'dancing-shadow',
  'burst-hover',
  'hover-transition',
  'typewriter',
  'gradient-typing',
];

const SURFACE_EFFECT_IDS: TextEffectType[] = [
  'editor-illustration',
  'terminal',
  'spin-3d',
  'text-mask',
  'typewriter-text',
];

export function TextEffectsStory({ index = 5 }: { index?: number } = {}) {
  const c = useThemeColors();
  const inlineVariants = VARIANTS.filter((v) => INLINE_EFFECT_IDS.includes(v.id));
  const surfaceVariants = VARIANTS.filter((v) => SURFACE_EFFECT_IDS.includes(v.id));

  return (
    <StorySection index={index} title="Text effects">
      <Box style={{ width: '100%', gap: 6 }}>
        <Text style={{ color: c.text, fontSize: 11 }}>Inline-capable (no frame)</Text>
        {inlineVariants.map((v) => (
          <Box key={v.id} style={{ width: '100%', paddingTop: 2, paddingBottom: 2, gap: 3 }}>
            <Text style={{ color: c.textDim, fontSize: 11 }}>
              {v.label}
            </Text>
            <TextEffect
              type={v.id}
              text={v.sample}
              fontSize={v.previewFontSize ?? 24}
              letterSpacing={v.letterSpacing ?? 0.95}
              speed={v.speed ?? 1}
              amplitude={v.amplitude ?? 0.72}
              typingSpeed={v.typingSpeed ?? 14}
              style={{ width: '100%', height: 84 }}
            />
            <Text style={{ color: c.textDim, fontSize: 10 }}>
              {v.id}
            </Text>
          </Box>
        ))}
      </Box>

      <Box style={{ width: '100%', height: 1, backgroundColor: c.border }} />

      <Box style={{ width: '100%', gap: 6, alignItems: 'center' }}>
        <Text style={{ color: c.text, fontSize: 11, width: '100%' }}>Surface / mini-scene (framed)</Text>
        {surfaceVariants.map((v) => (
          <Box
            key={v.id}
            style={{
              width: 280,
              backgroundColor: c.surface,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: c.border,
              padding: 8,
              gap: 4,
            }}
          >
            <Text style={{ color: c.textDim, fontSize: 11 }}>
              {v.label}
            </Text>
            <TextEffect
              type={v.id}
              text={v.sentence ?? v.sample}
              fontSize={v.previewFontSize ?? 24}
              letterSpacing={v.letterSpacing ?? 0.95}
              speed={v.speed ?? 1}
              amplitude={v.amplitude ?? 0.72}
              typingSpeed={v.typingSpeed ?? 14}
              style={{ width: '100%', height: 96 }}
            />
            <Text style={{ color: c.textDim, fontSize: 10 }}>
              {v.id}
            </Text>
          </Box>
        ))}
      </Box>
    </StorySection>
  );
}
