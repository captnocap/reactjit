/**
 * AwesomeWM Demo — Status bar widget rendered via Cairo.
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
    <Box style={{ backgroundColor: '#285577', padding: 4, width: '100%', height: '100%' }}>
      <Text style={{ color: '#ffffff', fontSize: 12 }}>{time}</Text>
    </Box>
  );
}

function Tag({ name, active }: { name: string; active?: boolean }) {
  return (
    <Box style={{ backgroundColor: active ? '#4c7899' : '#333333', padding: 4 }}>
      <Text style={{ color: active ? '#ffffff' : '#888888', fontSize: 12 }}>{name}</Text>
    </Box>
  );
}

export default function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#222222', flexDirection: 'row' }}>
      <Tag name="1" active />
      <Tag name="2" />
      <Tag name="3" />
      <Box style={{ backgroundColor: '#333333', padding: 4, flexGrow: 1 }}>
        <Text style={{ color: '#cccccc', fontSize: 12 }}>ReactJIT</Text>
      </Box>
      <Clock />
      <Box style={{ backgroundColor: '#333333', padding: 4 }}>
        <Text style={{ color: '#aaaaaa', fontSize: 12 }}>Vol: 75%</Text>
      </Box>
    </Box>
  );
}
