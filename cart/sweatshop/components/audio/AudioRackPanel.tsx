
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

import { useAudioRack } from '../../lib/audio/hooks/useAudioRack';
import { useSynthMaster } from '../../lib/audio/hooks/useSynthMaster';
import { useMIDI } from '../../lib/audio/hooks/useMIDI';
import { ModuleRack } from './ModuleRack';
import { Patchbay } from './Patchbay';
import { PianoKeyboard } from './PianoKeyboard';
import { PitchWheel } from './PitchWheel';
import { Fader } from './Fader';

import type { RackPatch } from '../../lib/audio/types';
import type { MidiMessage } from '../../lib/audio/midi';

const PATCH_STORE_KEY = 'sweatshop.audio.patches.v1';
const SAMPLE_RATES = [44100, 48000, 88200, 96000];
const BUFFER_SIZES = [128, 256, 512, 1024, 2048];

function readPatches(): RackPatch[] {
  try {
    const g: any = globalThis as any;
    const raw = typeof g.__store_get === 'function' ? g.__store_get(PATCH_STORE_KEY)
      : (typeof g.localStorage !== 'undefined' ? g.localStorage.getItem(PATCH_STORE_KEY) : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}
function writePatches(ps: RackPatch[]): void {
  try {
    const g: any = globalThis as any;
    const raw = JSON.stringify(ps);
    if (typeof g.__store_set === 'function') g.__store_set(PATCH_STORE_KEY, raw);
    else if (typeof g.localStorage !== 'undefined') g.localStorage.setItem(PATCH_STORE_KEY, raw);
  } catch (_) {}
}

export function AudioRackPanel() {
  const rackApi = useAudioRack();
  const synth = useSynthMaster(rackApi);
  const midi = useMIDI(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [pitch, setPitch] = useState(0);
  const [patchName, setPatchName] = useState('patch');
  const [patches, setPatches] = useState<RackPatch[]>(() => readPatches());

  // Live MIDI → synth voice. Note on/off routes through the synth master;
  // pitch-bend updates the PitchWheel display for peripheral awareness.
  useEffect(() => {
    const off = midi.subscribe((m: MidiMessage) => {
      if (m.kind === 'noteOn' && typeof m.note === 'number')  synth.noteOn(m.note, m.velocity ?? 100);
      if (m.kind === 'noteOff' && typeof m.note === 'number') synth.noteOff(m.note);
      if (m.kind === 'pitchBend' && typeof m.bend === 'number') setPitch(m.bend);
    });
    return off;
  }, [midi, synth]);

  const savePatch = useCallback(() => {
    const p = rackApi.savePatch(patchName);
    const next = [p, ...patches.filter((x) => x.name !== p.name)].slice(0, 40);
    setPatches(next); writePatches(next);
  }, [patchName, rackApi, patches]);

  const loadPatch = useCallback((p: RackPatch) => {
    rackApi.loadPatch(p);
    setPatchName(p.name);
  }, [rackApi]);

  const deletePatch = useCallback((name: string) => {
    const next = patches.filter((p) => p.name !== name);
    setPatches(next); writePatches(next);
  }, [patches]);

  const tone = COLORS.purple || '#d2a8ff';
  const mode = rackApi.rack.mode;

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Col style={{
        padding: 10, gap: 10,
        backgroundColor: COLORS.appBg || '#02050a',
      }}>
        {/* host-fn gap banner — per no-demo rule, real gap gets a real banner */}
        {mode === 'stub' ? (
          <Row style={{
            padding: 8, borderRadius: 6, gap: 6, alignItems: 'center',
            backgroundColor: COLORS.yellowDeep || '#3a2e14',
            borderWidth: 1, borderColor: COLORS.yellow || '#f2e05a',
          }}>
            <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>NO AUDIO CONTEXT</Text>
            <Text style={{ color: COLORS.textBright, fontSize: 10, flexGrow: 1 }}>
              Host does not expose AudioContext — patch editing, MIDI, and sequencing are live,
              but no sound will be rendered until the cart is run in a host with Web Audio.
            </Text>
          </Row>
        ) : null}

        <Row style={headerStyle(tone)}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
          <Text style={{ color: tone, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>◆ AUDIO RACK</Text>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>engine: {mode} · midi: {midi.ready ? midi.inputs.length + ' in / ' + midi.outputs.length + ' out' : (midi.error || 'unavailable')}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={synth.panicAllNotesOff} style={btn(COLORS.red || '#ff6b6b')}>
            <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>PANIC</Text>
          </Pressable>
        </Row>

        {/* Master bus controls */}
        <Row style={panelBox()}>
          <Fader label="Master" value={rackApi.rack.masterGain} min={0} max={2} accent={tone}
            onChange={(v) => rackApi.setMaster(v)} height={100} />
          <Col style={{ gap: 6, flexGrow: 1, paddingLeft: 12 }}>
            <Stepper label="SR" suffix="Hz" steps={SAMPLE_RATES} value={rackApi.rack.sampleRate} onChange={rackApi.setSampleRate} tone={tone} />
            <Stepper label="BUF" suffix="samp" steps={BUFFER_SIZES} value={rackApi.rack.bufferSize} onChange={rackApi.setBufferSize} tone={tone} />
            <Row style={{ gap: 6, alignItems: 'center' }}>
              <Box style={{
                backgroundColor: COLORS.panelAlt || '#05090f',
                borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
                paddingHorizontal: 8, paddingVertical: 4, flexGrow: 1,
              }}>
                <TextInput value={patchName} onChangeText={setPatchName} placeholder="patch name"
                  style={{ fontSize: 11, color: COLORS.textBright }} />
              </Box>
              <Pressable onPress={savePatch} style={btn(COLORS.green || '#7ee787')}>
                <Text style={{ color: COLORS.green || '#7ee787', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>SAVE PATCH</Text>
              </Pressable>
            </Row>
            <Row style={{ gap: 4, flexWrap: 'wrap' }}>
              {patches.length === 0 ? (
                <Text style={{ color: COLORS.textDim, fontSize: 9 }}>no saved patches yet — save one to persist this rack</Text>
              ) : null}
              {patches.map((p) => (
                <Row key={p.name} style={{
                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                  backgroundColor: COLORS.panelAlt || '#05090f',
                  borderWidth: 1, borderColor: tone, alignItems: 'center', gap: 4,
                }}>
                  <Pressable onPress={() => loadPatch(p)}>
                    <Text style={{ color: tone, fontSize: 9, fontWeight: 700 }}>{p.name}</Text>
                  </Pressable>
                  <Pressable onPress={() => deletePatch(p.name)}>
                    <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9, fontWeight: 700 }}>×</Text>
                  </Pressable>
                </Row>
              ))}
            </Row>
          </Col>
        </Row>

        <ModuleRack rackApi={rackApi} selectedModuleId={selected} onSelect={setSelected} />
        <Patchbay rackApi={rackApi} />

        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
          <PianoKeyboard label="KEYS" rootMidi={48} octaves={2}
            activeNotes={synth.activeNotes}
            onNoteDown={synth.noteOn}
            onNoteUp={synth.noteOff} />
          <PitchWheel label="PITCH" value={pitch} onChange={setPitch} />
        </Row>
      </Col>
    </ScrollView>
  );
}

function Stepper({ label, suffix, steps, value, onChange, tone }: { label: string; suffix?: string; steps: number[]; value: number; onChange: (v: number) => void; tone: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ color: COLORS.textDim, fontSize: 9, width: 36, textAlign: 'right' }}>{label}</Text>
      {steps.map((n) => {
        const active = n === value;
        return (
          <Pressable key={n} onPress={() => onChange(n)} style={{
            paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
            backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
            borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
          }}>
            <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700 }}>{n}</Text>
          </Pressable>
        );
      })}
      {suffix ? <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{suffix}</Text> : null}
    </Row>
  );
}

function headerStyle(tone: string): any {
  return { alignItems: 'center', gap: 8, padding: 10, backgroundColor: COLORS.panelRaised || '#05090f', borderRadius: 6, borderWidth: 1, borderColor: COLORS.border || '#1f2630' };
}
function panelBox(): any {
  return { alignItems: 'flex-start', gap: 8, padding: 10, backgroundColor: COLORS.panelBg || '#0b1018', borderRadius: 6, borderWidth: 1, borderColor: COLORS.border || '#1f2630' };
}
function btn(tone: string): any {
  return { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: COLORS.panelAlt || '#05090f', borderWidth: 1, borderColor: tone };
}
