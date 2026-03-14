/**
 * Void Station — reactjit demo entry point.
 *
 * Wires together:
 * - MockBridge (simulates Love2D game state)
 * - Canvas renderer (draws the space scene)
 * - React HUD overlay (shared primitives via BridgeProvider)
 *
 * This demonstrates the reactjit pattern: a game engine renders
 * the scene, React renders the UI, and a bridge connects them.
 * In production, the canvas would be a Love2D WASM instance.
 */

import { createRoot } from 'react-dom/client';
import { BridgeProvider, RendererProvider } from '../../../packages/shared/src/context';
import { MockBridge } from './MockBridge';
import { initCanvas } from './canvas';
import { StationHUD } from './components';

// Root element
const rootEl = document.getElementById('root')!;

// Canvas layer (simulates what Love2D would render)
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%';
rootEl.appendChild(canvas);

// HUD layer (React overlay)
const hudEl = document.createElement('div');
hudEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%';
rootEl.appendChild(hudEl);

// Boot the simulation
const bridge = new MockBridge();
initCanvas(canvas, bridge);

// Mount React
const root = createRoot(hudEl);
root.render(
  <BridgeProvider bridge={bridge}>
    <RendererProvider mode="web">
      <StationHUD />
    </RendererProvider>
  </BridgeProvider>
);
