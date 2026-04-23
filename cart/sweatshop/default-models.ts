// =============================================================================
// DEFAULT MODELS SETTINGS — ported from SPEC_DEFAULT_MODELS.md
// =============================================================================

import type { ProviderType } from './providers';

export interface ModelReference {
  provider: ProviderType;
  modelId: string;
}

export type RunnerMode = 'uniform' | 'individual';

export interface RunnerConfig {
  count: number;
  mode: RunnerMode;
  uniformModel?: ModelReference;
  individualModels?: ModelReference[];
}

export interface ResearchModelsConfig {
  orchestrator: ModelReference;
  runners: RunnerConfig;
  reader: ModelReference;
}

export interface VisionProxyConfig {
  enabled: boolean;
  provider: ProviderType;
  modelId: string;
}

export interface ImageGenModelConfig {
  modelId: string;
}

export interface DefaultModelsSettings {
  textModel: ModelReference;
  visionProxy: VisionProxyConfig;
  shadowModel: ModelReference;
  research: ResearchModelsConfig;
  imageGen: ImageGenModelConfig;
}

// ── System defaults ──────────────────────────────────────────────────────────

export const DEFAULT_MODELS: DefaultModelsSettings = {
  textModel: { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
  visionProxy: { enabled: true, provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
  shadowModel: { provider: 'anthropic', modelId: 'claude-haiku-4-5' },
  research: {
    orchestrator: { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
    runners: {
      count: 3,
      mode: 'uniform',
      uniformModel: { provider: 'anthropic', modelId: 'claude-haiku-4-5' },
      individualModels: [],
    },
    reader: { provider: 'anthropic', modelId: 'claude-sonnet-4-6' },
  },
  imageGen: { modelId: 'seedream-v4' },
};

// ── Persistence ──────────────────────────────────────────────────────────────

const STORE_KEY = 'sweatshop:defaultModels';
const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : () => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : () => {};

export function loadDefaultModels(): DefaultModelsSettings {
  const json = storeGet(STORE_KEY);
  if (!json) return DEFAULT_MODELS;
  try {
    const parsed = JSON.parse(json);
    return mergeDefaults(parsed);
  } catch {
    return DEFAULT_MODELS;
  }
}

export function saveDefaultModels(settings: DefaultModelsSettings): void {
  storeSet(STORE_KEY, JSON.stringify(settings));
}

function mergeDefaults(partial: Partial<DefaultModelsSettings>): DefaultModelsSettings {
  return {
    textModel: partial.textModel ?? DEFAULT_MODELS.textModel,
    visionProxy: partial.visionProxy ?? DEFAULT_MODELS.visionProxy,
    shadowModel: partial.shadowModel ?? DEFAULT_MODELS.shadowModel,
    research: {
      orchestrator: partial.research?.orchestrator ?? DEFAULT_MODELS.research.orchestrator,
      runners: {
        count: partial.research?.runners?.count ?? DEFAULT_MODELS.research.runners.count,
        mode: partial.research?.runners?.mode ?? DEFAULT_MODELS.research.runners.mode,
        uniformModel: partial.research?.runners?.uniformModel ?? DEFAULT_MODELS.research.runners.uniformModel,
        individualModels: partial.research?.runners?.individualModels ?? DEFAULT_MODELS.research.runners.individualModels,
      },
      reader: partial.research?.reader ?? DEFAULT_MODELS.research.reader,
    },
    imageGen: partial.imageGen ?? DEFAULT_MODELS.imageGen,
  };
}

// ── Update helpers ───────────────────────────────────────────────────────────

export function updateTextModel(settings: DefaultModelsSettings, model: ModelReference): DefaultModelsSettings {
  return { ...settings, textModel: model };
}

export function updateVisionProxy(settings: DefaultModelsSettings, config: Partial<VisionProxyConfig>): DefaultModelsSettings {
  return { ...settings, visionProxy: { ...settings.visionProxy, ...config } };
}

export function updateShadowModel(settings: DefaultModelsSettings, model: ModelReference): DefaultModelsSettings {
  return { ...settings, shadowModel: model };
}

export function updateResearchOrchestrator(settings: DefaultModelsSettings, model: ModelReference): DefaultModelsSettings {
  return { ...settings, research: { ...settings.research, orchestrator: model } };
}

export function updateResearchReader(settings: DefaultModelsSettings, model: ModelReference): DefaultModelsSettings {
  return { ...settings, research: { ...settings.research, reader: model } };
}

export function updateRunnerConfig(settings: DefaultModelsSettings, config: Partial<RunnerConfig>): DefaultModelsSettings {
  return {
    ...settings,
    research: {
      ...settings.research,
      runners: { ...settings.research.runners, ...config },
    },
  };
}

export function updateImageGenModel(settings: DefaultModelsSettings, modelId: string): DefaultModelsSettings {
  return { ...settings, imageGen: { modelId } };
}
