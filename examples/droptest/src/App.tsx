import React, { useState, useCallback } from 'react';
import { Box, Text, VideoPlayer } from '@ilovereact/core';
import type { LoveEvent } from '@ilovereact/core';

export function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const handleFileDrop = useCallback((e: LoveEvent) => {
    if (!e.filePath) return;
    setVideoSrc(e.filePath);
  }, []);

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#0f172a',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Box
        onFileDrop={handleFileDrop}
        style={{
          width: 640,
          height: 400,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {videoSrc ? (
          <VideoPlayer src={videoSrc} w={640} h={400} radius={8} />
        ) : (
          <Box style={{
            width: 640,
            height: 400,
            backgroundColor: '#1e293b',
            borderRadius: 8,
            borderWidth: 2,
            borderColor: '#334155',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
          }}>
            <Text style={{ color: '#475569', fontSize: 32 }}>+</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>
              Drop a video file here
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
