import React, { useState, useCallback } from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { VideoPlayer } from '../../../packages/shared/src/VideoPlayer';
import type { LoveEvent } from '../../../packages/shared/src/types';
import { useThemeColors } from '../../../packages/theme/src';

export function FileDropStory() {
  const c = useThemeColors();
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [dragHover, setDragHover] = useState(false);

  const handleFileDrop = useCallback((e: LoveEvent) => {
    if (!e.filePath) return;
    setVideoSrc(e.filePath);
    setFileName(e.filePath.split('/').pop() ?? e.filePath);
    setFileSize(e.fileSize ?? null);
    setDragHover(false);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  return (
    <Box style={{ width: '100%', gap: 20, padding: 20 }}>
      {/* Header */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>File Drop</Text>
        <Text style={{ color: c.textDim, fontSize: 11 }}>
          Drag a video file onto the drop zone to start playback.
        </Text>
      </Box>

      {/* Drop zone / Player */}
      <Box
        onFileDrop={handleFileDrop}
        onFileDragEnter={() => setDragHover(true)}
        onFileDragLeave={() => setDragHover(false)}
        style={{
          width: '100%',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {videoSrc ? (
          <Box style={{ gap: 8, alignItems: 'center' }}>
            <VideoPlayer
              src={videoSrc}
              w={560}
              h={315}
              radius={8}
            />
            {/* File info bar */}
            <Box style={{
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
              width: 560,
            }}>
              <Box style={{
                flexGrow: 1,
                backgroundColor: [1, 1, 1, 0.05],
                borderRadius: 4,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
              }}>
                <Text style={{ color: c.textSecondary, fontSize: 10 }} numberOfLines={1}>
                  {fileName}
                </Text>
              </Box>
              {fileSize !== null && fileSize > 0 && (
                <Box style={{
                  backgroundColor: [1, 1, 1, 0.05],
                  borderRadius: 4,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                }}>
                  <Text style={{ color: c.textDim, fontSize: 10 }}>
                    {formatSize(fileSize)}
                  </Text>
                </Box>
              )}
            </Box>
            {/* Drop another hint */}
            <Text style={{ color: c.textDim, fontSize: 9 }}>
              Drop another file to switch
            </Text>
          </Box>
        ) : (
          /* Empty drop zone */
          <Box style={{
            width: 560,
            height: 315,
            backgroundColor: dragHover ? c.bg : '#0a0e17',
            borderRadius: 8,
            borderWidth: 2,
            borderColor: dragHover ? c.primary : [1, 1, 1, 0.08],
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
          }}>
            <Text style={{ color: dragHover ? c.info : c.textDim, fontSize: 32 }}>
              +
            </Text>
            <Text style={{ color: dragHover ? c.info : c.textDim, fontSize: 13 }}>
              {dragHover ? 'Release to play' : 'Drop a video file here'}
            </Text>
            <Text style={{ color: c.textDim, fontSize: 10 }}>
              MP4, MKV, WebM, AVI, MOV, OGV
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
