const React: any = require('react');
const { useMemo, useCallback } = React;

export type WindowType = 'hann' | 'hamming' | 'rectangular';

function makeWindow(size: number, type: WindowType): Float32Array {
  const w = new Float32Array(size);
  if (type === 'rectangular') {
    w.fill(1);
    return w;
  }
  for (let i = 0; i < size; i++) {
    if (type === 'hann') {
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    } else if (type === 'hamming') {
      w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
    }
  }
  return w;
}

function bitReverse(n: number, bits: number): number {
  let reversed = 0;
  for (let i = 0; i < bits; i++) {
    reversed = (reversed << 1) | (n & 1);
    n >>= 1;
  }
  return reversed;
}

function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n !== imag.length) throw new Error('Real and imag arrays must match');
  const bits = Math.log2(n);
  if (bits !== Math.floor(bits)) throw new Error('Length must be power of 2');

  // Bit-reversal permutation
  for (let i = 0; i < n; i++) {
    const j = bitReverse(i, bits);
    if (j > i) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  // Butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wLenReal = Math.cos(angle);
    const wLenImag = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wReal = 1;
      let wImag = 0;
      for (let j = 0; j < len / 2; j++) {
        const uReal = real[i + j];
        const uImag = imag[i + j];
        const vReal = real[i + j + len / 2] * wReal - imag[i + j + len / 2] * wImag;
        const vImag = real[i + j + len / 2] * wImag + imag[i + j + len / 2] * wReal;
        real[i + j] = uReal + vReal;
        imag[i + j] = uImag + vImag;
        real[i + j + len / 2] = uReal - vReal;
        imag[i + j + len / 2] = uImag - vImag;
        const nextWReal = wReal * wLenReal - wImag * wLenImag;
        wImag = wReal * wLenImag + wImag * wLenReal;
        wReal = nextWReal;
      }
    }
  }
}

export function useFFT(size: number = 512) {
  const real = useMemo(() => new Float32Array(size), [size]);
  const imag = useMemo(() => new Float32Array(size), [size]);
  const spectrum = useMemo(() => new Float32Array(size / 2), [size]);

  const compute = useCallback((samples: Float32Array, windowType: WindowType = 'hann', gain: number = 1): Float32Array => {
    if (samples.length < size) {
      spectrum.fill(0);
      return spectrum;
    }

    const window = makeWindow(size, windowType);
    for (let i = 0; i < size; i++) {
      real[i] = samples[i] * window[i] * gain;
      imag[i] = 0;
    }

    fft(real, imag);

    // Magnitude (only first half for real input)
    for (let i = 0; i < size / 2; i++) {
      const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      spectrum[i] = mag / (size / 2);
    }

    return spectrum;
  }, [size, real, imag, spectrum]);

  return { compute, size };
}
