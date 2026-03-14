import React, { useState, useCallback } from 'react';
import { Box, Text, VideoPlayer } from '@reactjit/core';
import type { LoveEvent } from '@reactjit/core';

export function App() {
  const [bgVideo, setBgVideo] = useState<string | null>(null);
  const [fgVideo, setFgVideo] = useState<string | null>(null);
  const [hoverVid, setHoverVid] = useState<string | null>(null);

  const handleBgDrop = useCallback((e: LoveEvent) => {
    if (e.filePath) setBgVideo(e.filePath);
  }, []);

  const handleFgDrop = useCallback((e: LoveEvent) => {
    if (e.filePath) setFgVideo(e.filePath);
  }, []);

  const handleHoverDrop = useCallback((e: LoveEvent) => {
    if (e.filePath) setHoverVid(e.filePath);
  }, []);

  return (
    <Box
      fill
      bg="#0a0a12"
      backgroundVideo={bgVideo ?? undefined}
      backgroundVideoFit="cover"
    >
      <Box fill align="center" justify="center" gap={24}>
        {/* Background drop zone */}
        <Box
          onFileDrop={handleBgDrop}
          style={{
            width: 320,
            height: 80,
            backgroundColor: bgVideo ? '#16a34a20' : '#1e293b',
            borderRadius: 8,
            borderWidth: 2,
            borderColor: bgVideo ? '#16a34a' : '#334155',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Text style={{ color: bgVideo ? '#4ade80' : '#94a3b8', fontSize: 14 }}>
            {bgVideo ? 'Background playing — drop to change' : 'Drop a video for background'}
          </Text>
          {!bgVideo && (
            <Text style={{ color: '#475569', fontSize: 11 }}>
              Loops fullscreen behind everything
            </Text>
          )}
        </Box>

        {/* Foreground player zone */}
        {fgVideo ? (
          <VideoPlayer src={fgVideo} w={480} h={300} radius={8} />
        ) : (
          <Box
            onFileDrop={handleFgDrop}
            style={{
              width: 480,
              height: 300,
              backgroundColor: '#1e293b',
              borderRadius: 8,
              borderWidth: 2,
              borderColor: '#334155',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: '#475569', fontSize: 32 }}>+</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>
              Drop a video to play on top
            </Text>
          </Box>
        )}

        {/* Hover video row — drop to set, hover to preview */}
        <Box direction="row" gap={16} align="center">
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              onFileDrop={handleHoverDrop}
              hoverVideo={hoverVid ?? undefined}
              hoverVideoFit="cover"
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#1e293b',
                borderWidth: 2,
                borderColor: hoverVid ? '#8b5cf6' : '#334155',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: hoverVid ? '#a78bfa' : '#475569', fontSize: 11 }}>
                {hoverVid ? 'Hover' : 'Drop'}
              </Text>
            </Box>
          ))}
          <Text style={{ color: '#64748b', fontSize: 11 }}>
            {hoverVid ? 'Hover the circles' : 'Drop a video on a circle'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
