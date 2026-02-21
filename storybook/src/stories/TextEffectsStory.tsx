import React, { useMemo, useState } from 'react';
import { Box, Text, Pressable, ScrollView, TextEffect, type TextEffectType } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

type Mode = 'normal' | 'infinite' | 'reactive';

type VariantDef = {
  id: TextEffectType;
  label: string;
  sample: string;
  note: string;
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
  { id: 'text-mask', label: 'Text Masking', sample: 'MASKED TYPE', note: 'Animated color bands masked by glyphs', speed: 1.0, amplitude: 0.82, fontSize: 58, letterSpacing: 1.1 },
  { id: 'spin-3d', label: '3D Spin Cylinder', sample: 'EAT SLEEP RAVE', note: 'X-axis style cylinder spin with depth', speed: 1.2, amplitude: 0.72, fontSize: 44, letterSpacing: 1.2 },
  { id: 'neon-glow', label: 'Neon Glow', sample: 'MIDNIGHT SIGNAL', note: 'Electric glow, flicker, shimmer sweep', speed: 1.16, amplitude: 0.9, fontSize: 62, letterSpacing: 1.5 },
  { id: 'wavy-text', label: 'Wavy Text', sample: 'TIDAL LETTERS', note: 'Sinusoidal motion per character', speed: 1.05, amplitude: 0.9, fontSize: 60, letterSpacing: 1.35 },
  { id: 'typewriter', label: 'Typewriter Effect', sample: 'BOOT_SEQUENCE_OK', note: 'Single-pass typed reveal', speed: 1.0, amplitude: 0.6, fontSize: 54, letterSpacing: 1.1, typingSpeed: 14 },
  { id: 'typewriter-text', label: 'Typewriter Loop', sample: 'WRITING...ERASING...', note: 'Typewriter text animation (type + erase)', speed: 1.0, amplitude: 0.6, fontSize: 52, letterSpacing: 1.05, typingSpeed: 15 },
  { id: 'gradient-typing', label: 'Gradient Typing', sample: 'SPECTRUM TYPING', note: 'Typed reveal with gradient glyphs', speed: 1.0, amplitude: 0.86, fontSize: 56, letterSpacing: 1.2, typingSpeed: 15 },
  { id: 'editor-illustration', label: 'Editor Illustration', sample: 'const fx = "LUA TYPE";', note: 'Code editor style animated card', speed: 1.0, amplitude: 0.5, fontSize: 40, letterSpacing: 0.8, typingSpeed: 16, previewFontSize: 16 },
  { id: 'hover-transition', label: 'Hover Transition', sample: 'HOVER TRANSITION', note: 'Reveal bar and chroma shift on hover', speed: 1.0, amplitude: 0.7, fontSize: 58, letterSpacing: 1.25 },
  { id: 'terminal', label: 'Terminal', sample: 'boot_sequence::ok', note: 'Classic CRT scanline terminal', speed: 1.04, amplitude: 0.58, fontSize: 52, letterSpacing: 1.2 },
  { id: 'gradient-wave', label: 'Gradient Wave', sample: 'LUA TYPE FX', note: 'Per-glyph rainbow wave', speed: 0.95, amplitude: 0.9, fontSize: 60, letterSpacing: 1.4 },
  { id: 'glitch', label: 'Glitch', sample: 'PACKET_LOSS_12%', note: 'RGB split + scan slices', speed: 1.12, amplitude: 0.66, fontSize: 56, letterSpacing: 1.18 },
];

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'infinite', label: 'Infinite' },
  { id: 'reactive', label: 'Reactive' },
];

function getModeProps(mode: Mode) {
  if (mode === 'infinite') return { infinite: true };
  if (mode === 'reactive') return { reactive: true };
  return {};
}

export function TextEffectsStory() {
  const c = useThemeColors();
  const [variant, setVariant] = useState<TextEffectType>('melting');
  const [mode, setMode] = useState<Mode>('normal');

  const current = useMemo(() => VARIANTS.find((v) => v.id === variant) || VARIANTS[0], [variant]);
  const modeProps = getModeProps(mode);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 12, minHeight: 0 }}>
      <Box
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 10,
          minHeight: 0,
        }}
      >
        <Box style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>Lua Typography FX Lab</Text>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              CSS-style text animation ideas, rendered natively in Lua.
            </Text>
          </Box>

          <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {MODES.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMode(m.id)}
                style={({ hovered, pressed }) => ({
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: mode === m.id ? c.primary : hovered ? c.textSecondary : c.border,
                  backgroundColor: mode === m.id ? c.surface : c.bgAlt,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: mode === m.id ? c.text : c.textSecondary, fontSize: 10 }}>{m.label}</Text>
              </Pressable>
            ))}
          </Box>
        </Box>

        <Box style={{ width: '100%', flexDirection: 'row', gap: 10, flexGrow: 1, minHeight: 0 }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0, gap: 8 }}>
            <Box
              style={{
                flexGrow: 1,
                minHeight: 260,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.border,
                overflow: 'hidden',
                backgroundColor: '#060913',
              }}
            >
              <TextEffect
                key={`main-${current.id}-${mode}`}
                type={current.id}
                text={current.sample}
                fontSize={current.fontSize ?? 58}
                letterSpacing={current.letterSpacing ?? 1.2}
                speed={current.speed ?? 1}
                amplitude={current.amplitude ?? 0.7}
                typingSpeed={current.typingSpeed ?? 14}
                {...modeProps}
                style={{ width: '100%', height: '100%' }}
              />
            </Box>

            <Box
              style={{
                borderRadius: 8,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.bgAlt,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
                gap: 2,
              }}
            >
              <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{current.label}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>{current.note}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>
                {mode === 'reactive'
                  ? 'Reactive mode: move cursor over the stage to drive extra motion.'
                  : mode === 'infinite'
                    ? 'Infinite mode: ambient drift enabled for loop-friendly playback.'
                    : 'Normal mode: base animation profile.'}
              </Text>
            </Box>
          </Box>

          <Box
            style={{
              width: 360,
              minWidth: 300,
              height: '100%',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.bgAlt,
              padding: 8,
              gap: 8,
              overflow: 'hidden',
            }}
          >
            <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
              {`Variant Browser (${VARIANTS.length})`}
            </Text>

            <ScrollView style={{ width: '100%', flexGrow: 1, minHeight: 0 }} showScrollIndicator>
              <Box style={{ width: '100%', gap: 8, paddingBottom: 6 }}>
                {VARIANTS.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => setVariant(v.id)}
                    style={({ hovered, pressed }) => ({
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: variant === v.id ? c.primary : hovered ? c.textSecondary : c.border,
                      backgroundColor: c.bg,
                      overflow: 'hidden',
                      opacity: pressed ? 0.94 : 1,
                    })}
                  >
                    <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, gap: 2 }}>
                      <Text style={{ color: variant === v.id ? c.text : c.textSecondary, fontSize: 10, fontWeight: '700' }}>
                        {v.label}
                      </Text>
                      <Text style={{ color: c.textDim, fontSize: 9 }}>{v.note}</Text>
                    </Box>
                    <TextEffect
                      type={v.id}
                      text={v.sample}
                      fontSize={v.previewFontSize ?? 24}
                      letterSpacing={v.letterSpacing ?? 0.95}
                      speed={v.speed ?? 1}
                      amplitude={v.amplitude ?? 0.72}
                      typingSpeed={v.typingSpeed ?? 14}
                      {...modeProps}
                      style={{ width: '100%', height: 86 }}
                    />
                  </Pressable>
                ))}
              </Box>
            </ScrollView>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
