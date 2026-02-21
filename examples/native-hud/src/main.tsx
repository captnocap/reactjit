/**
 * Native renderer entry point.
 *
 * This file is bundled by esbuild into a single IIFE (bundle.js)
 * that QuickJS evaluates inside Love2D. It boots the NativeBridge,
 * creates a react-reconciler root, and renders the shared HUD.
 */

import React from 'react';
import { NativeBridge } from '../../../packages/native/src/NativeBridge';
import { createRoot } from '../../../packages/native/src/NativeRenderer';
import { BridgeProvider, RendererProvider } from '../../../packages/shared/src/context';
import { HUD } from '../../shared-components';

// Boot the bridge (QuickJS FFI — immediately ready)
const bridge = new NativeBridge();

// Create a react-reconciler root (legacy sync mode)
const root = createRoot();

// Render the app
root.render(
  <BridgeProvider bridge={bridge}>
    <RendererProvider mode="native">
      <HUD />
    </RendererProvider>
  </BridgeProvider>
);

console.log('[reactjit] Native HUD mounted');
