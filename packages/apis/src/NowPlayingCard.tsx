import React from 'react';
import { Box, Text, Image, ProgressBar } from '@reactjit/core';
import type { Style, Color } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';

export interface NowPlayingCardProps {
  title: string;
  artist: string;
  album?: string;
  /** Image URL for album art */
  art?: string;
  /** Playback position 0–1 */
  progress?: number;
  playing?: boolean;
  /** Accent color — defaults to Spotify green */
  accentColor?: Color;
  style?: Style;
}

/**
 * Music playback display. Works with Spotify, Last.fm, or any source
 * that provides track metadata.
 *
 * ```tsx
 * <NowPlayingCard title={track.name} artist={track.artist} art={track.albumArt} progress={0.4} playing />
 * ```
 */
export function NowPlayingCard({
  title,
  artist,
  album,
  art,
  progress,
  playing = false,
  accentColor = '#1DB954',
  style,
}: NowPlayingCardProps) {
  const c = useThemeColors();
  const accent = accentColor as string;

  return (
    <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'center', ...style }}>
      {/* Album art */}
      <Box style={{ width: 56, height: 56, borderRadius: 4, backgroundColor: c.surface, overflow: 'hidden', flexShrink: 0 }}>
        {art ? (
          <Image src={art} style={{ width: 56, height: 56 }} />
        ) : (
          <Box style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgElevated }}>
            {/* Vinyl record placeholder */}
            <Box style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.border }} />
            <Box style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: c.bg }} />
          </Box>
        )}
      </Box>

      {/* Track info + progress */}
      <Box style={{ flexGrow: 1, gap: 3 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' }}>
          {/* Playing indicator dot */}
          <Box style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: playing ? accent : c.border,
          }} />
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>{title}</Text>
        </Box>
        <Text style={{ color: c.muted, fontSize: 11 }}>
          {album ? `${artist} — ${album}` : artist}
        </Text>
        {progress !== undefined && (
          <ProgressBar
            value={progress}
            color={accent}
            trackColor={c.surface}
            height={3}
            style={{ marginTop: 3 }}
          />
        )}
      </Box>
    </Box>
  );
}
