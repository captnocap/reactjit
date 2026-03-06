/**
 * Love2D app factory -- unified entry point for Love2D targets.
 *
 * Encapsulates NativeBridge, react-reconciler root, BridgeProvider,
 * and the __deferMount/__mount protocol into the same { render, stop }
 * API shape used by all other targets.
 *
 * Usage:
 *   import { createLove2DApp } from '@reactjit/renderer';
 *   const app = createLove2DApp();
 *   app.render(<App />);
 */

import React from 'react';
import type { ReactNode } from 'react';
import { NativeBridge } from './NativeBridge';
import { createRoot } from './NativeRenderer';
import {
  BridgeProvider,
  enableStatePreservation,
  setPreservationBridge,
} from '@reactjit/core';
export interface Love2DAppHandle {
  render(element: ReactNode): void;
  stop(): void;
  /** The underlying bridge instance, for advanced use (useBridge hooks, etc.) */
  bridge: NativeBridge;
}

export function createLove2DApp(): Love2DAppHandle {
  const bridge = new NativeBridge();

  // Expose bridge globally so the rjit test shim can reach it, and for
  // advanced debugging from the QuickJS console. Set before any other
  // init so the test shim (eval'd after this bundle) sees it immediately.
  (globalThis as any).__rjitBridge = bridge;

  // Crypto is optional — wire it up if installed, skip silently if not
  try {
    const { setCryptoBridge } = require('@reactjit/crypto');
    setCryptoBridge(bridge);
  } catch (_) { /* @reactjit/crypto not installed */ }

  // Privacy is optional — wire it up if installed, skip silently if not
  try {
    const { setPrivacyBridge } = require('@reactjit/privacy');
    setPrivacyBridge(bridge);
  } catch (_) { /* @reactjit/privacy not installed */ }
  const root = createRoot();

  // Enable state preservation BEFORE any component renders.
  // On HMR: __hotstateCache exists → atoms were captured → enable immediately.
  // On fresh start: enable eagerly so hook counts are consistent from render #1.
  // The bridge ref is set now; Lua is already running (QuickJS is in-process).
  enableStatePreservation(bridge);

  function doRender(element: ReactNode) {
    // Update bridge ref after HMR (bridge is recreated each reload)
    setPreservationBridge(bridge);
    root.render(
      React.createElement(BridgeProvider, { bridge }, element)
    );
  }

  return {
    bridge,
    render(element: ReactNode) {
      // Lua sets __deferMount = true before JS_Eval, then calls __mount()
      // after eval returns (see lua/init.lua:209,293). This avoids blocking
      // the QuickJS eval with a synchronous React render.
      (globalThis as any).__mount = () => doRender(element);
      if (!(globalThis as any).__deferMount) {
        (globalThis as any).__mount();
      }
    },
    stop() {
      root.unmount();
    },
  };
}
