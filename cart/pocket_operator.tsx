import { useEffect, useRef, useState } from 'react';
import { Box, Text, Pressable, ScrollView } from '@reactjit/runtime/primitives';

type StepLevel = 0 | 1 | 2;
type TrackParams = {
  tone: number;
  decay: number;
  color: number;
  drive: number;
  gain: number;
};
type Track = {
  id: string;
  label: string;
  color: string;
  moduleId: number;
  voice: number;
  baseNote: number;
  steps: StepLevel[];
  notes: number[];
  params: TrackParams;
};

const host: any = globalThis as any;

const MODULE = {
  mixer: 3,
  delay: 4,
  pocket: 10,
};

const PO_PARAM = {
  voice: 0,
  tone: 1,
  decay: 2,
  color: 3,
  drive: 4,
  gain: 5,
};

const DELAY_PARAM = {
  time: 0,
  feedback: 1,
  mix: 2,
};

const MIXER_ID = 900;
const DELAY_ID = 901;
const TRACK_IDS = [101, 102, 103, 104];
const GRID = Array.from({ length: 16 }, (_, i) => i);
const MELODY = [0, 0, 7, 0, 3, 3, 7, 10, 0, 0, 7, 12, 3, 5, 10, 12];

const VOICE_PRESETS = [
  { label: 'kick', baseNote: 36, params: { tone: 0.34, decay: 0.42, color: 0.22, drive: 0.28, gain: 1.1 } },
  { label: 'snare', baseNote: 38, params: { tone: 0.56, decay: 0.28, color: 0.72, drive: 0.18, gain: 0.86 } },
  { label: 'hat', baseNote: 42, params: { tone: 0.82, decay: 0.14, color: 0.88, drive: 0.14, gain: 0.72 } },
  { label: 'bass', baseNote: 36, params: { tone: 0.48, decay: 0.62, color: 0.34, drive: 0.32, gain: 0.86 } },
  { label: 'lead', baseNote: 60, params: { tone: 0.62, decay: 0.40, color: 0.58, drive: 0.42, gain: 0.76 } },
];

const DEFAULT_PATTERNS: StepLevel[][] = [
  [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1],
  [1, 0, 1, 0, 1, 2, 1, 0, 1, 0, 1, 0, 1, 2, 1, 0],
  [2, 0, 0, 1, 0, 1, 0, 0, 2, 0, 0, 1, 0, 1, 2, 0],
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function callNum(name: string, ...args: number[]): number {
  const fn = host[name];
  return typeof fn === 'function' ? Number(fn(...args) ?? 0) : 0;
}

function callVoid(name: string, ...args: number[]): void {
  const fn = host[name];
  if (typeof fn === 'function') fn(...args);
}

function noteName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const idx = ((note % 12) + 12) % 12;
  const octave = Math.floor(note / 12) - 1;
  return `${names[idx]}${octave}`;
}

function cycleStep(level: StepLevel): StepLevel {
  return (level === 0 ? 1 : level === 1 ? 2 : 0) as StepLevel;
}

function melodicNotes(voice: number, baseNote: number): number[] {
  if (voice >= 3) return MELODY.map((offset) => baseNote + offset);
  return GRID.map(() => baseNote);
}

function createTrack(moduleId: number, label: string, color: string, voice: number, steps: StepLevel[]): Track {
  const preset = VOICE_PRESETS[voice % VOICE_PRESETS.length];
  return {
    id: label.toLowerCase(),
    label,
    color,
    moduleId,
    voice,
    baseNote: preset.baseNote,
    steps: steps.slice() as StepLevel[],
    notes: melodicNotes(voice, preset.baseNote),
    params: { ...preset.params },
  };
}

function swapVoice(track: Track, voice: number): Track {
  const preset = VOICE_PRESETS[voice % VOICE_PRESETS.length];
  return {
    ...track,
    voice,
    baseNote: preset.baseNote,
    notes: melodicNotes(voice, preset.baseNote),
    params: { ...preset.params },
  };
}

function SmallButton({ label, onPress, accent, active }: { label: string; onPress: () => void; accent: string; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexGrow: 1,
        borderRadius: 8,
        backgroundColor: active ? accent : '#212121',
        borderWidth: 1,
        borderColor: active ? '#f7d98c' : '#4b4b4b',
        paddingTop: 7,
        paddingBottom: 7,
        alignItems: 'center',
      }}
    >
      <Text fontSize={8} color={active ? '#161616' : '#f5efe4'}>{label}</Text>
    </Pressable>
  );
}

function Dial({
  label,
  value,
  accent,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  accent: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <Box style={{ flexGrow: 1, gap: 5, alignItems: 'center' }}>
      <Text fontSize={8} color="#d7a742">{label}</Text>
      <Box style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: '#9f9f9f', borderWidth: 3, borderColor: '#333333', justifyContent: 'center', alignItems: 'center' }}>
        <Box style={{ width: 12, height: 28, borderRadius: 6, backgroundColor: accent, marginBottom: 4 }} />
        <Text fontSize={9} color="#111111">{value}</Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable onPress={onMinus} style={{ width: 28, height: 20, borderRadius: 10, backgroundColor: '#2e2e2e', alignItems: 'center', justifyContent: 'center' }}>
          <Text fontSize={10} color="#f6f1e6">-</Text>
        </Pressable>
        <Pressable onPress={onPlus} style={{ width: 28, height: 20, borderRadius: 10, backgroundColor: '#2e2e2e', alignItems: 'center', justifyContent: 'center' }}>
          <Text fontSize={10} color="#f6f1e6">+</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([
    createTrack(TRACK_IDS[0], 'A', '#f6a81a', 0, DEFAULT_PATTERNS[0]),
    createTrack(TRACK_IDS[1], 'B', '#ff744a', 1, DEFAULT_PATTERNS[1]),
    createTrack(TRACK_IDS[2], 'C', '#58e3dd', 2, DEFAULT_PATTERNS[2]),
    createTrack(TRACK_IDS[3], 'D', '#8f70ff', 3, DEFAULT_PATTERNS[3]),
  ]);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(124);
  const [swing, setSwing] = useState(0.12);
  const [delayTime, setDelayTime] = useState(0.18);
  const [delayFeedback, setDelayFeedback] = useState(0.32);
  const [delayMix, setDelayMix] = useState(0.24);
  const [masterGain, setMasterGain] = useState(0.68);
  const [audioReady, setAudioReady] = useState(0);
  const [peak, setPeak] = useState(0);
  const [callbackUs, setCallbackUs] = useState(0);

  const selectedTrack = tracks[selectedTrackIndex];
  const tracksRef = useRef(tracks);
  const bpmRef = useRef(bpm);
  const swingRef = useRef(swing);
  const audioReadyRef = useRef(audioReady);
  const stepRef = useRef(0);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { swingRef.current = swing; }, [swing]);
  useEffect(() => { audioReadyRef.current = audioReady; }, [audioReady]);

  useEffect(() => {
    const ok = callNum('__audio_init') > 0 || callNum('__audio_is_initialized') > 0;
    if (!ok) {
      setAudioReady(0);
      return;
    }

    callNum('__audio_add_module', MIXER_ID, MODULE.mixer);
    callNum('__audio_add_module', DELAY_ID, MODULE.delay);

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      callNum('__audio_add_module', track.moduleId, MODULE.pocket);
      callNum('__audio_connect', track.moduleId, 0, MIXER_ID, i);
      callNum('__audio_set_param', MIXER_ID, i, 1);
    }

    callNum('__audio_connect', MIXER_ID, 4, DELAY_ID, 0);
    callVoid('__audio_resume');
    setAudioReady(1);

    return () => {
      setIsPlaying(0);
      for (let i = 0; i < tracks.length; i++) {
        callNum('__audio_remove_module', tracks[i].moduleId);
      }
      callNum('__audio_remove_module', DELAY_ID);
      callNum('__audio_remove_module', MIXER_ID);
      callVoid('__audio_deinit');
    };
  }, []);

  useEffect(() => {
    if (!audioReady) return;

    callNum('__audio_set_master_gain', masterGain);
    callNum('__audio_set_param', DELAY_ID, DELAY_PARAM.time, delayTime);
    callNum('__audio_set_param', DELAY_ID, DELAY_PARAM.feedback, delayFeedback);
    callNum('__audio_set_param', DELAY_ID, DELAY_PARAM.mix, delayMix);

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      callNum('__audio_set_param', track.moduleId, PO_PARAM.voice, track.voice);
      callNum('__audio_set_param', track.moduleId, PO_PARAM.tone, track.params.tone);
      callNum('__audio_set_param', track.moduleId, PO_PARAM.decay, track.params.decay);
      callNum('__audio_set_param', track.moduleId, PO_PARAM.color, track.params.color);
      callNum('__audio_set_param', track.moduleId, PO_PARAM.drive, track.params.drive);
      callNum('__audio_set_param', track.moduleId, PO_PARAM.gain, track.params.gain);
      callNum('__audio_set_param', MIXER_ID, i, 1);
    }
  }, [audioReady, tracks, delayTime, delayFeedback, delayMix, masterGain]);

  useEffect(() => {
    let timer: any = null;
    timer = setInterval(() => {
      if (!audioReady) {
        setPeak(0);
        setCallbackUs(0);
        return;
      }
      setPeak(callNum('__audio_get_peak_level'));
      setCallbackUs(callNum('__audio_get_callback_us'));
    }, 80);
    return () => clearInterval(timer);
  }, [audioReady]);

  useEffect(() => {
    if (!isPlaying) return;

    let cancelled = false;
    let timer: any = null;

    const fire = (track: Track, step: number, level: StepLevel) => {
      if (!audioReadyRef.current) return;
      const accent = level === 2 ? 1.22 : 1.0;
      const accentTone = level === 2 ? 0.08 : 0;
      const accentDrive = level === 2 && track.voice >= 3 ? 0.08 : 0;
      callNum('__audio_set_param', track.moduleId, PO_PARAM.tone, clamp(track.params.tone + accentTone, 0, 1));
      callNum('__audio_set_param', track.moduleId, PO_PARAM.drive, clamp(track.params.drive + accentDrive, 0, 1));
      callNum('__audio_set_param', track.moduleId, PO_PARAM.gain, clamp(track.params.gain * accent, 0, 1.5));
      callNum('__audio_note_on', track.moduleId, track.notes[step] ?? track.baseNote);
    };

    const tick = () => {
      if (cancelled) return;

      const step = stepRef.current % 16;
      const liveTracks = tracksRef.current;
      setCurrentStep(step);

      for (let i = 0; i < liveTracks.length; i++) {
        const level = liveTracks[i].steps[step];
        if (level > 0) fire(liveTracks[i], step, level);
      }

      stepRef.current = (step + 1) % 16;

      const swingAmount = swingRef.current * 0.28;
      const scalar = step % 2 === 0 ? 1.0 - swingAmount : 1.0 + swingAmount;
      const wait = Math.max(35, (60000 / bpmRef.current / 4) * scalar);
      timer = setTimeout(tick, wait);
    };

    if (audioReadyRef.current) {
      callVoid('__audio_resume');
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isPlaying]);

  const updateSelectedTrack = (fn: (track: Track) => Track) => {
    setTracks((prev) => prev.map((track, index) => index === selectedTrackIndex ? fn(track) : track));
  };

  const adjustParam = (key: keyof TrackParams, delta: number) => {
    updateSelectedTrack((track) => {
      const next = { ...track.params };
      const current = next[key];
      const min = key === 'decay' ? 0.05 : 0;
      const max = key === 'gain' ? 1.5 : 1;
      next[key] = clamp(current + delta, min, max);
      return { ...track, params: next };
    });
  };

  const cycleSelectedVoice = () => {
    setTracks((prev) => prev.map((track, index) => {
      if (index !== selectedTrackIndex) return track;
      return swapVoice(track, (track.voice + 1) % VOICE_PRESETS.length);
    }));
  };

  const toggleStepAt = (step: number) => {
    updateSelectedTrack((track) => {
      const steps = track.steps.slice() as StepLevel[];
      steps[step] = cycleStep(steps[step]);
      return { ...track, steps };
    });
  };

  const randomizeSelectedTrack = () => {
    updateSelectedTrack((track) => {
      const probability = track.voice === 2 ? 0.72 : track.voice >= 3 ? 0.42 : 0.34;
      const steps = track.steps.map(() => {
        if (Math.random() > probability) return 0 as StepLevel;
        return (Math.random() > 0.78 ? 2 : 1) as StepLevel;
      }) as StepLevel[];
      const notes = track.voice >= 3
        ? melodicNotes(track.voice, track.baseNote).map((base) => base + [0, 0, 2, 3, 5, 7, 10][Math.floor(Math.random() * 7)])
        : track.notes.slice();
      return { ...track, steps, notes };
    });
  };

  const clearSelectedTrack = () => {
    updateSelectedTrack((track) => ({ ...track, steps: GRID.map(() => 0 as StepLevel) }));
  };

  const resetTransport = () => {
    stepRef.current = 0;
    setCurrentStep(0);
  };

  const meterSegments = GRID.slice(0, 10);
  const activeCount = selectedTrack.steps.reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0);
  const voiceLabel = VOICE_PRESETS[selectedTrack.voice].label;

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: '#ede7db' }}>
      <Box style={{ width: '100%', alignItems: 'center', paddingTop: 18, paddingBottom: 30 }}>
        <Box style={{ width: 320, alignItems: 'center', gap: 10 }}>
          <Box style={{ width: 218, height: 46, borderRadius: 24, backgroundColor: '#2f3134', justifyContent: 'center', alignItems: 'center' }}>
            <Text fontSize={10} color="#e5b04c">pocket operator</Text>
          </Box>

          <Box style={{ width: 320, backgroundColor: '#0e0f10', borderRadius: 18, padding: 12, gap: 10, borderWidth: 1, borderColor: '#292a2d' }}>
            <Box style={{ flexDirection: 'row', justifyContent: 'spaceBetween', alignItems: 'center' }}>
              <Box>
                <Text fontSize={20} color="#f2b03b">po</Text>
                <Text fontSize={9} color="#d0d0d0">office // digital operator</Text>
              </Box>
              <Box style={{ alignItems: 'flexEnd' }}>
                <Text fontSize={8} color="#7e8387">model</Text>
                <Text fontSize={11} color="#f2b03b">PO-∞</Text>
              </Box>
            </Box>

            <Box style={{ backgroundColor: '#c7c3b4', borderRadius: 6, borderWidth: 2, borderColor: '#5d5b52', padding: 8, gap: 6 }}>
              <Box style={{ flexDirection: 'row', justifyContent: 'spaceBetween', alignItems: 'center' }}>
                <Text fontSize={8} color="#222222">{isPlaying ? 'PLAY' : 'READY'}</Text>
                <Text fontSize={8} color="#222222">{voiceLabel.toUpperCase()}</Text>
                <Text fontSize={8} color="#222222">{`STEP ${currentStep + 1}`}</Text>
              </Box>

              <Box style={{ flexDirection: 'row', gap: 3 }}>
                {GRID.map((step) => {
                  const level = selectedTrack.steps[step];
                  const isLit = level > 0;
                  const live = isPlaying && step === currentStep;
                  return (
                    <Box
                      key={step}
                      style={{
                        width: 14,
                        height: 22,
                        borderRadius: 3,
                        backgroundColor: live ? '#111111' : isLit ? selectedTrack.color : '#8c8a7f',
                        borderWidth: 1,
                        borderColor: level === 2 ? '#f2b03b' : '#5d5b52',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text fontSize={7} color={live ? '#f0dd9a' : isLit ? '#171717' : '#2f2f2f'}>{String((step + 1) % 10)}</Text>
                    </Box>
                  );
                })}
              </Box>

              <Box style={{ flexDirection: 'row', justifyContent: 'spaceBetween', alignItems: 'center' }}>
                <Text fontSize={9} color="#222222">{`bpm ${bpm}`}</Text>
                <Text fontSize={9} color="#222222">{`swing ${Math.round(swing * 100)}%`}</Text>
                <Text fontSize={9} color="#222222">{`cpu ${Math.round(callbackUs)}us`}</Text>
              </Box>

              <Box style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                <Text fontSize={8} color="#222222">peak</Text>
                {meterSegments.map((segment) => (
                  <Box
                    key={segment}
                    style={{
                      width: 17,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: peak > (segment + 1) / 10 ? selectedTrack.color : '#898679',
                    }}
                  />
                ))}
              </Box>
            </Box>

            <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'flexStart' }}>
              <Dial
                label="tone"
                value={selectedTrack.params.tone.toFixed(2)}
                accent={selectedTrack.color}
                onMinus={() => adjustParam('tone', -0.05)}
                onPlus={() => adjustParam('tone', 0.05)}
              />
              <Dial
                label="decay"
                value={selectedTrack.params.decay.toFixed(2)}
                accent={selectedTrack.color}
                onMinus={() => adjustParam('decay', -0.05)}
                onPlus={() => adjustParam('decay', 0.05)}
              />
              <Box style={{ flexGrow: 1, gap: 6 }}>
                <SmallButton label={`voice ${voiceLabel}`} onPress={cycleSelectedVoice} accent={selectedTrack.color} />
                <SmallButton label={`bpm ${bpm}`} onPress={() => setBpm((v) => v >= 320 ? 72 : clamp(v + 4, 72, 320))} accent="#f2b03b" />
                <SmallButton label={`delay ${delayMix.toFixed(2)}`} onPress={() => setDelayMix((v) => clamp(v + 0.04, 0, 0.7))} accent="#f2b03b" />
                <SmallButton label={`swing ${Math.round(swing * 100)}%`} onPress={() => setSwing((v) => v >= 0.32 ? 0 : clamp(v + 0.04, 0, 0.32))} accent="#f2b03b" />
              </Box>
            </Box>

            <Box style={{ flexDirection: 'row', gap: 6 }}>
              {tracks.map((track, index) => (
                <Pressable
                  key={track.id}
                  onPress={() => setSelectedTrackIndex(index)}
                  style={{
                    flexGrow: 1,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: index === selectedTrackIndex ? '#f2b03b' : '#363636',
                    backgroundColor: index === selectedTrackIndex ? track.color : '#1a1a1a',
                    paddingTop: 7,
                    paddingBottom: 7,
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Text fontSize={8} color={index === selectedTrackIndex ? '#171717' : '#b0b0b0'}>{`track ${track.label}`}</Text>
                  <Text fontSize={10} color={index === selectedTrackIndex ? '#171717' : '#f4efe3'}>{VOICE_PRESETS[track.voice].label}</Text>
                </Pressable>
              ))}
            </Box>

            <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GRID.map((step) => {
                const level = selectedTrack.steps[step];
                const live = isPlaying && step === currentStep;
                const melodic = selectedTrack.voice >= 3;
                return (
                  <Pressable
                    key={step}
                    onPress={() => toggleStepAt(step)}
                    style={{
                      width: 68,
                      height: 58,
                      borderRadius: 10,
                      backgroundColor: level === 0 ? '#969696' : selectedTrack.color,
                      borderWidth: live ? 3 : 1,
                      borderColor: live ? '#f2b03b' : '#2d2d2d',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Text fontSize={14} color={level === 0 ? '#292929' : '#171717'}>{String(step + 1)}</Text>
                    <Text fontSize={7} color={level === 0 ? '#292929' : '#171717'}>
                      {level === 2 ? 'accent' : level === 1 ? 'hit' : melodic ? noteName(selectedTrack.notes[step]) : 'rest'}
                    </Text>
                  </Pressable>
                );
              })}
            </Box>

            <Box style={{ flexDirection: 'row', gap: 6 }}>
              <SmallButton label={isPlaying ? 'stop' : 'play'} onPress={() => setIsPlaying((v) => v === 1 ? 0 : 1)} accent="#f2b03b" active={isPlaying === 1} />
              <SmallButton label="reset" onPress={resetTransport} accent="#f2b03b" />
              <SmallButton label="random" onPress={randomizeSelectedTrack} accent={selectedTrack.color} />
              <SmallButton label="clear" onPress={clearSelectedTrack} accent="#ff744a" />
            </Box>

            <Box style={{ gap: 4, paddingTop: 2 }}>
              <Text fontSize={8} color="#8a8a8a">{`track ${selectedTrack.label} · ${voiceLabel} · active ${activeCount}/16`}</Text>
              <Text fontSize={8} color="#8a8a8a">{`drive ${selectedTrack.params.drive.toFixed(2)} · color ${selectedTrack.params.color.toFixed(2)} · master ${masterGain.toFixed(2)} · audio ${audioReady ? 'online' : 'offline'}`}</Text>
            </Box>

            <Box style={{ flexDirection: 'row', gap: 6 }}>
              <SmallButton label="drive +" onPress={() => adjustParam('drive', 0.05)} accent={selectedTrack.color} />
              <SmallButton label="drive -" onPress={() => adjustParam('drive', -0.05)} accent={selectedTrack.color} />
              <SmallButton label="color +" onPress={() => adjustParam('color', 0.05)} accent={selectedTrack.color} />
              <SmallButton label="level +" onPress={() => setMasterGain((v) => clamp(v + 0.04, 0.2, 1.0))} accent="#f2b03b" />
            </Box>
          </Box>

          <Box style={{ width: 320, alignItems: 'center', gap: 4, paddingTop: 2 }}>
            <Text fontSize={24} color="#0f1720">PO-∞</Text>
            <Text fontSize={12} color="#0f1720">pocket operator / host-driven synth sequencer</Text>
            <Text fontSize={10} color="#5b6470">tsx shell, zig voice engine, step accents, live delay bus</Text>
          </Box>
        </Box>
      </Box>
    </ScrollView>
  );
}
