/**
 * Gradio config types — mirrors the JSON returned by GET /config on a Gradio server.
 *
 * Updated for Gradio v6 protocol:
 * - api_prefix defaults to /gradio_api
 * - targets are [componentId, eventName] tuples
 * - predict uses event_id + SSE streaming
 * - file results include { url, path, orig_name } objects
 */

// ── Component config ────────────────────────────────────

export interface GradioComponentConfig {
  id: number;
  type: string;
  props: Record<string, any>;
  api_info?: {
    type: string;
  };
  api_info_as_input?: { type: string };
  api_info_as_output?: { type: string };
  example_inputs?: any;
  skip_api?: boolean;
  key?: string | null;
  component_class_id?: string;
}

// ── Layout tree ─────────────────────────────────────────

export interface GradioLayoutNode {
  id: number;
  children?: GradioLayoutNode[];
}

// ── Dependency (event wiring) — v6 format ───────────────

export interface GradioDependency {
  /** v6: array of [componentId, eventName] tuples */
  targets: Array<[number, string]>;
  /** v5 compat: sometimes present as separate field */
  trigger?: string;
  inputs: number[];
  outputs: number[];
  api_name: string | null;
  backend_fn?: boolean;
  queue?: boolean | null;
  js?: string;
  scroll_to_output?: boolean;
  show_progress?: 'full' | 'minimal' | 'hidden';
  cancels?: number[];
  every?: number;
  batch?: boolean;
  max_batch_size?: number;
}

// ── Full config response ────────────────────────────────

export interface GradioConfig {
  mode: 'blocks' | 'interface';
  dev_mode: boolean;
  analytics_enabled: boolean;
  components: GradioComponentConfig[];
  css?: string;
  title?: string;
  description?: string;
  theme?: string;
  layout: GradioLayoutNode;
  dependencies: GradioDependency[];
  /** Base URL — set by client after fetch */
  root?: string;
  version?: string;
  /** v6: API prefix, defaults to /gradio_api */
  api_prefix?: string;
  app_id?: number;
}

// ── Runtime state ───────────────────────────────────────

export interface GradioComponentState {
  id: number;
  type: string;
  value: any;
  props: Record<string, any>;
  loading: boolean;
  error: string | null;
}

// ── File data (v6 image/audio/file results) ─────────────

export interface GradioFileData {
  path: string;
  url: string;
  size: number | null;
  orig_name: string;
  mime_type: string | null;
  is_stream: boolean;
  meta?: { _type: string };
}

// ── Predict request/response ────────────────────────────

export interface GradioPredictRequest {
  data: any[];
  fn_index?: number;
  session_hash?: string;
}

export interface GradioPredictResponse {
  data: any[];
  duration?: number;
  average_duration?: number;
  is_generating?: boolean;
}

// ── Event-based protocol (v6) ───────────────────────────

export interface GradioCallResponse {
  event_id: string;
}

export type GradioSSEEvent =
  | { event: 'complete'; data: any[] }
  | { event: 'generating'; data: any[] }
  | { event: 'error'; data: string }
  | { event: 'heartbeat' };

// ── GradioApp props ─────────────────────────────────────

export interface GradioAppProps {
  /** URL of the running Gradio server (e.g. "http://localhost:7860") */
  url: string;
  /** Optional API key for authenticated endpoints */
  apiKey?: string;
  /** Optional session hash — auto-generated if omitted */
  sessionHash?: string;
  /** Called when the config is loaded */
  onConfigLoaded?: (config: GradioConfig) => void;
  /** Called when a prediction completes */
  onPrediction?: (fnIndex: number, data: any[]) => void;
  /** Custom component overrides — map Gradio type to a React component */
  overrides?: Record<string, React.ComponentType<any>>;
}
