import { useState, useRef, useCallback } from 'react';
import type { CameraConfig, CameraState, ShakeConfig } from '../types';

export function useCamera(config: CameraConfig = {}): CameraState {
  const { follow, smoothing = 0.1, bounds, zoom: initialZoom = 1, offset } = config;

  const [, forceRender] = useState(0);
  const posRef = useRef({ x: follow?.x ?? 0, y: follow?.y ?? 0 });
  const zoomRef = useRef(initialZoom);
  const shakeRef = useRef({ intensity: 0, duration: 0, elapsed: 0, decay: 'exponential' as string, offsetX: 0, offsetY: 0 });

  /** Call each frame with dt to update camera position */
  const update = useCallback((dt: number, target?: { x: number; y: number }) => {
    const pos = posRef.current;
    const t = target || follow;

    if (t) {
      const ox = offset?.x ?? 0;
      const oy = offset?.y ?? 0;
      const targetX = t.x + ox;
      const targetY = t.y + oy;

      // Lerp toward target
      const factor = 1 - Math.pow(smoothing, dt * 60);
      pos.x += (targetX - pos.x) * factor;
      pos.y += (targetY - pos.y) * factor;
    }

    // Clamp to bounds
    if (bounds) {
      pos.x = Math.max(bounds.x, Math.min(bounds.x + bounds.w, pos.x));
      pos.y = Math.max(bounds.y, Math.min(bounds.y + bounds.h, pos.y));
    }

    // Update shake
    const shake = shakeRef.current;
    if (shake.duration > 0) {
      shake.elapsed += dt;
      if (shake.elapsed >= shake.duration) {
        shake.duration = 0;
        shake.offsetX = 0;
        shake.offsetY = 0;
      } else {
        const progress = shake.elapsed / shake.duration;
        const factor = shake.decay === 'exponential'
          ? Math.pow(1 - progress, 2)
          : 1 - progress;
        const angle = Math.random() * Math.PI * 2;
        shake.offsetX = Math.cos(angle) * shake.intensity * factor;
        shake.offsetY = Math.sin(angle) * shake.intensity * factor;
      }
    }

    forceRender(n => n + 1);
  }, [follow, smoothing, bounds, offset]);

  const startShake = useCallback((cfg: ShakeConfig) => {
    shakeRef.current = {
      intensity: cfg.intensity,
      duration: cfg.duration / 1000,
      elapsed: 0,
      decay: cfg.decay || 'exponential',
      offsetX: 0,
      offsetY: 0,
    };
  }, []);

  const setZoom = useCallback((z: number) => {
    zoomRef.current = z;
    forceRender(n => n + 1);
  }, []);

  // Expose update as a property the consumer calls
  const result: CameraState & { update: typeof update } = {
    x: posRef.current.x + shakeRef.current.offsetX,
    y: posRef.current.y + shakeRef.current.offsetY,
    zoom: zoomRef.current,
    shake: startShake,
    setZoom,
    update,
  };

  return result;
}
