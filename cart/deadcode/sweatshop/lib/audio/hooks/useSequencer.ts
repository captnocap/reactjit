// useSequencer — drives a sequencer module's step state via requestAnimationFrame
// so UIs can light the current step and edit per-step notes/gates/velocities.


import type { AudioRackApi } from './useAudioRack';
import type { SeqStepData, SeqRuntime } from '../modules/Sequencer';
import { seqTick } from '../modules/Sequencer';

export interface SequencerApi {
  steps: SeqStepData[];
  activeStep: number;
  isPlaying: boolean;
  lastGate: number;
  lastCv: number;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setStep: (i: number, data: Partial<SeqStepData>) => void;
  setStepCount: (n: number) => void;
}

export function useSequencer(rackApi: AudioRackApi, sequencerId: string): SequencerApi {
  const [, bump] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const gateRef = useRef<number>(0);
  const cvRef = useRef<number>(0);

  const mod = rackApi.rack.modules.find((m) => m.id === sequencerId);
  const state: SeqRuntime = (mod?.state as SeqRuntime) || { steps: [], index: 0, phase: 0, dir: 1 };

  const step = useCallback(() => {
    if (!playing) { rafRef.current = null; return; }
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
    lastRef.current = now;
    if (mod) {
      const out = seqTick(mod.values, state, dt);
      gateRef.current = out.gate;
      cvRef.current = out.cv;
      if (out.stepChanged) bump((x: number) => x + 1);
    }
    rafRef.current = (globalThis as any).requestAnimationFrame ? (globalThis as any).requestAnimationFrame(step) : setTimeout(step, 16) as any;
  }, [playing, mod, state]);

  useEffect(() => {
    if (!playing) return;
    lastRef.current = 0;
    step();
    return () => {
      if (rafRef.current != null) {
        const g: any = globalThis as any;
        if (g.cancelAnimationFrame) g.cancelAnimationFrame(rafRef.current);
        else clearTimeout(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playing, step]);

  return {
    steps: state.steps,
    activeStep: state.index,
    isPlaying: playing,
    lastGate: gateRef.current,
    lastCv: cvRef.current,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    reset: () => { state.index = 0; state.phase = 0; bump((x: number) => x + 1); },
    setStep: (i: number, data: Partial<SeqStepData>) => {
      const s = state.steps[i];
      if (!s) return;
      Object.assign(s, data);
      bump((x: number) => x + 1);
    },
    setStepCount: (n: number) => {
      const target = Math.max(1, Math.min(64, n));
      while (state.steps.length < target) state.steps.push({ note: 60, gate: 1, velocity: 0.8 });
      state.steps.length = target;
      if (mod) rackApi.setParam(mod.id, 'steps', target);
      bump((x: number) => x + 1);
    },
  };
}
