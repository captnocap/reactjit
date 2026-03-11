import React from 'react';
import { Box, Text, Render } from '@reactjit/core';

const C = {
  bg: '#0f0f1a',
  panel: '#1a1a2e',
  border: '#2a2a4a',
  text: '#cdd6f4',
  muted: '#6c7086',
  accent: '#89b4fa',
};

function AppEmbed({ command, label, resolution = "600x500" }: {
  command: string;
  label: string;
  resolution?: string;
}) {
  return (
    <Box style={{
      flexGrow: 1,
      flexBasis: 0,
      backgroundColor: C.panel,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <Box style={{
        paddingLeft: 12, paddingRight: 12,
        paddingTop: 8, paddingBottom: 8,
        backgroundColor: C.border,
      }}>
        <Text style={{ color: C.accent, fontSize: 13, fontWeight: 'bold' }}>{label}</Text>
        <Text style={{ color: C.muted, fontSize: 11 }}>{command}</Text>
      </Box>
      <Render
        source="display"
        command={command}
        resolution={resolution}
        interactive
        style={{ flexGrow: 1 }}
      />
    </Box>
  );
}

export function App() {
  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      padding: 16,
      gap: 16,
    }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: 'bold' }}>
        {`AppEmbed \u2014 Any App in a React Component`}
      </Text>
      <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 16 }}>
        <AppEmbed
          command="python3 apps/calculator.py"
          label="Tkinter Calculator"
          resolution="300x400"
        />
        <AppEmbed
          command="GDK_BACKEND=x11 GSK_RENDERER=cairo dbus-launch nemo --no-desktop"
          label="File Manager (Nemo)"
          resolution="700x500"
        />
      </Box>
    </Box>
  );
}
