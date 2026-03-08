import { useLoveRPC } from '@reactjit/core';

export type SpectrumType = 'ir' | 'uv-vis' | 'mass-spec' | 'nmr' | 'raman';

export interface SpectralPeak {
  position: number;
  intensity: number;
  label?: string;
  assignment?: string;
}

export interface Spectrum {
  type: SpectrumType;
  compound: string;
  peaks: SpectralPeak[];
  xLabel: string;
  yLabel: string;
  xRange: [number, number];
  yRange: [number, number];
}

export interface IRAbsorption {
  group: string;
  bond: string;
  rangeMin: number;
  rangeMax: number;
  intensity: 'strong' | 'medium' | 'weak' | 'variable';
  description: string;
}

/** All spectra compute runs in Lua via chemistry:* RPCs. */
export const useIdentifyIR = () => useLoveRPC<IRAbsorption[]>('chemistry:identifyIR');
export const useWavelengthToColor = () => useLoveRPC<string>('chemistry:wavelengthToColor');
export const useAbsorptionColor = () => useLoveRPC<string>('chemistry:absorptionColor');
export const useIRAbsorptions = () => useLoveRPC<IRAbsorption[]>('chemistry:irAbsorptions');
