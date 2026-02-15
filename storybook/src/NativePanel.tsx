/**
 * NativePanel: Mounts a Love2D WASM canvas and renders a story component
 * through the react-reconciler → CanvasBridge → Lua rendering pipeline.
 *
 * This gives a true side-by-side comparison: the same React component
 * rendered by CSS (web panel) vs the Lua layout/painter engine (this panel).
 */

import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import { BridgeProvider, RendererProvider } from '../../../packages/shared/src/context';
import { createRoot } from '../../../packages/native/src/NativeRenderer';
import { CanvasBridge } from '../../../packages/web/src/CanvasBridge';
import type { EmscriptenModule } from '../../../packages/web/src/WebBridge';

interface NativePanelProps {
  storyComponent: ComponentType;
  loveSrc: string;  // Path to love.js WASM entry point
}

export function NativePanel({ storyComponent: StoryComp, loveSrc }: NativePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    let canvasBridge: CanvasBridge | null = null;
    let reconcilerRoot: ReturnType<typeof createRoot> | null = null;
    let canvasEl: HTMLCanvasElement | null = null;

    const init = async () => {
      // Create the Love2D canvas
      canvasEl = document.createElement('canvas');
      const rect = containerRef.current!.getBoundingClientRect();
      canvasEl.width = Math.floor(rect.width) || 400;
      canvasEl.height = Math.floor(rect.height) || 400;
      canvasEl.style.width = '100%';
      canvasEl.style.height = '100%';
      canvasEl.style.display = 'block';
      containerRef.current!.appendChild(canvasEl);

      try {
        // Load the Love2D WASM module in canvas mode
        const Module = await loadCanvasLoveModule(canvasEl, loveSrc);
        if (destroyed) return;

        // Create the CanvasBridge (wires __hostFlush to Module.FS)
        canvasBridge = new CanvasBridge(Module);

        canvasBridge.onReady(() => {
          if (destroyed) return;

          // Create a react-reconciler root
          reconcilerRoot = createRoot();

          // Render the story into the reconciler
          // The reconciler will produce mutation commands that flow
          // through CanvasBridge → Module.FS → Lua tree/layout/painter
          reconcilerRoot.render(
            React.createElement(
              BridgeProvider,
              { bridge: canvasBridge! },
              React.createElement(
                RendererProvider,
                { mode: 'native' },
                React.createElement(StoryComp)
              )
            )
          );

          setStatus('ready');
        });
      } catch (err: any) {
        if (!destroyed) {
          console.error('[NativePanel] Boot error:', err);
          setErrorMsg(err.message || 'Unknown error');
          setStatus('error');
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      reconcilerRoot?.unmount();
      canvasBridge?.destroy();
      if (canvasEl) canvasEl.remove();
    };
  }, [StoryComp, loveSrc]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#334155', fontSize: 12,
        }}>
          Loading Love2D WASM...
        </div>
      )}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
          color: '#ef4444', fontSize: 12,
        }}>
          <div>Failed to load native renderer</div>
          {errorMsg && <div style={{ fontSize: 10, color: '#991b1b', maxWidth: 240, textAlign: 'center' }}>{errorMsg}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Load a Love2D WASM module configured for "canvas" mode.
 * The module writes to Module.FS which the CanvasBridge reads from.
 */
async function loadCanvasLoveModule(
  canvas: HTMLCanvasElement,
  src: string
): Promise<EmscriptenModule> {
  const namespace = 'storybook';

  return new Promise((resolve, reject) => {
    const Module: any = {
      canvas,
      INITIAL_MEMORY: 67108864, // 64MB

      keyboardListeningElement: canvas,

      onRuntimeInitialized: () => {
        resolve(Module as EmscriptenModule);
      },

      onAbort: (msg: string) => {
        reject(new Error(`Love2D WASM abort: ${msg}`));
      },

      print: (text: string) => console.log('[love:storybook]', text),
      printErr: (text: string) => console.warn('[love:storybook]', text),

      // Pre-run: set up canvas mode instead of web mode
      preRun: [
        (mod: any) => {
          // Write the namespace file so bridge_fs can detect it
          mod.FS.writeFile('/__bridge_namespace', namespace);
          // Write a config file that init.lua can read to force canvas mode
          mod.FS.writeFile('/__bridge_mode', 'canvas');
        },
      ],
    };

    const script = document.createElement('script');
    script.src = src;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);

    (window as any)[`Module_${namespace}`] = Module;
  });
}
