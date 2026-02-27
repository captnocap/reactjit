import React from 'react';
import { Box, Native } from '@reactjit/core';

export function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a' }}>
      <Native
        type="ClaudeCode"
        workingDir="/home/siah/creative/reactjit"
        model="sonnet"
        sessionId="default"
      />

      <Native
        type="ClaudeCanvas"
        sessionId="default"
        style={{ flexGrow: 1 }}
      />
    </Box>
  );
}
