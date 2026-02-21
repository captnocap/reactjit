import React from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { useDVD } from '../dvd/context';
import { rgba } from '../hex';
import type { Extra } from '../data';

// ── Extra Item ───────────────────────────────────────────

function ExtraItem({ extra, index }: { extra: Extra; index: number }) {
  const { playExtra } = useDVD();
  const [hovered, setHovered] = React.useState(false);
  const bgAlpha = hovered ? 0.08 : 0;
  const borderAlpha = hovered ? 0.6 : 0.1;

  return (
    <Pressable
      onPress={() => playExtra(extra)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 16,
        paddingLeft: 20,
        paddingRight: 20,
        backgroundColor: rgba(212, 168, 67, bgAlpha),
        borderBottomWidth: 1,
        borderColor: rgba(255, 255, 255, borderAlpha),
        transition: {
          backgroundColor: { duration: 220, easing: 'spring' },
          borderColor: { duration: 220, easing: 'spring' },
        },
        gap: 20,
      }}
    >
      {/* Index number */}
      <Text style={{
        fontSize: 24,
        color: hovered ? '#d4a843' : '#444444',
        fontWeight: '700',
        width: 40,
      }}>
        {`${index + 1}`}
      </Text>

      {/* Title + description */}
      <Box style={{ flexGrow: 1, gap: 4 }}>
        <Text style={{
          fontSize: 18,
          color: hovered ? '#f0f0f0' : '#c0c0c0',
          fontWeight: '600',
        }}>
          {extra.title}
        </Text>
        <Text style={{
          fontSize: 13,
          color: '#6b7280',
        }}>
          {extra.description}
        </Text>
      </Box>

      {/* Duration */}
      <Text style={{
        fontSize: 14,
        color: '#6b7280',
        width: 60,
      }}>
        {extra.duration}
      </Text>
    </Pressable>
  );
}

// ── Back Button ──────────────────────────────────────────

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={(state) => ({
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 16,
        paddingRight: 16,
        backgroundColor: state.hovered ? '#d4a84326' : 'transparent',
        borderRadius: 4,
      })}
    >
      <Text style={{
        fontSize: 14,
        color: '#8b95a5',
        letterSpacing: 1,
      }}>
        BACK
      </Text>
    </Pressable>
  );
}

// ── Special Features Screen ──────────────────────────────

export function SpecialFeatures() {
  const { extras, navigate } = useDVD();

  return (
    <Box fill style={{
      backgroundColor: '#0a0a14',
      padding: 40,
      gap: 32,
    }}>
      {/* Header row */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      }}>
        <Text style={{
          fontSize: 28,
          color: '#f0f0f0',
          fontWeight: '700',
          letterSpacing: 2,
        }}>
          SPECIAL FEATURES
        </Text>
        <BackButton onPress={() => navigate('title')} />
      </Box>

      {/* Extras list */}
      <Box style={{
        width: '100%',
        borderTopWidth: 1,
        borderColor: '#ffffff1a',
      }}>
        {extras.map((extra, i) => (
          <ExtraItem key={extra.title} extra={extra} index={i} />
        ))}
      </Box>
    </Box>
  );
}
