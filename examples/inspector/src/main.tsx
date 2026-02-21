import React from 'react';
import { createLove2DApp } from '@reactjit/native';
import { CartridgeInspector } from '@reactjit/core';
import { ThemeProvider, useThemeColors } from '@reactjit/theme';
import { PortalHost } from '@reactjit/core';

function InspectorApp() {
  const c = useThemeColors();
  return <CartridgeInspector colors={c} />;
}

const app = createLove2DApp();
app.render(
  <ThemeProvider>
    <PortalHost>
      <InspectorApp />
    </PortalHost>
  </ThemeProvider>
);
