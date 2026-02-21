/**
 * Hammerspoon Demo — Pixel-based desktop overlay widget.
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
    <Box style={{ backgroundColor: '#1a1a2e', padding: 10 }}>
      <Text style={{ color: '#e0e0e0', fontSize: 14 }}>{time}</Text>
    </Box>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box style={{ flexDirection: 'column', width: '100%', height: '100%', padding: 8 }}>
      <Text style={{ color: '#aaaaaa', fontSize: 14 }}>{label}</Text>
      <Box style={{ height: 20, backgroundColor: '#333333' }}>
        <Box style={{ width: `${value}%`, height: 20, backgroundColor: color }} />
      </Box>
      <Text style={{ color: '#ffffff', fontSize: 14 }}>{`${value}%`}</Text>
    </Box>
  );
}

export default function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f0f23', flexDirection: 'column' }}>
      <Box style={{ backgroundColor: '#16213e', padding: 12 }}>
        <Text style={{ color: '#ffffff', fontSize: 14 }}>ReactJIT Desktop Widget</Text>
      </Box>
      <Clock />
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        <Meter label="CPU" value={42} color="#e94560" />
        <Meter label="RAM" value={67} color="#533483" />
        <Meter label="Disk" value={23} color="#0f3460" />
      </Box>
    </Box>
  );
}
