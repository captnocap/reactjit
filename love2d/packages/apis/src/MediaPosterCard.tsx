import React from 'react';
import { Box, Text, Image } from '@reactjit/core';
import type { Style } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';

export interface MediaPosterCardProps {
  title: string;
  posterUrl?: string;
  /** 0–10 score, e.g. TMDB vote_average */
  score?: number;
  year?: number | string;
  /** e.g. "Drama", "Action" */
  genre?: string;
  width?: number;
  height?: number;
  style?: Style;
}

function scoreColor(score: number): string {
  if (score >= 7.5) return '#22c55e';
  if (score >= 5.5) return '#f59e0b';
  return '#ef4444';
}

/**
 * Movie / series poster card. Works with TMDB, Trakt, Plex, Jellyfin — any
 * source that produces a poster image URL and metadata.
 *
 * ```tsx
 * <MediaPosterCard title={movie.title} posterUrl={tmdbImage(movie.poster_path)} score={movie.vote_average} year={2024} />
 * ```
 */
export function MediaPosterCard({
  title,
  posterUrl,
  score,
  year,
  genre,
  width = 120,
  height = 180,
  style,
}: MediaPosterCardProps) {
  const c = useThemeColors();

  return (
    <Box style={{ width, ...style }}>
      {/* Poster */}
      <Box style={{ width, height, borderRadius: 6, backgroundColor: c.surface, overflow: 'hidden' }}>
        {posterUrl ? (
          <Image src={posterUrl} style={{ width, height }} />
        ) : (
          <Box style={{ width, height, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {/* Film-reel placeholder */}
            <Box style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.bgElevated, alignItems: 'center', justifyContent: 'center' }}>
              <Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.border }} />
            </Box>
            <Text style={{ color: c.muted, fontSize: 9 }}>No poster</Text>
          </Box>
        )}

        {/* Score badge — top right */}
        {score !== undefined && (
          <Box style={{
            position: 'absolute',
            top: 6,
            right: 6,
            backgroundColor: scoreColor(score) + 'cc',
            borderRadius: 4,
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 2,
            paddingBottom: 2,
          }}>
            <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>
              {score.toFixed(1)}
            </Text>
          </Box>
        )}
      </Box>

      {/* Title + meta */}
      <Box style={{ gap: 2, marginTop: 6 }}>
        <Text style={{ color: c.text, fontSize: 11, fontWeight: 'bold' }}>{title}</Text>
        {(year || genre) && (
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {[year, genre].filter(Boolean).join(' · ')}
          </Text>
        )}
      </Box>
    </Box>
  );
}
