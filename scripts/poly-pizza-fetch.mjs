#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { cwd, env, exit } from 'node:process';

const TOOL_NAME = 'poly-pizza-fetch';
const USER_AGENT = 'ilovereact/poly-pizza-fetch';
const DEFAULT_OUT_DIR = 'assets/models';
const DEFAULT_ATTRIBUTIONS = 'ATTRIBUTIONS.md';
const DEFAULT_BASES = [
  'https://poly.pizza',
  'https://api.poly.pizza',
];

const HELP = `
Usage:
  node scripts/poly-pizza-fetch.mjs --model <id-or-url> [options]

Options:
  --model <value>          Poly Pizza model ID, slug, or model URL (required)
  --api-key <key>          API key (fallback: POLY_PIZZA_API_KEY env var, then save/settings/api_keys.json)
  --out <dir>              Output directory for model assets (default: ${DEFAULT_OUT_DIR})
  --attributions <path>    Attribution file path (default: <out>/${DEFAULT_ATTRIBUTIONS})
  --base-url <url>         Force one base URL instead of trying defaults
  --allow-non-obj          Keep going if no .obj asset is found
  --dry-run                Resolve metadata + attribution without downloading files
  --help                   Show this help

Examples:
  POLY_PIZZA_API_KEY=... node scripts/poly-pizza-fetch.mjs --model 2f6e4a0d --out assets/models
  node scripts/poly-pizza-fetch.mjs --model https://poly.pizza/m/2f6e4a0d --api-key "$POLY_PIZZA_API_KEY"
`;

function parseArgs(argv) {
  const opts = {
    model: null,
    apiKey: null,
    outDir: DEFAULT_OUT_DIR,
    attributions: null,
    baseUrl: null,
    allowNonObj: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--allow-non-obj') {
      opts.allowNonObj = true;
      continue;
    }
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === '--model') {
      opts.model = next;
      i += 1;
      continue;
    }
    if (arg === '--api-key') {
      opts.apiKey = next;
      i += 1;
      continue;
    }
    if (arg === '--out') {
      opts.outDir = next;
      i += 1;
      continue;
    }
    if (arg === '--attributions') {
      opts.attributions = next;
      i += 1;
      continue;
    }
    if (arg === '--base-url') {
      opts.baseUrl = next;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return opts;
}

function asRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function getPath(obj, path) {
  if (!obj) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function firstString(obj, paths) {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function firstRecord(obj, paths) {
  for (const path of paths) {
    const value = getPath(obj, path);
    const record = asRecord(value);
    if (record) return record;
  }
  return null;
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

function withQuery(url, key, value) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

function buildRequestVariants(url, apiKey) {
  const variants = [];
  const baseHeaders = { accept: 'application/json', 'user-agent': USER_AGENT };

  variants.push({ url, headers: baseHeaders });

  if (apiKey) {
    variants.push({
      url,
      headers: {
        ...baseHeaders,
        'x-api-key': apiKey,
      },
    });
    variants.push({
      url,
      headers: {
        ...baseHeaders,
        authorization: `Bearer ${apiKey}`,
      },
    });
    variants.push({ url: withQuery(url, 'apiKey', apiKey), headers: baseHeaders });
    variants.push({ url: withQuery(url, 'api_key', apiKey), headers: baseHeaders });
    variants.push({ url: withQuery(url, 'key', apiKey), headers: baseHeaders });
  }

  const seen = new Set();
  return variants.filter((variant) => {
    const sig = JSON.stringify(variant);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

async function requestJson(url, headers) {
  const response = await fetch(url, { headers });
  const text = await response.text();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    url,
    data,
    text,
  };
}

function modelIdFromInput(input) {
  const trimmed = input.trim();
  try {
    const u = new URL(trimmed);
    const segments = u.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? decodeURIComponent(last) : trimmed;
  } catch {
    return trimmed;
  }
}

function unwrapModel(payload) {
  const root = asRecord(payload);
  if (!root) return null;

  const direct = firstRecord(root, ['model', 'data.model', 'item', 'result']);
  if (direct) return direct;

  const results = getPath(root, 'results');
  if (Array.isArray(results) && results.length > 0) {
    const first = asRecord(results[0]);
    if (first) return first;
  }

  const data = getPath(root, 'data');
  if (Array.isArray(data) && data.length > 0) {
    const first = asRecord(data[0]);
    if (first) return first;
  }

  return root;
}

function extractAttribution(model, modelId, inputModelRef) {
  const id = firstString(model, ['id', 'slug', 'uuid']) ?? modelId;
  const title = firstString(model, ['title', 'name']) ?? id ?? 'Untitled Model';

  const authorRecord = firstRecord(model, ['author', 'creator', 'user']);
  const author =
    firstString(authorRecord, ['name', 'username', 'displayName', 'title'])
    ?? firstString(model, ['author', 'creator'])
    ?? 'Unknown Author';

  const licenseRecord = firstRecord(model, ['license']);
  const license =
    firstString(licenseRecord, ['name', 'title', 'shortName', 'spdx'])
    ?? firstString(model, ['license'])
    ?? 'License Unspecified';
  const licenseUrl = firstString(licenseRecord, ['url', 'link', 'href']);

  const sourceUrl =
    firstString(model, ['url', 'modelUrl', 'link', 'permalink', 'links.self'])
    ?? (inputModelRef.startsWith('http://') || inputModelRef.startsWith('https://') ? inputModelRef : null);

  const attributionText = firstString(model, [
    'attribution',
    'attributionText',
    'attribution_text',
    'license.attribution',
  ]);

  const licensePart = licenseUrl ? `${license} (${licenseUrl})` : license;
  const fallbackLine = `"${title}" by ${author}. License: ${licensePart}${sourceUrl ? ` — Source: ${sourceUrl}` : ''}`;

  return {
    id,
    title,
    author,
    license,
    licenseUrl,
    sourceUrl,
    attributionText,
    line: attributionText ?? fallbackLine,
  };
}

function isUrlString(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function collectUrls(value, output) {
  if (typeof value === 'string') {
    if (isUrlString(value)) output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, output);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  for (const item of Object.values(record)) {
    collectUrls(item, output);
  }
}

function extensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return extname(pathname).toLowerCase();
  } catch {
    return '';
  }
}

function classifyAssets(urls) {
  const uniqueUrls = [...new Set(urls)];
  const out = {
    obj: [],
    mtl: [],
    textures: [],
    otherModels: [],
    other: [],
  };

  for (const url of uniqueUrls) {
    const ext = extensionFromUrl(url);
    if (ext === '.obj') {
      out.obj.push(url);
      continue;
    }
    if (ext === '.mtl') {
      out.mtl.push(url);
      continue;
    }
    if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tga', '.gif'].includes(ext)) {
      out.textures.push(url);
      continue;
    }
    if (['.glb', '.gltf', '.bin'].includes(ext)) {
      out.otherModels.push(url);
      continue;
    }
    out.other.push(url);
  }

  return out;
}

function sanitizeSegment(input) {
  const safe = String(input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return safe || 'model';
}

function fileNameFromUrl(url, fallback) {
  try {
    const pathname = new URL(url).pathname;
    const base = basename(pathname);
    if (!base) return fallback;
    return decodeURIComponent(base);
  } catch {
    return fallback;
  }
}

function uniqueFileName(name, used) {
  const cleanName = name || 'asset';
  if (!used.has(cleanName)) {
    used.add(cleanName);
    return cleanName;
  }

  const dot = cleanName.lastIndexOf('.');
  const stem = dot > 0 ? cleanName.slice(0, dot) : cleanName;
  const ext = dot > 0 ? cleanName.slice(dot) : '';

  let n = 2;
  while (used.has(`${stem}-${n}${ext}`)) {
    n += 1;
  }
  const candidate = `${stem}-${n}${ext}`;
  used.add(candidate);
  return candidate;
}

async function downloadFile(url, outPath) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(outPath, bytes);
  return bytes.length;
}

function loadApiKeyFromSettings() {
  const settingsPath = join(cwd(), 'save', 'settings', 'api_keys.json');
  if (!existsSync(settingsPath)) return null;
  try {
    const json = JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (!json || typeof json !== 'object') return null;
    return (
      json['polypizza.apiKey']
      || json['poly-pizza.apiKey']
      || json['polyPizza.apiKey']
      || null
    );
  } catch {
    return null;
  }
}

function ensureDirectory(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function buildAttributionBlock(attribution, localDir) {
  const markerId = sanitizeSegment(attribution.id ?? attribution.title);
  const start = `<!-- poly-pizza:${markerId}:start -->`;
  const end = `<!-- poly-pizza:${markerId}:end -->`;

  const lines = [
    start,
    `- [poly-pizza:${attribution.id ?? markerId}] ${attribution.line}`,
    `  - Local path: \`${localDir}\``,
    `  - Downloaded: ${new Date().toISOString()}`,
    end,
  ];
  return {
    markerId,
    start,
    end,
    text: lines.join('\n'),
  };
}

function upsertAttributionsFile(filePath, block) {
  const defaultHeader = [
    '# Asset Attributions',
    '',
    'Generated by `scripts/poly-pizza-fetch.mjs`.',
    '',
  ].join('\n');

  let content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : defaultHeader;
  const startIdx = content.indexOf(block.start);
  const endIdx = content.indexOf(block.end);

  if (startIdx >= 0 && endIdx >= 0 && endIdx > startIdx) {
    const before = content.slice(0, startIdx).replace(/\s*$/, '');
    const after = content.slice(endIdx + block.end.length).replace(/^\s*/, '');
    content = `${before}\n\n${block.text}\n\n${after}`;
  } else {
    content = `${content.replace(/\s*$/, '')}\n\n${block.text}\n`;
  }

  writeFileSync(filePath, content);
}

async function fetchModelPayload({ modelId, baseUrls, apiKey }) {
  const endpointTemplates = [
    '/api/v1.1/models/{id}',
    '/v1.1/models/{id}',
    '/api/v1/models/{id}',
    '/api/models/{id}',
    '/models/{id}',
    '/api/v1.1/model/{id}',
    '/v1.1/model/{id}',
  ];

  const attempts = [];

  for (const baseUrl of baseUrls) {
    const base = normalizeBaseUrl(baseUrl);

    for (const tpl of endpointTemplates) {
      const path = tpl.replace('{id}', encodeURIComponent(modelId));
      const url = `${base}${path}`;
      const variants = buildRequestVariants(url, apiKey);

      for (const variant of variants) {
        const res = await requestJson(variant.url, variant.headers);
        attempts.push(`${res.status} ${variant.url}`);
        if (res.ok && res.data && typeof res.data === 'object') {
          return {
            payload: res.data,
            endpoint: variant.url,
            attempts,
          };
        }
      }
    }
  }

  return { payload: null, endpoint: null, attempts };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[${TOOL_NAME}] ${error.message}`);
    console.log(HELP.trim());
    exit(1);
  }

  if (opts.help) {
    console.log(HELP.trim());
    exit(0);
  }

  if (!opts.model) {
    console.error(`[${TOOL_NAME}] Missing required --model argument.`);
    console.log(HELP.trim());
    exit(1);
  }

  const apiKey = opts.apiKey ?? env.POLY_PIZZA_API_KEY ?? loadApiKeyFromSettings();
  if (!apiKey) {
    console.error(`[${TOOL_NAME}] No API key found.`);
    console.error(`[${TOOL_NAME}] Provide --api-key, set POLY_PIZZA_API_KEY, or configure polypizza.apiKey in save/settings/api_keys.json.`);
    exit(1);
  }

  const modelId = modelIdFromInput(opts.model);
  const baseUrls = opts.baseUrl ? [opts.baseUrl] : DEFAULT_BASES;
  const outDir = opts.outDir;
  const attributionsPath = opts.attributions ?? join(outDir, DEFAULT_ATTRIBUTIONS);

  console.log(`[${TOOL_NAME}] Resolving model "${modelId}"...`);

  const resolved = await fetchModelPayload({ modelId, baseUrls, apiKey });
  if (!resolved.payload) {
    console.error(`[${TOOL_NAME}] Failed to resolve model payload from Poly Pizza.`);
    console.error('[attempts]');
    for (const attempt of resolved.attempts) {
      console.error(`  ${attempt}`);
    }
    exit(1);
  }

  const model = unwrapModel(resolved.payload);
  if (!model) {
    console.error(`[${TOOL_NAME}] Payload was not a usable object.`);
    exit(1);
  }

  const attribution = extractAttribution(model, modelId, opts.model);

  const discoveredUrls = [];
  collectUrls(model, discoveredUrls);
  const assets = classifyAssets(discoveredUrls);

  if (assets.obj.length === 0 && !opts.allowNonObj) {
    console.error(`[${TOOL_NAME}] No .obj file URL found in payload.`);
    console.error(`[${TOOL_NAME}] For g3d, OBJ is required. Use --allow-non-obj to continue anyway.`);
    exit(1);
  }

  const folderName = `${sanitizeSegment(attribution.title)}-${sanitizeSegment(attribution.id ?? modelId)}`;
  const modelDir = join(outDir, folderName);
  ensureDirectory(modelDir);

  const manifest = {
    sourceEndpoint: resolved.endpoint,
    modelId,
    fetchedAt: new Date().toISOString(),
    attribution,
    assets,
    raw: resolved.payload,
  };
  writeFileSync(join(modelDir, 'poly-pizza-model.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const targets = [
    ...assets.obj,
    ...assets.mtl,
    ...assets.textures,
  ];

  const downloaded = [];

  if (!opts.dryRun) {
    const usedNames = new Set();
    for (const url of targets) {
      const fallbackName = `asset-${downloaded.length + 1}`;
      const name = fileNameFromUrl(url, fallbackName);
      const outPath = join(modelDir, uniqueFileName(name, usedNames));
      const bytes = await downloadFile(url, outPath);
      downloaded.push({ url, outPath, bytes });
      console.log(`[${TOOL_NAME}] downloaded ${basename(outPath)} (${bytes} bytes)`);
    }
  } else {
    console.log(`[${TOOL_NAME}] dry-run enabled: skipping file downloads.`);
  }

  const attributionBlock = buildAttributionBlock(attribution, modelDir);
  ensureDirectory(dirname(attributionsPath));
  upsertAttributionsFile(attributionsPath, attributionBlock);

  console.log(`[${TOOL_NAME}] done`);
  console.log(`[${TOOL_NAME}] model dir: ${modelDir}`);
  console.log(`[${TOOL_NAME}] attribution file: ${attributionsPath}`);
  console.log(`[${TOOL_NAME}] attribution: ${attribution.line}`);
}

main().catch((error) => {
  console.error(`[${TOOL_NAME}] ${error instanceof Error ? error.message : String(error)}`);
  exit(1);
});
