const React: any = require('react');
const { useState, useEffect, useCallback } = React;

import { Box, Col, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useAudioCapture } from '../../lib/audio-capture/hooks/useAudioCapture';
import { useFFT } from '../../lib/audio-capture/hooks/useFFT';
import { useBeatDetect } from '../../lib/audio-capture/hooks/useBeatDetect';
import { Waveform } from './Waveform';
import { Spectrum } from './Spectrum';
import { BeatIndicator } from './BeatIndicator';
import { AudioDeviceList } from './AudioDeviceList';
import { RecordButton } from './RecordButton';

const FFT_SIZE = 512;
const SAMPLE_COUNT = 512;

export function AudioCapturePanel() {
  const { available, recording, start, stop, getSamples } = useAudioCapture(2048);
  const { compute: computeFFT } = useFFT(FFT_SIZE);
  const { detect: detectBeat } = useBeatDetect(43, 1.3);

  const [windowType, setWindowType] = useState<'hann' | 'hamming' | 'rectangular'>('hann');
  const [gain, setGain] = useState(1);
  const [spectrum, setSpectrum] = useState<Float32Array | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [beatInfo, setBeatInfo] = useState({ beat: false, bpm: 0, energy: 0 });

  // Analysis loop at ~30fps
  useEffect(() => {
    let raf: any;
    let lastTime = 0;
    const interval = 1000 / 30;

    const tick = (now: number) => {
      if (now - lastTime >= interval) {
        lastTime = now;
        if (available && recording) {
          const samps = getSamples(SAMPLE_COUNT);
          setSamples(new Float32Array(samps));
          const spec = computeFFT(samps, windowType, gain);
          setSpectrum(new Float32Array(spec));
          const beat = detectBeat(spec);
          setBeatInfo(beat);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [available, recording, getSamples, computeFFT, detectBeat, windowType, gain]);

  const saveRecording = useCallback(() => {
    if (!samples) return;
    const exec = (globalThis as any).__exec;
    if (typeof exec !== 'function') return;
    // Save as raw float32 array — user picks path via input
    // For now, save to /tmp/capture.raw
    const bytes: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      const v = Math.max(-1, Math.min(1, samples[i]));
      const int16 = Math.floor(v * 32767);
      bytes.push(int16 & 0xFF, (int16 >> 8) & 0xFF);
    }
    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    exec(`echo '${hex}' | xxd -r -p > /tmp/capture.raw`);
  }, [samples]);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg, padding: 12, gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text fontSize={14} color={COLORS.text} style={{ fontWeight: 'bold' }}>Audio Capture</Text>
        <RecordButton recording={recording} available={available} onStart={start} onStop={stop} onSave={saveRecording} />
      </Row>

      <AudioDeviceList available={available} />

      {available && (
        <>
          <BeatIndicator beat={beatInfo.beat} bpm={beatInfo.bpm} energy={beatInfo.energy} />

          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            {(['hann', 'hamming', 'rectangular'] as const).map((w) => (
              <Box key={w} style={{ padding: 6, borderRadius: TOKENS.radiusSm, backgroundColor: windowType === w ? COLORS.blueDeep : COLORS.panelAlt, borderWidth: 1, borderColor: windowType === w ? COLORS.blue : COLORS.border }}>
                <Text fontSize={9} color={windowType === w ? COLORS.blue : COLORS.textDim} onPress={() => setWindowType(w)}>{w}</Text>
              </Box>
            ))}
            <Box style={{ padding: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
              <Text fontSize={9} color={COLORS.textDim}>Gain: {gain.toFixed(1)}x</Text>
            </Box>
            <Box style={{ padding: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={9} color={COLORS.blue} onPress={() => setGain((g) => Math.min(4, g + 0.5))}>+</Text>
            </Box>
            <Box style={{ padding: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={9} color={COLORS.blue} onPress={() => setGain((g) => Math.max(0.5, g - 0.5))}>-</Text>
            </Box>
          </Row>

          <ScrollView style={{ flexGrow: 1, gap: 10 }}>
            <Col style={{ gap: 10 }}>
              <Text fontSize={10} color={COLORS.textMuted}>Waveform</Text>
              <Waveform samples={samples} />
              <Text fontSize={10} color={COLORS.textMuted}>Spectrum ({FFT_SIZE / 2} bins, log scale)</Text>
              <Spectrum spectrum={spectrum} barCount={64} logScale={true} />
            </Col>
          </ScrollView>
        </>
      )}
    </Col>
  );
}
