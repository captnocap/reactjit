/**
 * Poly Pizza API hooks.
 * Auth: API key (header by default, query as fallback if configured).
 *
 * Poly Pizza's API shape can vary by endpoint/version, so this module exposes
 * endpoint overrides while still providing one-line defaults.
 */

import { useAPI, qs, type APIResult } from './base';

const DEFAULT_BASE = 'https://poly.pizza/api/v1.1';

// ── Types ───────────────────────────────────────────────

export interface PolyPizzaAuthor {
  id?: string | number;
  name?: string;
  username?: string;
  url?: string;
}

export interface PolyPizzaLicense {
  id?: string | number;
  name?: string;
  title?: string;
  shortName?: string;
  spdx?: string;
  url?: string;
}

export interface PolyPizzaModel {
  id?: string | number;
  slug?: string;
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  modelUrl?: string;
  author?: PolyPizzaAuthor | string;
  creator?: PolyPizzaAuthor | string;
  license?: PolyPizzaLicense | string;
  attribution?: string;
  attributionText?: string;
  attribution_text?: string;
  files?: Record<string, string | string[]>;
  [key: string]: any;
}

export interface PolyPizzaSearchResponse {
  results?: PolyPizzaModel[];
  items?: PolyPizzaModel[];
  data?: PolyPizzaModel[] | { results?: PolyPizzaModel[] };
  total?: number;
  page?: number;
  [key: string]: any;
}

export interface PolyPizzaAttribution {
  id: string | null;
  title: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string | null;
  attributionText: string | null;
}

export interface PolyPizzaRequestOptions {
  /** API base URL. Defaults to https://poly.pizza/api/v1.1 */
  baseUrl?: string;
  /** How the API key is sent. Defaults to "header". */
  apiKeyIn?: 'header' | 'query';
  /** Query parameter key when apiKeyIn = "query". Defaults to "apiKey". */
  apiKeyQueryParam?: string;
}

export interface PolyPizzaModelOptions extends PolyPizzaRequestOptions {
  /**
   * Endpoint template for model lookup.
   * Defaults to "/models/{id}".
   */
  modelPath?: string;
}

export interface PolyPizzaSearchOptions extends PolyPizzaRequestOptions {
  /**
   * Endpoint for search.
   * Defaults to "/models/search".
   */
  searchPath?: string;
  /** Search parameter key. Defaults to "q". */
  queryKey?: string;
  page?: number;
  perPage?: number;
}

export interface PolyPizzaModelWithAttributionResult extends APIResult<PolyPizzaModel> {
  attribution: PolyPizzaAttribution | null;
  attributionLine: string | null;
}

// ── Internal helpers ────────────────────────────────────

function asRecord(value: unknown): Record<string, any> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function getPath(obj: Record<string, any> | null, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function firstString(obj: Record<string, any> | null, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function firstRecord(obj: Record<string, any> | null, paths: string[]): Record<string, any> | null {
  for (const path of paths) {
    const value = getPath(obj, path);
    const record = asRecord(value);
    if (record) return record;
  }
  return null;
}

function normalizeBaseUrl(baseUrl?: string): string {
  const base = (baseUrl ?? DEFAULT_BASE).trim();
  return base.replace(/\/+$/, '');
}

function polyPizzaHeaders(
  apiKey: string | null,
  opts?: PolyPizzaRequestOptions,
): Record<string, string> | undefined {
  if (!apiKey || opts?.apiKeyIn === 'query') return undefined;
  return {
    'x-api-key': apiKey,
  };
}

function polyPizzaUrl(
  path: string,
  query: Record<string, string | number | boolean | undefined | null>,
  apiKey: string | null,
  opts?: PolyPizzaRequestOptions,
): string {
  const base = normalizeBaseUrl(opts?.baseUrl);
  const slashPath = path.startsWith('/') ? path : `/${path}`;
  const queryWithAuth: Record<string, string | number | boolean | undefined | null> = { ...query };
  if (apiKey && opts?.apiKeyIn === 'query') {
    queryWithAuth[opts.apiKeyQueryParam ?? 'apiKey'] = apiKey;
  }
  return `${base}${slashPath}${qs(queryWithAuth)}`;
}

function resolveModelPath(modelId: string, opts?: PolyPizzaModelOptions): string {
  const modelPath = opts?.modelPath ?? '/models/{id}';
  if (modelPath.includes('{id}')) {
    return modelPath.replace(/\{id\}/g, encodeURIComponent(modelId));
  }
  const clean = modelPath.replace(/\/+$/, '');
  return `${clean}/${encodeURIComponent(modelId)}`;
}

function modelFromPayload(payload: unknown): Record<string, any> | null {
  const root = asRecord(payload);
  if (!root) return null;

  const direct = firstRecord(root, ['model', 'data.model', 'item', 'result']);
  if (direct) return direct;

  const data = getPath(root, 'data');
  if (Array.isArray(data) && data.length > 0) {
    const first = asRecord(data[0]);
    if (first) return first;
  }

  const results = getPath(root, 'results');
  if (Array.isArray(results) && results.length > 0) {
    const first = asRecord(results[0]);
    if (first) return first;
  }

  return root;
}

// ── Hooks ───────────────────────────────────────────────

/**
 * Fetch a Poly Pizza model payload.
 *
 * Default endpoint: /models/{id}
 * Override endpoint/base/auth behavior via opts.
 */
export function usePolyPizzaModel(
  apiKey: string | null,
  modelId: string | null,
  opts?: PolyPizzaModelOptions,
): APIResult<PolyPizzaModel> {
  return useAPI(
    modelId ? polyPizzaUrl(resolveModelPath(modelId, opts), {}, apiKey, opts) : null,
    { headers: polyPizzaHeaders(apiKey, opts) },
  );
}

/**
 * Search Poly Pizza models.
 *
 * Default endpoint: /models/search?q=<query>
 */
export function usePolyPizzaSearch(
  apiKey: string | null,
  query: string | null,
  opts?: PolyPizzaSearchOptions,
): APIResult<PolyPizzaSearchResponse> {
  const searchPath = opts?.searchPath ?? '/models/search';
  const queryKey = opts?.queryKey ?? 'q';
  return useAPI(
    query
      ? polyPizzaUrl(
        searchPath,
        { [queryKey]: query, page: opts?.page, perPage: opts?.perPage },
        apiKey,
        opts,
      )
      : null,
    { headers: polyPizzaHeaders(apiKey, opts) },
  );
}

/**
 * Model hook plus normalized attribution metadata/line.
 */
export function usePolyPizzaModelWithAttribution(
  apiKey: string | null,
  modelId: string | null,
  opts?: PolyPizzaModelOptions,
): PolyPizzaModelWithAttributionResult {
  const result = usePolyPizzaModel(apiKey, modelId, opts);
  const attribution = result.data ? polyPizzaAttributionFields(result.data) : null;
  return {
    ...result,
    attribution,
    attributionLine: attribution ? polyPizzaAttributionLine(result.data) : null,
  };
}

// ── Attribution helpers ─────────────────────────────────

/**
 * Normalize attribution info from a model payload.
 * Works across a few common response shapes.
 */
export function polyPizzaAttributionFields(payload: unknown): PolyPizzaAttribution {
  const model = modelFromPayload(payload);
  const id = firstString(model, ['id', 'slug', 'uuid']);
  const title = firstString(model, ['title', 'name']) ?? id ?? 'Untitled Model';

  const authorRecord = firstRecord(model, ['author', 'creator', 'user']);
  const authorFromRecord = firstString(authorRecord, ['name', 'username', 'displayName', 'title']);
  const authorFromField = firstString(model, ['author', 'creator']);
  const author = authorFromRecord ?? authorFromField ?? 'Unknown Author';

  const licenseRecord = firstRecord(model, ['license']);
  const licenseFromRecord = firstString(licenseRecord, ['name', 'title', 'shortName', 'spdx']);
  const licenseFromField = firstString(model, ['license']);
  const license = licenseFromRecord ?? licenseFromField ?? 'License Unspecified';
  const licenseUrl = firstString(licenseRecord, ['url', 'link', 'href']);

  const sourceUrl = firstString(model, [
    'url',
    'modelUrl',
    'link',
    'permalink',
    'links.self',
  ]);

  const attributionText = firstString(model, [
    'attribution',
    'attributionText',
    'attribution_text',
    'license.attribution',
  ]);

  return {
    id,
    title,
    author,
    license,
    licenseUrl,
    sourceUrl,
    attributionText,
  };
}

/**
 * Build a concise attribution line for credits files/UI.
 */
export function polyPizzaAttributionLine(payload: unknown): string {
  const a = polyPizzaAttributionFields(payload);
  const licensePart = a.licenseUrl ? `${a.license} (${a.licenseUrl})` : a.license;
  const sourcePart = a.sourceUrl ? ` — Source: ${a.sourceUrl}` : '';
  return `"${a.title}" by ${a.author}. License: ${licensePart}${sourcePart}`;
}
