/**
 * Neovim Demo — Dashboard rendered in a Neovim floating window.
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
    <Box style={{ backgroundColor: '#3366CC', padding: 1 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 12 }}>{time}</Text>
    </Box>
  );
}

function StatusCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box style={{ backgroundColor: color, padding: 1, width: '100%', height: '100%' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#DEDE6C', fontSize: 12 }}>{value}</Text>
    </Box>
  );
}

export default function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#111111', flexDirection: 'column', gap: 1 }}>
      <Box style={{ backgroundColor: '#4C4C4C', padding: 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 12 }}>ReactJIT Neovim</Text>
      </Box>
      <Clock />
      <Box style={{ flexDirection: 'row', gap: 1 }}>
        <StatusCard label="Bufs" value="12" color="#57A64E" />
        <StatusCard label="LSP" value="OK" color="#B266E5" />
        <StatusCard label="Git" value="+3" color="#4C99B2" />
      </Box>
    </Box>
  );
}
