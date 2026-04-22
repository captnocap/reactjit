// =============================================================================
// useGamepad — polls SDL gamepad state through host fns, or reports the gap
// =============================================================================
// Probes the runtime for `__gamepad_list`, `__gamepad_state`, and (optionally)
// `__gamepad_poll` on mount. If bound, polls every pollMs (default 16ms) and
// returns the latest state for the requested joystick id (or the first one
// connected if id is omitted). If NOT bound, returns an empty state + a
// GamepadBridge {bound:false, gap:'...'} so the UI can surface a banner.
//
// NEVER synthesises fake presses or axis movement. An unbound runtime is
// observable, not mocked.
// =============================================================================

import type { GamepadBridge, GamepadState } from './types';

const host: any = globalThis;

function probe(): GamepadBridge {
  const haveList  = typeof host.__gamepad_list  === 'function';
  const haveState = typeof host.__gamepad_state === 'function';
  if (!haveList || !haveState) {
    return {
      bound: false,
      gap: 'gamepad host fn bindings pending — connect a controller later. '
        + 'Missing: '
        + (!haveList  ? '__gamepad_list ' : '')
        + (!haveState ? '__gamepad_state' : ''),
    };
  }
  return { bound: true, gap: '' };
}

const EMPTY_STATE: GamepadState = {
  id: -1,
  name: '',
  buttons: {},
  axes: {},
  frame: 0,
};

export interface UseGamepadOptions {
  /** Specific joystick id to track. Omit to auto-pick the first connected. */
  id?: number;
  /** Poll cadence in ms. 16 ≈ 60 Hz. */
  pollMs?: number;
}

export function useGamepad(opts: UseGamepadOptions = {}): {
  state: GamepadState;
  bridge: GamepadBridge;
} {
  const [bridge] = useState(() => probe());
  const [state, setState] = useState<GamepadState>(EMPTY_STATE);
  const pollMs = opts.pollMs ?? 16;
  const wantId = typeof opts.id === 'number' ? opts.id : null;
  const frameRef = useRef(0);

  useEffect(() => {
    if (!bridge.bound) return;
    const tick = () => {
      try {
        const listRaw = host.__gamepad_list();
        const list: Array<{ id: number; name: string }> =
          typeof listRaw === 'string' ? JSON.parse(listRaw) : (listRaw || []);
        if (!list || list.length === 0) { setState(EMPTY_STATE); return; }
        const target = wantId !== null ? list.find((g) => g.id === wantId) : list[0];
        if (!target) { setState(EMPTY_STATE); return; }
        const rawState = host.__gamepad_state(target.id);
        const parsed = typeof rawState === 'string' ? JSON.parse(rawState) : rawState;
        frameRef.current += 1;
        setState({
          id: target.id,
          name: String(target.name || ''),
          buttons: (parsed && parsed.buttons) || {},
          axes:    (parsed && parsed.axes)    || {},
          frame: frameRef.current,
        });
      } catch {
        // Host fn threw — report an empty state this tick rather than crash.
        setState(EMPTY_STATE);
      }
    };
    const handle = setInterval(tick, Math.max(4, pollMs));
    tick();
    return () => { try { clearInterval(handle); } catch {} };
  }, [bridge.bound, pollMs, wantId]);

  return { state, bridge };
}
