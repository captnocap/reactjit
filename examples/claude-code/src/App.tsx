import React from 'react';
import { Box, Native } from '@reactjit/core';

const C = {
  bg: '#0f172a',
};

export function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg }}>

      {/* Invisible capability node — manages the CLI process */}
      <Native
        type="ClaudeCode"
        workingDir="/home/siah/creative/reactjit"
        model="sonnet"
        permissionMode="bypassPermissions"
        sessionId="default"
      />

      {/* Terminal canvas — fills viewport, Lua owns everything */}
      <Native
        type="ClaudeCanvas"
        sessionId="default"
        style={{ flexGrow: 1 }}
      />

    </Box>
  );
}
