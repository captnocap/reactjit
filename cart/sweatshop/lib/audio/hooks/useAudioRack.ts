// useAudioRack — holds a single Rack state. Returns a stable api so UI
// components can add/remove/connect without threading props through.


import {
  createRack, addModule, removeModule, reorderModule,
  connect as connectPorts, disconnect as disconnectCable,
  setParam, setBypass, setMasterGain, serializePatch, loadPatch,
  type Rack, type EngineOptions,
} from '../engine';
import type { Connection, Module, ModuleKind, RackPatch } from '../types';

export interface AudioRackApi {
  rack: Rack;
  addModule: (kind: ModuleKind) => Module;
  removeModule: (id: string) => void;
  reorder: (id: string, toIndex: number) => void;
  connect: (fromModule: string, fromPort: string, toModule: string, toPort: string) => Connection;
  disconnect: (id: string) => void;
  setParam: (moduleId: string, paramId: string, value: number | string | boolean) => void;
  setBypass: (moduleId: string, bypass: boolean) => void;
  setMaster: (g: number) => void;
  setSampleRate: (hz: number) => void;
  setBufferSize: (n: number) => void;
  savePatch: (name?: string) => RackPatch;
  loadPatch: (p: RackPatch) => void;
  revision: number;
}

export function useAudioRack(opts?: EngineOptions): AudioRackApi {
  const rackRef = useRef<Rack>(createRack(opts));
  const [rev, setRev] = useState(0);
  const bump = useCallback(() => setRev((r: number) => r + 1), []);

  // Keep the ref stable across sample-rate / buffer-size changes.
  useEffect(() => {
    if (!opts) return;
    const r = rackRef.current;
    if (opts.sampleRate && r.sampleRate !== opts.sampleRate) r.sampleRate = opts.sampleRate;
    if (opts.bufferSize && r.bufferSize !== opts.bufferSize) r.bufferSize = opts.bufferSize;
    if (typeof opts.masterGain === 'number') r.masterGain = opts.masterGain;
  }, [opts?.sampleRate, opts?.bufferSize, opts?.masterGain]);

  return {
    rack: rackRef.current,
    revision: rev,
    addModule: (kind: ModuleKind) => { const m = addModule(rackRef.current, kind); bump(); return m; },
    removeModule: (id: string) => { removeModule(rackRef.current, id); bump(); },
    reorder: (id: string, toIndex: number) => { reorderModule(rackRef.current, id, toIndex); bump(); },
    connect: (fm, fp, tm, tp) => { const c = connectPorts(rackRef.current, fm, fp, tm, tp); bump(); return c; },
    disconnect: (id: string) => { disconnectCable(rackRef.current, id); bump(); },
    setParam: (mid, pid, v) => { setParam(rackRef.current, mid, pid, v); bump(); },
    setBypass: (mid, b) => { setBypass(rackRef.current, mid, b); bump(); },
    setMaster: (g: number) => { setMasterGain(rackRef.current, g); bump(); },
    setSampleRate: (hz: number) => { rackRef.current.sampleRate = hz; bump(); },
    setBufferSize: (n: number) => { rackRef.current.bufferSize = n; bump(); },
    savePatch: (name?: string) => serializePatch(rackRef.current, name || 'patch'),
    loadPatch: (p: RackPatch) => { loadPatch(rackRef.current, p); bump(); },
  };
}
