import React, { useState, useCallback } from 'react';
import { Box, Text, VideoPlayer } from '@ilovereact/core';
import type { LoveEvent } from '@ilovereact/core';

export function App() {
  const [bgVideo, setBgVideo] = useState<string | null>(null);
  const [fgVideo, setFgVideo] = useState<string | null>(null);

  const handleBgDrop = useCallback((e: LoveEvent) => {
    if (e.filePath) setBgVideo(e.filePath);
  }, []);

  const handleFgDrop = useCallback((e: LoveEvent) => {
    if (e.filePath) setFgVideo(e.filePath);
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
      </Box>
    </Box>
  );
}
