/**
 * Native renderer entry point.
 *
 * This file is bundled by esbuild into a single IIFE (bundle.js)
 * that QuickJS evaluates inside Love2D. It boots the NativeBridge,
 * creates a react-reconciler root, and renders the shared HUD.
 */

import React from 'react';
import { NativeBridge } from '../../../packages/renderer/src/NativeBridge';
import { createRoot } from '../../../packages/renderer/src/NativeRenderer';
import { BridgeProvider } from '../../../packages/core/src/context';
import { HUD } from '../../shared-components';

// Boot the bridge (QuickJS FFI — immediately ready)
const bridge = new NativeBridge();

// Create a react-reconciler root (legacy sync mode)
const root = createRoot();

// Render the app
root.render(
  <BridgeProvider bridge={bridge}>
    <HUD />
  </BridgeProvider>
);

console.log('[reactjit] Native HUD mounted');
