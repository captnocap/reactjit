import React, { useState } from 'react';
import { Box, Text, Pressable, Render } from '@reactjit/core';

const C = {
  bg: '#0f0f1a',
  panel: '#1a1a2e',
  border: '#2a2a4a',
  text: '#cdd6f4',
  muted: '#6c7086',
  accent: '#89b4fa',
  tabActive: '#89b4fa',
  tabInactive: '#45475a',
};

const APPS = [
  { id: 'calc', command: 'python3 apps/calculator.py', label: 'Calculator', resolution: '300x400' },
  { id: 'kitty', command: 'kitty -o remember_window_size=no -o initial_window_width=832 -o initial_window_height=709', label: 'Terminal', resolution: '832x709' },
  { id: 'nemo', command: 'GDK_BACKEND=x11 GSK_RENDERER=cairo dbus-launch nemo --no-desktop', label: 'Files', resolution: '832x709' },
];

export function App() {
  const [activeTab, setActiveTab] = useState('kitty');

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      padding: 16,
      gap: 12,
    }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: 'bold' }}>
        {`AppEmbed \u2014 Any App in a React Component`}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        {APPS.map(app => (
          <Pressable
            key={app.id}
            onPress={() => setActiveTab(app.id)}
            style={{
              backgroundColor: activeTab === app.id ? C.tabActive : C.tabInactive,
              paddingLeft: 16, paddingRight: 16,
              paddingTop: 8, paddingBottom: 8,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: activeTab === app.id ? C.bg : C.text, fontSize: 13, fontWeight: 'bold' }}>
              {app.label}
            </Text>
          </Pressable>
        ))}
      </Box>
      <Box style={{ flexGrow: 1, backgroundColor: C.panel, borderRadius: 8, overflow: 'hidden' }}>
        {APPS.map(app => (
          <Render
            key={app.id}
            source="display"
            command={app.command}
            resolution={app.resolution}
            interactive
            style={{
              flexGrow: activeTab === app.id ? 1 : undefined,
              width: activeTab === app.id ? '100%' : 0,
              height: activeTab === app.id ? '100%' : 0,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
