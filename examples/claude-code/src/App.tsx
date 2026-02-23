import React from 'react';
import { Box, Native, ScrollView } from '@reactjit/core';

// ── Colors ────────────────────────────────────────────────────────────

const C = {
  bg: '#0f172a',
};

// ── App ──────────────────────────────────────────────────────────────

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

      {/* Terminal canvas — Lua paints everything */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Native type="ClaudeCanvas" sessionId="default" />
      </ScrollView>

    </Box>
  );
}
