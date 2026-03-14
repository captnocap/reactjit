import React, { useState } from 'react';
import { createTerminalApp } from '@reactjit/terminal';
import { useLuaInterval } from '@reactjit/core';
import { getSystemInfo } from './sysinfo';
import App from './App';

function TerminalNeofetch() {
  const [info, setInfo] = useState(getSystemInfo());
  useLuaInterval(30_000, () => setInfo(getSystemInfo()));
  return (
    <App
      info={info}
      heartPx={1}
      padding={1}
      cardPadding={0}
      gap={2}
      lineGap={0}
      fontSize={1}
      titleSize={1}
      labelWidth={9}
      showCard={false}
    />
  );
}

const app = createTerminalApp({ fps: 30, fullscreen: true });
app.render(<TerminalNeofetch />);
