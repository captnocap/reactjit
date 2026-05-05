// Damped spring physics hook. Animates a scalar toward a target using stiffness,
// damping, and mass — same parametrization used by react-spring's 'SpringConfig'.
// rAF-driven; settles when velocity and displacement fall under the precision bar.


export interface SpringConfig {
  stiffness?: number;   // k
  damping?: number;     // c
  mass?: number;        // m
  precision?: number;   // below this magnitude we snap & stop
  clamp?: boolean;      // stop at target rather than overshoot
  velocity?: number;    // initial velocity
}

export interface SpringState {
  value: number;
  velocity: number;
  settled: boolean;
}

export const SPRING_PRESETS: Record<string, SpringConfig> = {
  gentle:  { stiffness: 120, damping: 14, mass: 1 },
  wobbly:  { stiffness: 180, damping: 12, mass: 1 },
  stiff:   { stiffness: 210, damping: 20, mass: 1 },
  slow:    { stiffness:  60, damping: 15, mass: 1 },
  molasses:{ stiffness: 280, damping: 120, mass: 1 },
  snappy:  { stiffness: 400, damping: 30, mass: 1 },
};

function step(state: SpringState, target: number, cfg: Required<SpringConfig>, dtSec: number): SpringState {
  // semi-implicit Euler — cheap and stable at rAF timesteps
  const disp = state.value - target;
  const accel = (-cfg.stiffness * disp - cfg.damping * state.velocity) / cfg.mass;
  let velocity = state.velocity + accel * dtSec;
  let value = state.value + velocity * dtSec;
  if (cfg.clamp && (state.value - target) * (value - target) < 0) { value = target; velocity = 0; }
  const settled = Math.abs(velocity) < cfg.precision && Math.abs(value - target) < cfg.precision;
  if (settled) return { value: target, velocity: 0, settled: true };
  return { value, velocity, settled: false };
}

export function useSpring(target: number, cfg?: SpringConfig): SpringState {
  const defaults: Required<SpringConfig> = {
    stiffness: cfg?.stiffness ?? 170,
    damping:   cfg?.damping   ?? 26,
    mass:      cfg?.mass      ?? 1,
    precision: cfg?.precision ?? 0.001,
    clamp:     cfg?.clamp     ?? false,
    velocity:  cfg?.velocity  ?? 0,
  };

  const [state, setState] = useState<SpringState>({ value: target, velocity: defaults.velocity, settled: true });
  const stateRef = useRef<SpringState>(state);
  stateRef.current = state;
  const targetRef = useRef(target);
  targetRef.current = target;
  const lastRef = useRef<number>(0);
  const rafRef = useRef<any>(null);

  useEffect(() => {
    if (Math.abs(stateRef.current.value - target) < defaults.precision && Math.abs(stateRef.current.velocity) < defaults.precision) {
      setState({ value: target, velocity: 0, settled: true });
      return;
    }
    // Start/continue the animation loop if not already running.
    if (rafRef.current != null) return;
    const g: any = globalThis as any;
    const raf = g.requestAnimationFrame ? (fn: any) => g.requestAnimationFrame(fn) : (fn: any) => setTimeout(fn, 16);
    const caf = g.cancelAnimationFrame || clearTimeout;
    lastRef.current = 0;
    const tick = (now: number) => {
      const t = typeof now === 'number' ? now : Date.now();
      const dt = lastRef.current ? Math.min(0.05, (t - lastRef.current) / 1000) : 0.016;
      lastRef.current = t;
      const next = step(stateRef.current, targetRef.current, defaults, dt);
      setState(next);
      if (!next.settled) rafRef.current = raf(tick);
      else { rafRef.current = null; lastRef.current = 0; }
    };
    rafRef.current = raf(tick);
    return () => {
      if (rafRef.current != null) { try { caf(rafRef.current); } catch (_) {} rafRef.current = null; }
    };
  }, [target, defaults.stiffness, defaults.damping, defaults.mass, defaults.precision, defaults.clamp]);

  return state;
}

// Plain non-React spring integrator — useful for rendering a spring's full
// trajectory into a Graph.Path for the preview panel.
export function simulateSpring(target: number, cfg: SpringConfig, initial: number = 0, samples: number = 120, dtSec: number = 1 / 60): number[] {
  const defaults: Required<SpringConfig> = {
    stiffness: cfg.stiffness ?? 170, damping: cfg.damping ?? 26, mass: cfg.mass ?? 1,
    precision: cfg.precision ?? 0.0001, clamp: cfg.clamp ?? false, velocity: cfg.velocity ?? 0,
  };
  const out: number[] = [];
  let s: SpringState = { value: initial, velocity: defaults.velocity, settled: false };
  for (let i = 0; i < samples; i++) {
    out.push(s.value);
    s = step(s, target, defaults, dtSec);
    if (s.settled) { while (out.length < samples) out.push(target); break; }
  }
  return out;
}
