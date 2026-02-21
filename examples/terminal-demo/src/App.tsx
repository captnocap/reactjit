/**
 * Terminal Demo — Dashboard rendered directly in the terminal.
 *
 * Uses 24-bit ANSI truecolor for rich styling.
 * First pure-JS target — no Lua, no WebSocket, no external client.
 */

import React, { useState, useEffect } from 'react';

function Box({ style, children }: { style?: any; children?: React.ReactNode }) {
  return <view style={style}>{children}</view>;
}

function Text({ style, children }: { style?: any; children?: React.ReactNode }) {
  return <text style={style}>{children}</text>;
}

function Clock() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <Box style={{ backgroundColor: '#1a1a2e', padding: 1 }}>
      <Text style={{ color: '#e94560', fontSize: 13 }}>{time}</Text>
    </Box>
  );
}

function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  const barWidth = 20;
  const filled = Math.round((value / 100) * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  return (
    <Box style={{ flexDirection: 'row', padding: 1 }}>
      <Box style={{ width: 8 }}>
        <Text style={{ color: '#888888', fontSize: 13 }}>{label}</Text>
      </Box>
      <Box style={{ flexGrow: 1 }}>
        <Text style={{ color, fontSize: 13 }}>{bar}</Text>
      </Box>
      <Box style={{ width: 6 }}>
        <Text style={{ color: '#ffffff', fontSize: 13 }}>{`${value}%`}</Text>
      </Box>
    </Box>
  );
}

function SystemInfo() {
  const [cpu, setCpu] = useState(42);
  const [mem, setMem] = useState(67);
  const [disk, setDisk] = useState(23);

  useEffect(() => {
    const t = setInterval(() => {
      setCpu(prev => Math.max(5, Math.min(95, prev + Math.floor(Math.random() * 11) - 5)));
      setMem(prev => Math.max(30, Math.min(90, prev + Math.floor(Math.random() * 7) - 3)));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <Box style={{ flexDirection: 'column' }}>
      <ProgressBar label="CPU" value={cpu} color="#e94560" />
      <ProgressBar label="Memory" value={mem} color="#533483" />
      <ProgressBar label="Disk" value={disk} color="#0f3460" />
    </Box>
  );
}

export default function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0a0a0a', flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{ backgroundColor: '#16213e', padding: 1 }}>
        <Text style={{ color: '#e94560', fontSize: 13 }}>ReactJIT Terminal</Text>
      </Box>

      {/* Clock */}
      <Clock />

      {/* System metrics */}
      <Box style={{ backgroundColor: '#0f0f23', padding: 1, flexGrow: 1 }}>
        <Text style={{ color: '#444466', fontSize: 13 }}>System Resources</Text>
        <SystemInfo />
      </Box>

      {/* Footer */}
      <Box style={{ backgroundColor: '#16213e', padding: 1 }}>
        <Text style={{ color: '#555577', fontSize: 13 }}>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
