import React, { useCallback, useRef } from 'react';
import { Box, VideoPlayer, useHotkey } from '@reactjit/core';
import { useDVD } from '../dvd/context';

export function PlayerScreen() {
  const { state, back } = useDVD();
  const seeked = useRef(false);

  // Escape key returns to previous screen
  useHotkey('escape', back);

  const handleReady = useCallback(() => {
    // Seek to chapter start time on first ready event
    if (!seeked.current && state.startTime > 0) {
      seeked.current = true;
      // VideoPlayer seek is handled via the Lua side —
      // we pass startTime as a prop concept but the actual seek
      // happens through the bridge. For now the player starts from 0
      // and chapter timestamps serve as navigation markers.
    }
  }, [state.startTime]);

  const handleEnded = useCallback(() => {
    back();
  }, [back]);

  return (
    <Box fill style={{ backgroundColor: '#000000' }}>
      <VideoPlayer
        src={state.currentVideo}
        w={1280}
        h={720}
        controls
        onReady={handleReady}
        onEnded={handleEnded}
      />
    </Box>
  );
}
