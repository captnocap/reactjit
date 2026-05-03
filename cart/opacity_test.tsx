// opacity_test — paint-cost bisect for the settings/models page slowdown.
//
// The Models page paints ~4000 nodes in 84ms. The component-gallery paints
// 6300 nodes in 1.5ms. Same `Icon` component, same primitive set, vastly
// different per-node paint cost.
//
// Opacity (test #1) was the first hypothesis — disproven; 1000 dimmed
// boxes paint in 19us. So this cart fans out to test the next four
// suspects independently and in combination:
//
//   1. OPACITY — opacity: 0.45 on each cell
//   2. TEXT    — small Text glyphs per cell (the Models cards have lots)
//   3. IMAGE   — a PNG-data-URL <Image> per cell (provider brand icons)
//   4. ICONS   — a lucide <Icon> (Box + Graph + Path) per cell
//   5. PRESS   — each cell wrapped in a <Pressable>
//
// Toggle any combination. Each cell stamps the union of enabled features.
// The grid is N cells (60 / 252 / 600 / 1000) so paint cost can be
// scaled. Watch the telemetry's paint number after each toggle.

import { useState } from 'react';
import { Box, Pressable, Image, Text } from '@reactjit/runtime/primitives';
import { Icon } from '@reactjit/runtime/icons/Icon';
import { Eye } from '@reactjit/runtime/icons/icons';
import { PROVIDER_ICONS } from './component-gallery/components/model-card/providerIcons.generated';

type Feature = 'opacity' | 'text' | 'image' | 'icons' | 'press';
const FEATURES: Feature[] = ['opacity', 'text', 'image', 'icons', 'press'];
const FEATURE_LABEL: Record<Feature, string> = {
  opacity: 'OPACITY',
  text:    'TEXT',
  image:   'IMAGE',
  icons:   'ICONS',
  press:   'PRESS',
};

const COUNTS = [60, 252, 600, 1000];

// Pick a small PNG to test image paint cost. Provider icons are 128px
// rasterized brand logos shipped as base64 data URLs.
const SAMPLE_IMAGE = PROVIDER_ICONS['openai'] || Object.values(PROVIDER_ICONS)[0];

type EnabledMap = Record<Feature, boolean>;
const EMPTY_ENABLED: EnabledMap = { opacity: false, text: false, image: false, icons: false, press: false };

function Cell({ i, on }: { i: number; on: EnabledMap }) {
  const dim = on.opacity;
  const cellStyle = {
    width: 60, height: 36,
    paddingLeft: 4, paddingRight: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    borderRadius: 6,
    backgroundColor: '#1a1a1d',
    borderWidth: 1,
    borderColor: '#3a3a40',
    opacity: dim ? 0.45 : 1,
  };

  const inner = (
    <Box style={cellStyle}>
      {on.image && (
        <Image source={SAMPLE_IMAGE} style={{ width: 16, height: 16 }} />
      )}
      {on.icons && (
        <Icon icon={Eye} size={14} color="#bdbdc4" strokeWidth={2} />
      )}
      {on.text && (
        <Text style={{ fontSize: 10, color: '#bdbdc4' }}>n{i}</Text>
      )}
    </Box>
  );

  if (on.press) {
    return <Pressable onPress={() => {}}>{inner}</Pressable>;
  }
  return inner;
}

export default function OpacityTest() {
  const [enabled, setEnabled] = useState<EnabledMap>(EMPTY_ENABLED);
  const [count, setCount] = useState(252);

  const toggle = (f: Feature) => {
    setEnabled((prev) => ({ ...prev, [f]: !prev[f] }));
  };
  const clear = () => setEnabled(EMPTY_ENABLED);

  const items = Array.from({ length: count }, (_, i) => i);
  const enabledList = FEATURES.filter((f) => enabled[f]);
  const summary = enabledList.length === 0 ? 'BASELINE (empty cells)' : enabledList.map((f) => FEATURE_LABEL[f]).join(' + ');

  return (
    <Box style={{
      flexGrow: 1, width: '100%', height: '100%',
      backgroundColor: '#0d0d10',
      paddingTop: 24, paddingLeft: 24, paddingRight: 24,
      flexDirection: 'column', gap: 14,
    }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f5f5f5' }}>
        Paint-cost bisect
      </Text>
      <Text style={{ fontSize: 12, color: '#8a8a8a' }}>
        cells = {count} · features = {summary}
      </Text>

      {/* Feature toggles — multi-select */}
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {FEATURES.map((f) => {
          const on = enabled[f];
          return (
            <Pressable key={f} onPress={() => toggle(f)}>
              <Box style={{
                paddingLeft: 14, paddingRight: 14,
                paddingTop: 8, paddingBottom: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: on ? '#ff7a3d' : '#2a2a2e',
                backgroundColor: on ? '#1a1a1d' : '#121215',
              }}>
                <Text style={{ fontSize: 12, color: on ? '#ff7a3d' : '#bdbdc4' }}>
                  {FEATURE_LABEL[f]}
                </Text>
              </Box>
            </Pressable>
          );
        })}
        <Pressable onPress={clear}>
          <Box style={{
            paddingLeft: 14, paddingRight: 14,
            paddingTop: 8, paddingBottom: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#2a2a2e',
            backgroundColor: '#121215',
          }}>
            <Text style={{ fontSize: 12, color: '#bdbdc4' }}>CLEAR</Text>
          </Box>
        </Pressable>
      </Box>

      {/* Count toggles */}
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        {COUNTS.map((c) => (
          <Pressable key={c} onPress={() => setCount(c)}>
            <Box style={{
              paddingLeft: 14, paddingRight: 14,
              paddingTop: 8, paddingBottom: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: c === count ? '#3da9ff' : '#2a2a2e',
              backgroundColor: c === count ? '#1a1a1d' : '#121215',
            }}>
              <Text style={{ fontSize: 12, color: c === count ? '#3da9ff' : '#bdbdc4' }}>
                {c}
              </Text>
            </Box>
          </Pressable>
        ))}
      </Box>

      {/* The grid being tested */}
      <Box style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
      }}>
        {items.map((i) => (
          <Cell key={i} i={i} on={enabled} />
        ))}
      </Box>
    </Box>
  );
}
