import React from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { useDVD } from '../dvd/context';
import { MENU_BG_VIDEO } from '../data';
import { rgba } from '../hex';

// ── Menu Button ──────────────────────────────────────────

function MenuButton({ label, onPress }: { label: string; onPress: () => void }) {
  const [hovered, setHovered] = React.useState(false);
  const bgAlpha = hovered ? 0.55 : 0.3;
  const borderAlpha = hovered ? 0.8 : 0.2;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{
        width: 280,
        paddingTop: 14,
        paddingBottom: 14,
        paddingLeft: 24,
        paddingRight: 24,
        backgroundColor: rgba(10, 10, 20, bgAlpha),
        borderWidth: 1,
        borderColor: rgba(212, 168, 67, borderAlpha),
        borderRadius: 4,
        transition: {
          backgroundColor: { duration: 220, easing: 'spring' },
          borderColor: { duration: 220, easing: 'spring' },
        },
      }}
    >
      <Text style={{
        fontSize: 18,
        color: hovered ? '#d4a843' : '#e0e0e0',
        fontWeight: '600',
        letterSpacing: 2,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Title Screen ─────────────────────────────────────────

export function TitleScreen() {
  const { navigate, playFeature } = useDVD();

  return (
    <Box
      fill
      backgroundVideo={MENU_BG_VIDEO}
      backgroundVideoFit="cover"
    >
      {/* Gradient overlay for readability */}
      <Box fill style={{
        backgroundColor: '#00000066',
      }}>
        {/* Content: title area + menu */}
        <Box fill style={{
          justifyContent: 'space-between',
          padding: 60,
        }}>
          {/* Title area — upper left */}
          <Box style={{ gap: 8 }}>
            <Text style={{
              fontSize: 48,
              color: '#f0f0f0',
              fontWeight: '700',
              letterSpacing: 3,
            }}>
              DIGITAL DVD
            </Text>
            <Text style={{
              fontSize: 16,
              color: '#8b95a5',
              letterSpacing: 1,
            }}>
              A React-rendered cinematic experience
            </Text>
          </Box>

          {/* Menu buttons — lower left */}
          <Box style={{ gap: 12 }}>
            <MenuButton label="PLAY MOVIE" onPress={() => playFeature()} />
            <MenuButton label="CHAPTERS" onPress={() => navigate('chapters')} />
            <MenuButton label="SPECIAL FEATURES" onPress={() => navigate('extras')} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
