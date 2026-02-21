import React from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { useDVD } from '../dvd/context';
import { rgba } from '../hex';
import type { Chapter } from '../data';

// ── Chapter Card ─────────────────────────────────────────

function ChapterCard({ chapter }: { chapter: Chapter }) {
  const { playChapter } = useDVD();
  const [hovered, setHovered] = React.useState(false);
  const borderAlpha = hovered ? 0.8 : 0.1;

  return (
    <Pressable
      onPress={() => playChapter(chapter)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{ width: 360 }}
    >
      {/* 16:9 video preview area */}
      <Box
        hoverVideo={chapter.preview}
        hoverVideoFit="cover"
        style={{
          width: 360,
          height: 202,
          backgroundColor: '#1a1a2e',
          borderRadius: 6,
          borderWidth: 1,
          borderColor: rgba(212, 168, 67, borderAlpha),
          transition: { borderColor: { duration: 220, easing: 'spring' } },
          overflow: 'hidden',
          justifyContent: 'flex-end',
        }}
      >
        {/* Bottom gradient + chapter info */}
        <Box style={{
          width: '100%',
          backgroundColor: '#000000b3',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
          {/* Chapter number badge */}
          <Box style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: hovered ? '#d4a843' : '#333333',
            transition: { backgroundColor: { duration: 220, easing: 'spring' } },
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 13,
              color: hovered ? '#0a0a14' : '#999999',
              fontWeight: '700',
            }}>
              {`${chapter.number}`}
            </Text>
          </Box>

          {/* Chapter title */}
          <Text style={{
            fontSize: 14,
            color: hovered ? '#f0f0f0' : '#b0b0b0',
            fontWeight: '600',
          }}>
            {chapter.title}
          </Text>
        </Box>
      </Box>
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

// ── Chapter Select Screen ────────────────────────────────

export function ChapterSelect() {
  const { chapters, navigate } = useDVD();

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
          CHAPTERS
        </Text>
        <BackButton onPress={() => navigate('title')} />
      </Box>

      {/* Chapter grid — 3 columns */}
      <Box style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
        width: '100%',
      }}>
        {chapters.map((ch) => (
          <ChapterCard key={ch.number} chapter={ch} />
        ))}
      </Box>
    </Box>
  );
}
