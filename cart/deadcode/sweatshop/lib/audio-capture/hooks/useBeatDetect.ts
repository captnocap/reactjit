import { useRef, useCallback } from 'react';
export function useBeatDetect(historySize: number = 43, threshold: number = 1.3) {
  const energyHistory = useRef<Float32Array>(new Float32Array(historySize));
  const historyIndex = useRef(0);
  const historyFilled = useRef(false);

  const detect = useCallback((spectrum: Float32Array): { beat: boolean; energy: number; bpm: number } => {
    // Compute current energy (sum of squared magnitudes)
    let energy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      energy += spectrum[i] * spectrum[i];
    }

    const idx = historyIndex.current;
    energyHistory.current[idx] = energy;
    historyIndex.current = (idx + 1) % historySize;
    if (historyIndex.current === 0) historyFilled.current = true;

    const count = historyFilled.current ? historySize : idx;
    if (count < 10) {
      return { beat: false, energy, bpm: 0 };
    }

    // Compute local average energy
    let avg = 0;
    for (let i = 0; i < count; i++) {
      avg += energyHistory.current[i];
    }
    avg /= count;

    // Compute variance
    let variance = 0;
    for (let i = 0; i < count; i++) {
      const diff = energyHistory.current[i] - avg;
      variance += diff * diff;
    }
    variance /= count;

    // Dynamic threshold: higher variance → higher threshold
    const dynamicThreshold = threshold * (-0.0025714 * variance + 1.5142857);
    const beat = energy > avg * Math.max(1.0, dynamicThreshold);

    // Rough BPM estimation from energy peaks
    let peakCount = 0;
    for (let i = 2; i < count - 2; i++) {
      const e = energyHistory.current[i];
      if (e > energyHistory.current[i - 1] && e > energyHistory.current[i - 2] &&
          e > energyHistory.current[i + 1] && e > energyHistory.current[i + 2] &&
          e > avg * 1.5) {
        peakCount++;
      }
    }
    // Assume ~30fps analysis, so peaks per second * 60 = BPM
    const bpm = historyFilled.current ? Math.round((peakCount / (historySize / 30)) * 60) : 0;

    return { beat, energy, bpm };
  }, [historySize, threshold]);

  return { detect };
}
