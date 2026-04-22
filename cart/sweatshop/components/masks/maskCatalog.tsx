import { COLORS } from '../../theme';
import { Blur } from './Blur';
import { ChromaticAberration } from './ChromaticAberration';
import { Distortion } from './Distortion';
import { DuotoneMap } from './DuotoneMap';
import { FilmGrain } from './FilmGrain';
import { Glitch } from './Glitch';
import { Glow } from './Glow';
import { Halftone } from './Halftone';
import { Dither } from './Dither';
import { Kaleidoscope } from './Kaleidoscope';
import { PaperBurn } from './PaperBurn';
import { Pixelate } from './Pixelate';
import { RGBShift } from './RGBShift';
import { Scanlines } from './Scanlines';
import { Vignette } from './Vignette';
import type { MaskKind } from './maskEffects';

export type PropKind = 'bool' | 'num' | 'enum';

export type PropDef = {
  name: string;
  kind: PropKind;
  defaultVal: any;
  step?: number;
  min?: number;
  max?: number;
  options?: string[];
};

export type MaskDef = {
  id: MaskKind;
  label: string;
  Component: any;
  desc: string;
  props: PropDef[];
};

export type MaskStackItem = {
  id: string;
  maskId: MaskKind;
  enabled: boolean;
  params: Record<string, any>;
};

const MASK_DEFS: MaskDef[] = [
  { id: 'blur', label: 'Blur', Component: Blur, desc: 'Soft blur with box, radial, or gaussian variance.', props: [{ name: 'radius', kind: 'num', defaultVal: 6, step: 1, min: 1, max: 28 }, { name: 'mode', kind: 'enum', defaultVal: 'gaussian', options: ['gaussian', 'box', 'radial'] }, { name: 'intensity', kind: 'num', defaultVal: 0.6, step: 0.05, min: 0, max: 1 }] },
  { id: 'glow', label: 'Glow', Component: Glow, desc: 'Colored bloom around the live source.', props: [{ name: 'radius', kind: 'num', defaultVal: 12, step: 1, min: 2, max: 40 }, { name: 'intensity', kind: 'num', defaultVal: 0.7, step: 0.05, min: 0, max: 1 }, { name: 'color', kind: 'enum', defaultVal: COLORS.blue, options: [COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange, COLORS.red] }] },
  { id: 'distortion', label: 'Distortion', Component: Distortion, desc: 'Band shift and strip warping driven by noise.', props: [{ name: 'amount', kind: 'num', defaultVal: 8, step: 1, min: 0, max: 24 }, { name: 'bands', kind: 'num', defaultVal: 10, step: 1, min: 4, max: 24 }, { name: 'vertical', kind: 'bool', defaultVal: false }] },
  { id: 'chromatic-aberration', label: 'Chromatic Aberration', Component: ChromaticAberration, desc: 'RGB channel offset on the live frame.', props: [{ name: 'offset', kind: 'num', defaultVal: 3, step: 1, min: 0, max: 18 }, { name: 'intensity', kind: 'num', defaultVal: 0.75, step: 0.05, min: 0, max: 1 }] },
  { id: 'kaleidoscope', label: 'Kaleidoscope', Component: Kaleidoscope, desc: 'N-fold mirrored symmetry.', props: [{ name: 'folds', kind: 'num', defaultVal: 6, step: 1, min: 3, max: 16 }, { name: 'rotation', kind: 'num', defaultVal: 0, step: 5, min: -180, max: 180 }, { name: 'zoom', kind: 'num', defaultVal: 1, step: 0.05, min: 0.8, max: 1.4 }] },
  { id: 'glitch', label: 'Glitch', Component: Glitch, desc: 'Random band shift and color corruption.', props: [{ name: 'bands', kind: 'num', defaultVal: 10, step: 1, min: 4, max: 24 }, { name: 'shift', kind: 'num', defaultVal: 8, step: 1, min: 0, max: 26 }, { name: 'corruption', kind: 'num', defaultVal: 0.5, step: 0.05, min: 0, max: 1 }, { name: 'colorCorruption', kind: 'num', defaultVal: 0.4, step: 0.05, min: 0, max: 1 }] },
  { id: 'paper-burn', label: 'Paper Burn', Component: PaperBurn, desc: 'Edge burn alpha on the live source.', props: [{ name: 'edge', kind: 'num', defaultVal: 16, step: 1, min: 2, max: 48 }, { name: 'intensity', kind: 'num', defaultVal: 0.7, step: 0.05, min: 0, max: 1 }, { name: 'tone', kind: 'enum', defaultVal: '#9f5b2d', options: ['#9f5b2d', '#7c3d18', '#d97706', '#f59e0b'] }] },
  { id: 'film-grain', label: 'Film Grain', Component: FilmGrain, desc: 'Animated grain overlay.', props: [{ name: 'grain', kind: 'num', defaultVal: 0.25, step: 0.05, min: 0, max: 1 }] },
  { id: 'pixelate', label: 'Pixelate', Component: Pixelate, desc: 'Block-quantized media surface.', props: [{ name: 'size', kind: 'num', defaultVal: 8, step: 1, min: 2, max: 24 }, { name: 'strength', kind: 'num', defaultVal: 0.8, step: 0.05, min: 0, max: 1 }] },
  { id: 'scanlines', label: 'Scanlines', Component: Scanlines, desc: 'Horizontal line overlay.', props: [{ name: 'spacing', kind: 'num', defaultVal: 3, step: 1, min: 1, max: 10 }, { name: 'tint', kind: 'enum', defaultVal: COLORS.textBright, options: [COLORS.textBright, COLORS.blue, COLORS.green, COLORS.purple] }] },
  { id: 'vignette', label: 'Vignette', Component: Vignette, desc: 'Radial edge darkening.', props: [{ name: 'strength', kind: 'num', defaultVal: 0.55, step: 0.05, min: 0, max: 1 }, { name: 'color', kind: 'enum', defaultVal: '#000', options: ['#000', '#1b120f', '#0b1018'] }] },
  { id: 'rgb-shift', label: 'RGB Shift', Component: RGBShift, desc: 'Hard split of red, green, and blue layers.', props: [{ name: 'offset', kind: 'num', defaultVal: 4, step: 1, min: 0, max: 18 }, { name: 'spread', kind: 'num', defaultVal: 1, step: 0.5, min: 0, max: 8 }] },
  { id: 'duotone-map', label: 'Duotone Map', Component: DuotoneMap, desc: 'Two-color tone remapping.', props: [{ name: 'lightColor', kind: 'enum', defaultVal: COLORS.blue, options: [COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange, COLORS.yellow] }, { name: 'darkColor', kind: 'enum', defaultVal: COLORS.panelBg, options: [COLORS.panelBg, COLORS.panelAlt, COLORS.grayDeep, '#10151d'] }, { name: 'mix', kind: 'num', defaultVal: 0.55, step: 0.05, min: 0, max: 1 }] },
  { id: 'halftone', label: 'Halftone', Component: Halftone, desc: 'Dot-pattern stylization over the live source.', props: [{ name: 'cellSize', kind: 'num', defaultVal: 10, step: 1, min: 4, max: 24 }, { name: 'dotSize', kind: 'num', defaultVal: 4, step: 1, min: 1, max: 10 }, { name: 'tint', kind: 'enum', defaultVal: COLORS.textBright, options: [COLORS.textBright, COLORS.blue, COLORS.green, COLORS.orange, COLORS.purple] }] },
  { id: 'dither', label: 'Dither', Component: Dither, desc: 'Ordered Bayer-matrix dithering for retro pixel-art aesthetic.', props: [{ name: 'levels', kind: 'num', defaultVal: 4, step: 1, min: 2, max: 8 }, { name: 'scale', kind: 'num', defaultVal: 2, step: 1, min: 1, max: 6 }] },
];

let maskSeq = 0;

export const MASKS = MASK_DEFS;

export function getMaskDef(maskId: MaskKind): MaskDef {
  return MASK_DEFS.find((item) => item.id === maskId) || MASK_DEFS[0];
}

export function getMaskDefaults(maskId: MaskKind): Record<string, any> {
  const def = getMaskDef(maskId);
  const next: Record<string, any> = {};
  for (const prop of def.props) next[prop.name] = prop.defaultVal;
  return next;
}

export function createMaskStackItem(maskId: MaskKind): MaskStackItem {
  return {
    id: maskId + '_' + String(++maskSeq) + '_' + Date.now().toString(36),
    maskId,
    enabled: true,
    params: getMaskDefaults(maskId),
  };
}
