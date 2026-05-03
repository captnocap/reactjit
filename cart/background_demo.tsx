// Background Demo — exercises the runtime <Background> component.
//
// Two control rows:
//   • Variant — swaps the GPU shader live (dots/scan/ember/grid)
//   • Palette — swaps the active gallery theme; tokens flow through to the
//     shader via useThemeColors() so the same variant re-colors immediately.
//
// Importing gallery-theme bootstraps the cockpit warm palette into the
// runtime token store on module load (see gallery-theme.ts:226), so the
// first paint shows the cockpit colors instead of the catppuccin default.

import { useState } from 'react';
import { Box, Row, Col, Text, Pressable } from '@reactjit/runtime/primitives';
import { Background, type BackgroundType } from '@reactjit/runtime/background';
import {
  applyGalleryTheme,
  useGalleryTheme,
} from './app/gallery/gallery-theme';

const VARIANTS: { type: BackgroundType; label: string }[] = [
  { type: 'dots',  label: 'DOTS'  },
  { type: 'scan',  label: 'SCAN'  },
  { type: 'ember', label: 'EMBER' },
  { type: 'grid',  label: 'GRID'  },
];

export default function BackgroundDemo() {
  const [type, setType] = useState<BackgroundType>('dots');
  const { active, options } = useGalleryTheme();

  return (
    <Background type={type}>
      <Col style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <Box
          style={{
            backgroundColor: '#1a1511e6',
            borderColor: '#8a4a20',
            borderWidth: 1,
            borderRadius: 14,
            paddingLeft: 28, paddingRight: 28,
            paddingTop: 20,  paddingBottom: 20,
            gap: 8,
          }}
        >
          <Text fontSize={26} color="#f2e8dc" style={{ letterSpacing: 1.4 }}>
            BACKGROUND · {type.toUpperCase()}
          </Text>
          <Text fontSize={13} color="#b8a890">
            Variant swaps the shader live. Palette swaps theme tokens — the
            shader re-templates with the new colors automatically.
          </Text>
        </Box>

        {/* Nested-in-card test — same Background component, sized to the card.
            The card runs the *next* variant in the cycle so it's visibly
            different from the page background, proving it's not transparent. */}
        {(() => {
          const nestedType: BackgroundType =
            VARIANTS[(VARIANTS.findIndex(v => v.type === type) + 1) % VARIANTS.length].type;
          return (
            <Box
              style={{
                width: 380, height: 180,
                borderRadius: 14,
                borderColor: '#e8501c',  // theme:accentHot — pop from page bg
                borderWidth: 2,
                overflow: 'hidden',
              }}
            >
              <Background type={nestedType}>
                <Col style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Text fontSize={18} color="#f2e8dc" bold style={{ letterSpacing: 1.2 }}>
                    NESTED · {nestedType.toUpperCase()}
                  </Text>
                  <Text fontSize={11} color="#b8a890">
                    Different shader than the page — sized to its parent.
                  </Text>
                </Col>
              </Background>
            </Box>
          );
        })()}

        <Row style={{ gap: 10 }}>
          {VARIANTS.map(v => {
            const on = v.type === type;
            return (
              <Pressable
                key={v.type}
                onPress={() => setType(v.type)}
                style={{
                  backgroundColor: on ? '#d26a2a' : '#1a1511cc',
                  borderColor:     on ? '#e8501c' : '#8a4a20',
                  borderWidth: 1,
                  paddingLeft: 18, paddingRight: 18,
                  paddingTop: 9,   paddingBottom: 9,
                  borderRadius: 8,
                }}
              >
                <Text fontSize={13} color={on ? '#0e0b09' : '#f2e8dc'} bold>
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </Row>

        <Row style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 800 }}>
          {options.map(opt => {
            const on = opt.id === active?.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => applyGalleryTheme(opt.id)}
                style={{
                  backgroundColor: on ? '#5a8bd6' : '#1a1511cc',
                  borderColor:     on ? '#8ea4ff' : '#3a2a1e',
                  borderWidth: 1,
                  paddingLeft: 12, paddingRight: 12,
                  paddingTop: 6,   paddingBottom: 6,
                  borderRadius: 6,
                }}
              >
                <Text fontSize={11} color={on ? '#0e0b09' : '#b8a890'}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </Row>
      </Col>
    </Background>
  );
}
