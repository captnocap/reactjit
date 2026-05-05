// Shared image-generation types. Backend-agnostic: every backend normalizes
// into GenRequest + GenResult so the UI never branches on provider.

export type SamplerId =
  | 'euler' | 'euler_a' | 'dpm++_2m' | 'dpm++_2m_karras'
  | 'ddim' | 'unipc' | 'lms' | 'heun';

export type BackendId = 'nano' | 'gradio' | 'a1111';

export interface GenRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;           // multiple of 8
  height: number;
  steps: number;
  cfgScale: number;        // classifier-free guidance
  sampler: SamplerId;
  seed: number;            // -1 = random
  batchSize?: number;      // number of images per request (1 default)
}

export interface GenResult {
  id: string;
  backend: BackendId;
  images: string[];        // data:image/png;base64,... OR file:// path
  request: GenRequest;
  info?: string;           // backend-reported info (actual seed used, timings)
  durationMs: number;
  createdAt: number;
}

export interface GenProgress {
  step: number;
  totalSteps: number;
  etaSec?: number;
  previewUrl?: string;     // data:image/jpeg; some backends stream intermediate previews
}

export type GenEvent =
  | { kind: 'progress'; progress: GenProgress }
  | { kind: 'partial'; images: string[] }
  | { kind: 'done'; result: GenResult }
  | { kind: 'error'; message: string };

export interface BackendProbe {
  id: BackendId;
  available: boolean;
  detail: string;          // version, endpoint, or reason why not available
  installHint?: string;    // shown in UI banner
}

export interface Backend {
  id: BackendId;
  label: string;
  probe(): Promise<BackendProbe>;
  generate(req: GenRequest, onEvent: (ev: GenEvent) => void, signal: { cancelled: boolean }): Promise<GenResult>;
}

export const DEFAULT_REQUEST: GenRequest = {
  prompt: '',
  negativePrompt: '',
  width: 512,
  height: 512,
  steps: 25,
  cfgScale: 7,
  sampler: 'euler_a',
  seed: -1,
  batchSize: 1,
};

export const SAMPLERS: { id: SamplerId; label: string }[] = [
  { id: 'euler',            label: 'Euler' },
  { id: 'euler_a',          label: 'Euler a' },
  { id: 'dpm++_2m',         label: 'DPM++ 2M' },
  { id: 'dpm++_2m_karras',  label: 'DPM++ 2M Karras' },
  { id: 'ddim',             label: 'DDIM' },
  { id: 'unipc',            label: 'UniPC' },
  { id: 'lms',              label: 'LMS' },
  { id: 'heun',             label: 'Heun' },
];
