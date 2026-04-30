/**
 * Audio — declarative wrapper around framework/audio.zig.
 *
 * The Zig audio engine runs at 44.1 kHz with up to 64 modules and 256
 * connections, driven by a lock-free SPSC command queue. JS pushes
 * add/remove/connect/disconnect/set_param/note_on/note_off/master_gain
 * commands; the audio thread consumes them between callbacks.
 *
 * React surface (mirrors the Physics namespace pattern):
 *
 *   <Audio gain={0.8}>
 *     <Audio.Module id="voice1" type="pocket_voice" tone={0.5} drive={0.3} />
 *     <Audio.Module id="delay1" type="delay" feedback={0.4} time={0.25} />
 *     <Audio.Module id="mixer1" type="mixer" />
 *     <Audio.Connection from="voice1" to="delay1" />
 *     <Audio.Connection from="delay1" to="mixer1" toPort={0} />
 *   </Audio>
 *
 *   // Notes don't fit a declarative tree — go through the hook.
 *   const audio = useAudio();
 *   audio.noteOn('voice1', 60);   // 'voice1' resolves through the <Audio> ctx
 *
 * Lifecycle wiring:
 *   <Audio>           mount   →                                          (engine auto-inits on first add)
 *                     prop    → __audioMasterGain(gain)
 *   <Audio.Module>    mount   → __audioAddModule(idNum, typeNum)
 *                     unmount → __audioRemoveModule(idNum)
 *                     props   → __audioSetParam(idNum, paramIdx, value) per typed param
 *   <Audio.Connection> mount  → __audioConnect(fromNum, fromPort, toNum, toPort)
 *                     unmount → __audioDisconnect(...)
 *
 * All host bindings used here already exist in framework/v8_bindings_core.zig:
 *   __audioAddModule  __audioRemoveModule  __audioConnect  __audioDisconnect
 *   __audioSetParam   __audioNoteOn        __audioNoteOff  __audioMasterGain
 * No new Zig bindings are added by this file.
 *
 * Note: there is no `__audioInit` in the camelCase host-fn surface — the
 * engine auto-initializes on its first AddModule. If pause/resume are ever
 * needed they live on the snake-case `__audio_*` surface used directly by
 * cart/pocket_operator.tsx.
 */

const React = require('react');

// ── Module-type enum (matches framework/audio.zig:ModuleType) ─────────

export const AUDIO_MODULE_TYPE = {
  oscillator:   0,
  filter:       1,
  amplifier:    2,
  mixer:        3,
  delay:        4,
  envelope:     5,
  lfo:          6,
  sequencer:    7,
  sampler:      8,
  custom:       9,
  pocket_voice: 10,
} as const;

export type AudioModuleType = keyof typeof AUDIO_MODULE_TYPE;

// ── Per-module-type param-name → index map (matches audio.zig:moduleSetup) ──
//
// Carts pass params on <Audio.Module> by NAME (`feedback={0.4}`); we look up
// the numeric index via this table before calling __audioSetParam. Order is
// authoritative — it must match `addParam(...)` call order in audio.zig.
const AUDIO_PARAM_INDEX: Record<AudioModuleType, Record<string, number>> = {
  oscillator:   { waveform: 0, frequency: 1, detune: 2, gain: 3, fm_amount: 4 },
  filter:       { cutoff: 0, resonance: 1, mode: 2 },
  amplifier:    { gain: 0 },
  mixer:        { gain_1: 0, gain_2: 1, gain_3: 2, gain_4: 3 },
  delay:        { time: 0, feedback: 1, mix: 2 },
  envelope:     { attack: 0, decay: 1, sustain: 2, release: 3 },
  lfo:          { rate: 0, depth: 1, waveform: 2 },
  sequencer:    { bpm: 0, steps: 1 },
  sampler:      { gain: 0, loop: 1 },
  custom:       {},
  pocket_voice: { voice: 0, tone: 1, decay: 2, color: 3, drive: 4, gain: 5 },
};

// ── Host bridges ──────────────────────────────────────────────────────

const host = (): any => globalThis as any;

const hostAdd          = (id: number, mt: number) => host().__audioAddModule?.(id, mt);
const hostRemove       = (id: number) => host().__audioRemoveModule?.(id);
const hostConnect      = (a: number, ap: number, b: number, bp: number) => host().__audioConnect?.(a, ap, b, bp);
const hostDisconnect   = (a: number, ap: number, b: number, bp: number) => host().__audioDisconnect?.(a, ap, b, bp);
const hostSetParam     = (id: number, p: number, v: number) => host().__audioSetParam?.(id, p, v);
const hostNoteOn       = (id: number, midi: number) => host().__audioNoteOn?.(id, midi);
const hostNoteOff      = (id: number) => host().__audioNoteOff?.(id);
const hostMasterGain   = (g: number) => host().__audioMasterGain?.(g);

// ── Audio context ─────────────────────────────────────────────────────
//
// Children (Module / Connection) consume the context to translate string
// ids into the numeric ids the host wants. Module IDs are sequential from
// 1 (id 0 is reserved for the master output by convention).

interface AudioCtx {
  /** name → numeric id assigned at mount. */
  names: Map<string, number>;
  /** Next id to hand out. */
  nextId: { current: number };
  /** Per-id type so the param-name lookup picks the right schema. */
  types: Map<number, AudioModuleType>;
  /** Lookup helper for children + the useAudio hook. */
  getId(name: string): number | undefined;
  getType(idOrName: string | number): AudioModuleType | undefined;
}

const AudioContext = React.createContext<AudioCtx | null>(null);

// ── useAudio — imperative façade for events that don't fit a tree ─────

export interface AudioHandle {
  /** Resolve a string id (set on <Audio.Module id="...">) to its numeric id. */
  getId: (name: string) => number | undefined;
  /** Trigger note-on for a module by name or numeric id. midi is 0..127. */
  noteOn: (target: string | number, midi: number) => void;
  /** Trigger note-off (envelope release / amplitude decay). */
  noteOff: (target: string | number) => void;
  /** Set a typed param by name (resolved through the module's type table). */
  setParam: (target: string | number, paramName: string, value: number) => void;
  /** Set a param by raw numeric index (skip the name → index lookup). */
  setParamIndex: (target: string | number, paramIndex: number, value: number) => void;
}

export function useAudio(): AudioHandle {
  const ctx = React.useContext(AudioContext);
  const resolve = (t: string | number): number =>
    typeof t === 'number' ? t : (ctx?.getId(t) ?? -1);
  return {
    getId: (n: string) => ctx?.getId(n),
    noteOn: (t, midi) => { const id = resolve(t); if (id >= 0) hostNoteOn(id, midi); },
    noteOff: (t) => { const id = resolve(t); if (id >= 0) hostNoteOff(id); },
    setParam: (t, name, v) => {
      const id = resolve(t);
      if (id < 0) return;
      const type = ctx?.getType(t);
      if (!type) return;
      const idx = AUDIO_PARAM_INDEX[type]?.[name];
      if (idx === undefined) return;
      hostSetParam(id, idx, v);
    },
    setParamIndex: (t, idx, v) => { const id = resolve(t); if (id >= 0) hostSetParam(id, idx, v); },
  };
}

// ── <Audio> root ──────────────────────────────────────────────────────

interface AudioProps {
  /** Master output gain, 0..1 (engine clamps). */
  gain?: number;
  children?: any;
}

function AudioRoot({ gain, children }: AudioProps): any {
  // Per-tree id allocator + name registry. Each <Audio> root gets its own
  // namespace so two <Audio> trees in the same cart don't collide on ids.
  const namesRef  = React.useRef<Map<string, number>>(new Map());
  const typesRef  = React.useRef<Map<number, AudioModuleType>>(new Map());
  const nextIdRef = React.useRef({ current: 1 });

  React.useEffect(() => {
    if (typeof gain === 'number') hostMasterGain(gain);
  }, [gain]);

  const ctx: AudioCtx = {
    names:  namesRef.current,
    types:  typesRef.current,
    nextId: nextIdRef.current,
    getId: (name) => namesRef.current.get(name),
    getType: (idOrName) => {
      const id = typeof idOrName === 'number' ? idOrName : namesRef.current.get(idOrName);
      return id !== undefined ? typesRef.current.get(id) : undefined;
    },
  };
  return React.createElement(AudioContext.Provider, { value: ctx }, children);
}

// ── <Audio.Module> ────────────────────────────────────────────────────
//
// id        — string handle other children / useAudio refer to.
// type      — module-type key (e.g. 'pocket_voice', 'delay').
// All other props are param names; values must be numbers.
//
// Mount   → assign numeric id, register name → id, host-add module, push
//           initial params.
// Update  → diff each typed param prop, push __audioSetParam on change.
// Unmount → host-remove module and clear name → id.

interface AudioModuleProps {
  id: string;
  type: AudioModuleType;
  /** Any additional numeric prop is treated as a typed param. */
  [param: string]: any;
}

function AudioModule(props: AudioModuleProps): any {
  const { id: name, type, children: _, ...paramProps } = props;
  const ctx = React.useContext(AudioContext);
  const numIdRef = React.useRef<number>(-1);

  // Allocate a stable numeric id on first render (synchronous so siblings
  // in the same tree see this id immediately when they mount).
  if (numIdRef.current === -1 && ctx) {
    numIdRef.current = ctx.nextId.current++;
    if (name) {
      ctx.names.set(name, numIdRef.current);
      ctx.types.set(numIdRef.current, type);
    }
  }
  const numId = numIdRef.current;

  // Host-add on mount, host-remove on unmount.
  React.useEffect(() => {
    if (numId < 0) return;
    hostAdd(numId, AUDIO_MODULE_TYPE[type]);
    return () => {
      hostRemove(numId);
      if (name && ctx) {
        ctx.names.delete(name);
        ctx.types.delete(numId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push every numeric param every render. React skips no-ops for primitive
  // dep arrays anyway; iterating is cheap and avoids us re-deriving a deps
  // array from a dynamic key set. Use one effect-per-render, gated on numId.
  React.useEffect(() => {
    if (numId < 0) return;
    const schema = AUDIO_PARAM_INDEX[type];
    if (!schema) return;
    for (const key of Object.keys(paramProps)) {
      const idx = schema[key];
      if (idx === undefined) continue;
      const v = paramProps[key];
      if (typeof v === 'number') hostSetParam(numId, idx, v);
    }
  });

  return null;
}

// ── <Audio.Connection> ────────────────────────────────────────────────
//
// Wires two modules' ports together. Mount → __audioConnect, unmount →
// __audioDisconnect. The `from`/`to` props are usually string ids that
// resolve through the <Audio> context, but raw numeric ids work too (e.g.
// 0 for the master output).

interface AudioConnectionProps {
  from: string | number;
  to: string | number;
  fromPort?: number;
  toPort?: number;
}

function AudioConnection({ from, to, fromPort = 0, toPort = 0 }: AudioConnectionProps): any {
  const ctx = React.useContext(AudioContext);
  const resolve = (t: string | number): number =>
    typeof t === 'number' ? t : (ctx?.getId(t) ?? -1);

  React.useEffect(() => {
    // Defer one tick so newly-mounted sibling modules have flushed their
    // own host-add effects first. Without this, connecting to a module
    // mounted in the same render produces "module not found" on the audio
    // thread.
    let connected = false;
    let aId = -1, bId = -1, aPort = fromPort, bPort = toPort;
    const t = setTimeout(() => {
      aId = resolve(from);
      bId = resolve(to);
      if (aId < 0 || bId < 0) return;
      hostConnect(aId, aPort, bId, bPort);
      connected = true;
    }, 0);
    return () => {
      clearTimeout(t);
      if (connected) hostDisconnect(aId, aPort, bId, bPort);
    };
  }, [from, to, fromPort, toPort]);

  return null;
}

// ── Namespace export ──────────────────────────────────────────────────

const AudioBase: any = AudioRoot;
AudioBase.Module     = AudioModule;
AudioBase.Connection = AudioConnection;

/** Root primitive — also exported as the namespace base. */
export const Audio: any = AudioBase;
