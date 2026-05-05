// useSynthMaster — opinionated "synth patch" preset. Ensures a minimal signal
// path exists in the rack (VCO → VCF → VCA + LFO → VCF, Env → VCA) and exposes
// noteOn/noteOff helpers so a keyboard or MIDI listener can trigger the voice.


import type { AudioRackApi } from './useAudioRack';
import { noteToFreq } from '../midi';

export interface SynthMasterApi {
  ready: boolean;
  vcoId: string | null;
  vcfId: string | null;
  vcaId: string | null;
  lfoId: string | null;
  envId: string | null;
  noteOn: (note: number, velocity?: number) => void;
  noteOff: (note: number) => void;
  panicAllNotesOff: () => void;
  setMaster: (g: number) => void;
  activeNotes: number[];
}

export function useSynthMaster(rackApi: AudioRackApi): SynthMasterApi {
  const [active, setActive] = useState<number[]>([]);

  const ids = useMemo(() => {
    const find = (k: string) => rackApi.rack.modules.find((m) => m.kind === k)?.id ?? null;
    return { vco: find('vco'), vcf: find('vcf'), vca: find('vca'), lfo: find('lfo'), env: find('envelope') };
  }, [rackApi.rack, rackApi.revision]);

  // If the default path is missing, create the missing pieces once.
  useEffect(() => {
    const r = rackApi.rack;
    let changed = false;
    const ensure = (kind: string) => {
      if (!r.modules.find((m) => m.kind === kind)) { rackApi.addModule(kind as any); changed = true; }
    };
    ensure('vco'); ensure('vcf'); ensure('vca'); ensure('lfo'); ensure('envelope');
    if (changed) {
      // wire a canonical chain the first time we see the modules
      const next = r.modules;
      const vco = next.find((m) => m.kind === 'vco');
      const vcf = next.find((m) => m.kind === 'vcf');
      const vca = next.find((m) => m.kind === 'vca');
      const lfo = next.find((m) => m.kind === 'lfo');
      const env = next.find((m) => m.kind === 'envelope');
      if (vco && vcf) rackApi.connect(vco.id, 'out',   vcf.id, 'in');
      if (vcf && vca) rackApi.connect(vcf.id, 'out',   vca.id, 'in');
      if (lfo && vcf) rackApi.connect(lfo.id, 'cv',    vcf.id, 'cutCV');
      if (env && vca) rackApi.connect(env.id, 'cv',    vca.id, 'cv');
    }
  }, [rackApi]);

  const noteOn = useCallback((note: number, velocity: number = 100) => {
    if (ids.vco) rackApi.setParam(ids.vco, 'freq', noteToFreq(note));
    if (ids.vca) rackApi.setParam(ids.vca, 'gain', Math.max(0, Math.min(1, velocity / 127)));
    setActive((prev: number[]) => prev.includes(note) ? prev : prev.concat([note]));
  }, [ids.vco, ids.vca, rackApi]);

  const noteOff = useCallback((note: number) => {
    setActive((prev: number[]) => prev.filter((n) => n !== note));
    // Envelope handles release via gate-off; this is a no-op on the VCO side.
  }, []);

  const panicAllNotesOff = useCallback(() => setActive([]), []);

  const setMaster = useCallback((g: number) => rackApi.setMaster(g), [rackApi]);

  return {
    ready: !!(ids.vco && ids.vcf && ids.vca),
    vcoId: ids.vco, vcfId: ids.vcf, vcaId: ids.vca, lfoId: ids.lfo, envId: ids.env,
    noteOn, noteOff, panicAllNotesOff, setMaster,
    activeNotes: active,
  };
}
