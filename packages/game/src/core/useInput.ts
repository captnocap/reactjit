import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBridge } from '@reactjit/core';
import type { InputConfig, InputState, ActionState } from '../types';

interface RawActionState {
  down: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

export function useInput(config: InputConfig): InputState {
  const bridge = useBridge();
  const { actions, deadZone = 0.2 } = config;

  const stateRef = useRef<Record<string, RawActionState>>({});
  const axesRef = useRef<Record<string, number>>({});
  const [, forceRender] = useState(0);

  // Initialize state for all actions
  useMemo(() => {
    for (const name of Object.keys(actions)) {
      if (!stateRef.current[name]) {
        stateRef.current[name] = { down: false, justPressed: false, justReleased: false };
      }
    }
  }, [actions]);

  // Build reverse lookup: key/button → action name
  const keyToActions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [name, binding] of Object.entries(actions)) {
      if (binding.keys) {
        for (const k of binding.keys) {
          const key = k.toLowerCase();
          if (!map[key]) map[key] = [];
          map[key].push(name);
        }
      }
      if (binding.gamepad) {
        const key = `gp:${binding.gamepad}`;
        if (!map[key]) map[key] = [];
        map[key].push(name);
      }
    }
    return map;
  }, [actions]);

  // Subscribe to keyboard events
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(bridge.subscribe('keydown', (e: any) => {
      const key = (e.key || '').toLowerCase();
      const mapped = keyToActions[key];
      if (!mapped) return;
      for (const name of mapped) {
        const s = stateRef.current[name];
        if (s && !s.down) {
          s.down = true;
          s.justPressed = true;
        }
      }
      forceRender(n => n + 1);
    }));

    unsubs.push(bridge.subscribe('keyup', (e: any) => {
      const key = (e.key || '').toLowerCase();
      const mapped = keyToActions[key];
      if (!mapped) return;
      for (const name of mapped) {
        const s = stateRef.current[name];
        if (s && s.down) {
          s.down = false;
          s.justReleased = true;
        }
      }
      forceRender(n => n + 1);
    }));

    unsubs.push(bridge.subscribe('gamepadpressed', (e: any) => {
      const key = `gp:${e.gamepadButton}`;
      const mapped = keyToActions[key];
      if (!mapped) return;
      for (const name of mapped) {
        const s = stateRef.current[name];
        if (s && !s.down) {
          s.down = true;
          s.justPressed = true;
        }
      }
      forceRender(n => n + 1);
    }));

    unsubs.push(bridge.subscribe('gamepadreleased', (e: any) => {
      const key = `gp:${e.gamepadButton}`;
      const mapped = keyToActions[key];
      if (!mapped) return;
      for (const name of mapped) {
        const s = stateRef.current[name];
        if (s && s.down) {
          s.down = false;
          s.justReleased = true;
        }
      }
      forceRender(n => n + 1);
    }));

    unsubs.push(bridge.subscribe('gamepadaxis', (e: any) => {
      if (e.axis !== undefined && e.axisValue !== undefined) {
        const val = Math.abs(e.axisValue) < deadZone ? 0 : e.axisValue;
        axesRef.current[e.axis] = val;
      }
    }));

    return () => unsubs.forEach(fn => fn());
  }, [bridge, keyToActions, deadZone]);

  // Clear per-frame flags after each render
  useEffect(() => {
    const id = setTimeout(() => {
      let changed = false;
      for (const s of Object.values(stateRef.current)) {
        if (s.justPressed || s.justReleased) {
          s.justPressed = false;
          s.justReleased = false;
          changed = true;
        }
      }
    }, 0);
    return () => clearTimeout(id);
  });

  const held = useCallback((action: string) => {
    return stateRef.current[action]?.down ?? false;
  }, []);

  const pressed = useCallback((action: string) => {
    return stateRef.current[action]?.justPressed ?? false;
  }, []);

  const released = useCallback((action: string) => {
    return stateRef.current[action]?.justReleased ?? false;
  }, []);

  const axis = useCallback((axisName: string) => {
    return axesRef.current[axisName] ?? 0;
  }, []);

  return { held, pressed, released, axis };
}
