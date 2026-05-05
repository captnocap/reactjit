import { readFile, stat, type FsStat } from '@reactjit/runtime/hooks/fs';
import { execAsync } from '@reactjit/runtime/hooks/process';
import type { AstContractFile } from './AstQuilt';

type SpanNode = {
  kind: string;
  start: number;
  end: number;
  children?: SpanNode[];
};

type WeightedNode = {
  kind: string;
  weight: number;
  children?: WeightedNode[];
};

type LineRecord = {
  index: number;
  start: number;
  end: number;
  text: string;
};

type TokenRecord = {
  kind: string;
  start: number;
  end: number;
};

export type FingerprintStrategy = 'contract' | 'json' | 'text' | 'binary' | 'metadata';

export type FingerprintLoadResult = {
  file: AstContractFile;
  strategy: FingerprintStrategy;
  bytes: number;
  sampledBytes: number;
  note?: string;
};

const GENERATOR_VERSION = 2;
const MAX_TEXT_CHARS = 160_000;
const MAX_JSON_CHARS = 250_000;
const MAX_BINARY_BYTES = 131_072;
const MAX_LINE_TOKENS = 18;
const MAX_TOKENIZED_LINES = 220;
const MAX_JSON_DEPTH = 6;
const MAX_JSON_CHILDREN = 48;
const KEYWORDS = new Set([
  'abstract',
  'and',
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'def',
  'default',
  'delete',
  'do',
  'elif',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'fn',
  'for',
  'from',
  'function',
  'if',
  'impl',
  'import',
  'in',
  'interface',
  'let',
  'loop',
  'match',
  'mod',
  'module',
  'mut',
  'namespace',
  'new',
  'nil',
  'null',
  'or',
  'package',
  'private',
  'protected',
  'pub',
  'public',
  'return',
  'self',
  'static',
  'struct',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'union',
  'use',
  'var',
  'while',
  'with',
  'yield',
]);

const TEXT_EXTENSIONS = new Set([
  'c',
  'cc',
  'cpp',
  'css',
  'csv',
  'cts',
  'go',
  'h',
  'hpp',
  'html',
  'java',
  'js',
  'json',
  'jsx',
  'lua',
  'md',
  'mjs',
  'mts',
  'py',
  'rb',
  'rs',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
  'zig',
]);

const JSON_EXTENSIONS = new Set(['json', 'geojson', 'jsonl']);

const BINARY_EXTENSIONS = new Set([
  '7z',
  'a',
  'bin',
  'class',
  'dll',
  'dylib',
  'elf',
  'exe',
  'gif',
  'gz',
  'ico',
  'jpeg',
  'jpg',
  'mp3',
  'mp4',
  'o',
  'otf',
  'pdf',
  'png',
  'so',
  'tar',
  'ttf',
  'wav',
  'webm',
  'webp',
  'woff',
  'woff2',
  'zip',
]);

const SAMPLE_PATH_CANDIDATES = [
  'cart/app/gallery/components/ast-quilt/AstQuilt.tsx',
  'runtime/primitives.tsx',
  'package.json',
  'tests/component-gallery.autotest',
  'zig-out/bin/component-gallery',
  '/bin/sh',
  '/bin/bash',
] as const;

const CACHE = new Map<string, FingerprintLoadResult>();

function shellQuote(value: string): string {
  if (value === '') return "''";
  if (/^[a-zA-Z0-9_@%+=:,./-]+$/.test(value)) return value;
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function fileExtension(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf('.');
  if (dot < 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

function hashKind(kind: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < kind.length; index++) {
    hash ^= kind.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}

function sumWeights(nodes?: WeightedNode[]): number {
  if (!nodes || nodes.length === 0) return 0;
  let total = 0;
  for (let index = 0; index < nodes.length; index++) total += totalWeight(nodes[index]);
  return total;
}

function totalWeight(node: WeightedNode): number {
  return Math.max(1, node.weight || 0, sumWeights(node.children));
}

function assignWeightedTree(node: WeightedNode, start: number): SpanNode {
  const children = node.children && node.children.length > 0 ? node.children : undefined;
  if (!children) {
    return { kind: node.kind, start, end: start + totalWeight(node) };
  }

  const assignedChildren: SpanNode[] = [];
  let cursor = start;
  for (let index = 0; index < children.length; index++) {
    const child = assignWeightedTree(children[index], cursor);
    assignedChildren.push(child);
    cursor = child.end;
  }

  return {
    kind: node.kind,
    start,
    end: Math.max(start + totalWeight(node), cursor),
    children: assignedChildren,
  };
}

function packSpanTree(path: string, root: SpanNode): AstContractFile {
  const kind: number[] = [];
  const start: number[] = [];
  const end: number[] = [];
  const children: Array<number[] | 0> = [];

  function visit(node: SpanNode): number {
    const id = kind.length + 1;
    const nodeStart = Math.max(0, Math.floor(node.start));
    const nodeEnd = Math.max(nodeStart + 1, Math.floor(node.end));
    kind.push(hashKind(node.kind));
    start.push(nodeStart);
    end.push(nodeEnd);
    children.push(0);

    if (node.children && node.children.length > 0) {
      const childIds: number[] = [];
      for (let index = 0; index < node.children.length; index++) {
        const child = node.children[index];
        if (!child || child.end <= child.start) continue;
        childIds.push(visit(child));
      }
      if (childIds.length > 0) children[id - 1] = childIds;
    }

    return id;
  }

  const rootId = visit(root);
  return {
    path,
    root: rootId,
    count: kind.length,
    nodes: { kind, start, end, children },
  };
}

function countNodes(file: AstContractFile): number {
  return file.count;
}

function resultFor(path: string, root: SpanNode, strategy: FingerprintStrategy, info: FsStat, sampledBytes: number, note?: string): FingerprintLoadResult {
  const file = packSpanTree(path, root);
  return {
    file,
    strategy,
    bytes: Math.max(0, Number(info.size || 0)),
    sampledBytes,
    note,
  };
}

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

function trimLineEnd(text: string): string {
  if (text.endsWith('\r\n')) return text.slice(0, -2);
  if (text.endsWith('\n') || text.endsWith('\r')) return text.slice(0, -1);
  return text;
}

function splitLines(source: string): LineRecord[] {
  const lines: LineRecord[] = [];
  if (source.length === 0) return lines;
  let lineStart = 0;
  let lineIndex = 0;

  for (let index = 0; index < source.length; index++) {
    if (source.charCodeAt(index) !== 10) continue;
    const end = index + 1;
    lines.push({
      index: lineIndex++,
      start: lineStart,
      end,
      text: source.slice(lineStart, end),
    });
    lineStart = end;
  }

  if (lineStart < source.length) {
    lines.push({
      index: lineIndex,
      start: lineStart,
      end: source.length,
      text: source.slice(lineStart),
    });
  }

  return lines;
}

function isBlankLine(line: LineRecord): boolean {
  return trimLineEnd(line.text).trim().length === 0;
}

function classifyLineKind(text: string): string {
  const trimmed = trimLineEnd(text).trim();
  if (!trimmed) return 'line.blank';
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('--') || trimmed.startsWith(';')) return 'line.comment';
  if (/^(import|from|use|include|require)\b/.test(trimmed)) return 'line.import';
  if (/^(export|pub|module|namespace)\b/.test(trimmed)) return 'line.export';
  if (/^(class|struct|interface|enum|type|trait)\b/.test(trimmed)) return 'line.type';
  if (/^(function|def|fn)\b/.test(trimmed) || trimmed.includes('=>')) return 'line.callable';
  if (/^(if|else|switch|match|case|for|while|loop|try|catch)\b/.test(trimmed)) return 'line.control';
  if (/^(return|throw|break|continue|yield)\b/.test(trimmed)) return 'line.flow';
  if (/^[-*+]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) return 'line.list';
  if (/^#{1,6}\s/.test(trimmed)) return 'line.heading';
  if (trimmed.includes('=')) return 'line.assignment';
  return 'line.body';
}

function pushToken(out: TokenRecord[], kind: string, start: number, end: number) {
  if (end <= start) return;
  out.push({ kind, start, end });
}

function tokenizeLine(line: LineRecord): TokenRecord[] {
  const text = line.text;
  const base = line.start;
  const tokens: TokenRecord[] = [];
  let index = 0;

  while (index < text.length && tokens.length < MAX_LINE_TOKENS) {
    const code = text.charCodeAt(index);
    if (code <= 32) {
      index++;
      continue;
    }

    const next = index + 1 < text.length ? text[index + 1] : '';
    const current = text[index];

    if (current === '/' && next === '/') {
      pushToken(tokens, 'token.comment', base + index, base + text.length);
      break;
    }
    if (current === '#') {
      pushToken(tokens, 'token.comment', base + index, base + text.length);
      break;
    }
    if (current === '-' && next === '-') {
      pushToken(tokens, 'token.comment', base + index, base + text.length);
      break;
    }

    if (current === '"' || current === '\'' || current === '`') {
      const quote = current;
      let cursor = index + 1;
      while (cursor < text.length) {
        if (text[cursor] === '\\') {
          cursor += 2;
          continue;
        }
        if (text[cursor] === quote) {
          cursor++;
          break;
        }
        cursor++;
      }
      pushToken(tokens, 'token.string', base + index, base + clamp(cursor, index + 1, text.length));
      index = cursor;
      continue;
    }

    if (code >= 48 && code <= 57) {
      let cursor = index + 1;
      while (cursor < text.length && /[0-9a-fA-F_xX.]/.test(text[cursor])) cursor++;
      pushToken(tokens, 'token.number', base + index, base + cursor);
      index = cursor;
      continue;
    }

    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || current === '_' || current === '$') {
      let cursor = index + 1;
      while (cursor < text.length && /[A-Za-z0-9_$]/.test(text[cursor])) cursor++;
      const word = text.slice(index, cursor);
      if (KEYWORDS.has(word)) pushToken(tokens, 'token.keyword', base + index, base + cursor);
      else if (word[0] >= 'A' && word[0] <= 'Z') pushToken(tokens, 'token.type-name', base + index, base + cursor);
      else pushToken(tokens, 'token.ident', base + index, base + cursor);
      index = cursor;
      continue;
    }

    if ('(){}[]<>'.includes(current)) {
      pushToken(tokens, 'token.brace', base + index, base + index + 1);
      index++;
      continue;
    }

    if (',.;:'.includes(current)) {
      pushToken(tokens, 'token.punct', base + index, base + index + 1);
      index++;
      continue;
    }

    pushToken(tokens, 'token.operator', base + index, base + index + 1);
    index++;
  }

  return tokens;
}

function chunkLines(lines: LineRecord[]): LineRecord[][] {
  const chunks: LineRecord[][] = [];
  let current: LineRecord[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (isBlankLine(line)) {
      if (current.length > 0) {
        chunks.push(current);
        current = [];
      }
      chunks.push([line]);
      continue;
    }

    current.push(line);
    if (current.length >= 24) {
      chunks.push(current);
      current = [];
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function buildLineNode(line: LineRecord, tokenBudget: { value: number }): SpanNode {
  const node: SpanNode = {
    kind: classifyLineKind(line.text),
    start: line.start,
    end: Math.max(line.start + 1, line.end),
  };
  if (tokenBudget.value <= 0 || isBlankLine(line)) return node;

  const tokens = tokenizeLine(line);
  if (tokens.length <= 1) return node;

  tokenBudget.value--;
  node.children = tokens.map((token) => ({
    kind: token.kind,
    start: token.start,
    end: Math.max(token.start + 1, token.end),
  }));
  return node;
}

function buildChunkNode(lines: LineRecord[], depth: number, tokenBudget: { value: number }): SpanNode {
  const start = lines[0].start;
  const end = Math.max(start + 1, lines[lines.length - 1].end);

  if (lines.length === 1) return buildLineNode(lines[0], tokenBudget);

  if (depth >= 2 || lines.length <= 8) {
    return {
      kind: isBlankLine(lines[0]) && lines.length === 1 ? 'text.gap' : `text.chunk.${depth}`,
      start,
      end,
      children: lines.map((line) => buildLineNode(line, tokenBudget)),
    };
  }

  const childCount = lines.length > 40 ? 4 : lines.length > 16 ? 3 : 2;
  const size = Math.max(1, Math.ceil(lines.length / childCount));
  const children: SpanNode[] = [];
  for (let index = 0; index < lines.length; index += size) {
    children.push(buildChunkNode(lines.slice(index, index + size), depth + 1, tokenBudget));
  }

  return {
    kind: `text.group.${depth}`,
    start,
    end,
    children,
  };
}

function buildTextRoot(source: string, totalLength: number): SpanNode {
  const safeLength = Math.max(1, totalLength);
  if (source.length === 0) {
    return {
      kind: 'text.file',
      start: 0,
      end: safeLength,
      children: [{ kind: 'text.empty', start: 0, end: safeLength }],
    };
  }

  const tokenBudget = { value: MAX_TOKENIZED_LINES };
  const lines = splitLines(source);
  const chunks = chunkLines(lines);
  const children = chunks.map((chunk) => buildChunkNode(chunk, 0, tokenBudget));
  if (totalLength > source.length) {
    children.push({
      kind: 'text.unsampled',
      start: source.length,
      end: totalLength,
    });
  }

  return {
    kind: 'text.file',
    start: 0,
    end: safeLength,
    children,
  };
}

function buildWeightedProperty(key: string, value: unknown, depth: number): WeightedNode {
  return {
    kind: `json.key.${classifyJsonKey(key)}`,
    weight: Math.max(1, Math.min(18, key.length + 1)),
    children: [buildJsonWeighted(value, depth + 1)],
  };
}

function classifyJsonKey(key: string): string {
  if (/^(id|key|name|title|label|path|file|url)$/.test(key)) return 'identity';
  if (/^(type|kind|mode|status|state|variant)$/.test(key)) return 'mode';
  if (/^(width|height|size|count|length|index|line|col)$/.test(key)) return 'metric';
  if (/^(children|items|nodes|files|entries|list|rows|cols)$/.test(key)) return 'collection';
  return 'field';
}

function chunkWeightedChildren(kind: string, children: WeightedNode[]): WeightedNode[] {
  if (children.length <= MAX_JSON_CHILDREN) return children;
  const chunkSize = 12;
  const grouped: WeightedNode[] = [];
  for (let index = 0; index < children.length; index += chunkSize) {
    const slice = children.slice(index, index + chunkSize);
    grouped.push({
      kind: `${kind}.group`,
      weight: 1,
      children: slice,
    });
  }
  return grouped;
}

function buildJsonWeighted(value: unknown, depth: number): WeightedNode {
  if (depth >= MAX_JSON_DEPTH) return { kind: 'json.depth-limit', weight: 16 };
  if (value === null) return { kind: 'json.null', weight: 4 };

  if (Array.isArray(value)) {
    const items: WeightedNode[] = [];
    const limit = Math.min(value.length, MAX_JSON_CHILDREN);
    for (let index = 0; index < limit; index++) {
      items.push({
        kind: `json.index.${index % 8}`,
        weight: 1,
        children: [buildJsonWeighted(value[index], depth + 1)],
      });
    }
    if (value.length > limit) {
      items.push({ kind: 'json.overflow', weight: Math.max(4, value.length - limit) });
    }
    return {
      kind: 'json.array',
      weight: 1,
      children: chunkWeightedChildren('json.array', items),
    };
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const limit = Math.min(entries.length, MAX_JSON_CHILDREN);
    const children: WeightedNode[] = [];
    for (let index = 0; index < limit; index++) {
      const entry = entries[index];
      children.push(buildWeightedProperty(entry[0], entry[1], depth));
    }
    if (entries.length > limit) {
      children.push({ kind: 'json.overflow', weight: Math.max(4, entries.length - limit) });
    }
    return {
      kind: 'json.object',
      weight: 1,
      children: chunkWeightedChildren('json.object', children),
    };
  }

  if (typeof value === 'string') {
    return {
      kind: value.length > 48 ? 'json.string.long' : value.length > 16 ? 'json.string.medium' : 'json.string.short',
      weight: Math.max(1, Math.min(96, value.length + 2)),
    };
  }
  if (typeof value === 'number') return { kind: 'json.number', weight: String(value).length + 1 };
  if (typeof value === 'boolean') return { kind: 'json.boolean', weight: value ? 4 : 5 };

  return { kind: 'json.value', weight: 4 };
}

function looksTextContent(text: string, ext: string): boolean {
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (text.length === 0) return true;

  let replacement = 0;
  let control = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code === 0xfffd) replacement++;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) control++;
  }

  return replacement / text.length < 0.02 && control / text.length < 0.03;
}

function shouldTryJson(path: string, text: string): boolean {
  const ext = fileExtension(path);
  if (JSON_EXTENSIONS.has(ext)) return true;
  const trimmed = text.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseHexBytes(hex: string): Uint8Array | null {
  const clean = hex.trim().replace(/\s+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (clean.length % 2 !== 0) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < clean.length; index += 2) {
    const value = parseInt(clean.slice(index, index + 2), 16);
    if (!Number.isFinite(value)) return null;
    bytes[index >> 1] = value;
  }
  return bytes;
}

async function readBinaryPreview(path: string, maxBytes: number): Promise<Uint8Array | null> {
  const nodeScript =
    "const fs=require('fs');const p=process.argv[1];const m=Number(process.argv[2]);const b=fs.readFileSync(p);process.stdout.write(b.subarray(0,m).toString('hex'));";
  const nodeRes = await execAsync(`node -e ${shellQuote(nodeScript)} ${shellQuote(path)} ${shellQuote(String(maxBytes))}`);
  if (nodeRes.code === 0) {
    const parsed = parseHexBytes(nodeRes.stdout);
    if (parsed) return parsed;
  }

  const pythonScript =
    "import pathlib,sys;data=pathlib.Path(sys.argv[1]).read_bytes()[:int(sys.argv[2])];sys.stdout.write(data.hex())";
  const pyRes = await execAsync(`python3 -c ${shellQuote(pythonScript)} ${shellQuote(path)} ${shellQuote(String(maxBytes))}`);
  if (pyRes.code === 0) {
    const parsed = parseHexBytes(pyRes.stdout);
    if (parsed) return parsed;
  }

  return null;
}

function detectMagic(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'binary.header.png';
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'binary.header.pdf';
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'binary.header.zip';
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return 'binary.header.elf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'binary.header.jpeg';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'binary.header.gif';
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return 'binary.header.gzip';
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) return 'binary.header.wasm';
  if (bytes.length >= 4 && bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x46) return 'binary.header.woff';
  return 'binary.header.generic';
}

function classifyByteWindow(bytes: Uint8Array, absoluteStart: number): string {
  if (absoluteStart === 0) return detectMagic(bytes);
  if (bytes.length === 0) return 'binary.window.empty';

  let printable = 0;
  let zero = 0;
  let repeats = 0;
  const buckets = new Array<number>(16).fill(0);
  let previous = bytes[0];

  for (let index = 0; index < bytes.length; index++) {
    const byte = bytes[index];
    if (byte === 0) zero++;
    if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) printable++;
    buckets[byte >> 4]++;
    if (index > 0 && byte === previous) repeats++;
    previous = byte;
  }

  let entropy = 0;
  for (let index = 0; index < buckets.length; index++) {
    const count = buckets[index];
    if (count === 0) continue;
    const p = count / bytes.length;
    entropy -= p * Math.log2(p);
  }

  const zeroRatio = zero / bytes.length;
  const printableRatio = printable / bytes.length;
  const repeatRatio = repeats / Math.max(1, bytes.length - 1);
  if (zeroRatio > 0.6) return 'binary.window.zero';
  if (printableRatio > 0.82) return 'binary.window.ascii';
  if (repeatRatio > 0.55) return 'binary.window.repeat';
  if (entropy < 2.2) return 'binary.window.low-entropy';
  if (entropy > 3.7) return 'binary.window.high-entropy';
  return 'binary.window.mixed';
}

function buildBinarySegments(bytes: Uint8Array, start: number, depth: number): SpanNode {
  const length = bytes.length;
  const kind = classifyByteWindow(bytes, start);
  if (length <= 96 || depth >= 4) {
    return {
      kind,
      start,
      end: start + Math.max(1, length),
    };
  }

  const chunkCount = length > 8192 ? 6 : length > 2048 ? 4 : length > 768 ? 3 : 2;
  const children: SpanNode[] = [];
  let cursor = 0;
  const size = Math.max(1, Math.ceil(length / chunkCount));

  while (cursor < length) {
    const next = Math.min(length, cursor + size);
    children.push(buildBinarySegments(bytes.slice(cursor, next), start + cursor, depth + 1));
    cursor = next;
  }

  return {
    kind,
    start,
    end: start + length,
    children,
  };
}

function buildMetadataFallback(path: string, info: FsStat): FingerprintLoadResult {
  const ext = fileExtension(path) || 'none';
  const segments = path.split(/[\\/]+/).filter(Boolean);
  const weighted: WeightedNode = {
    kind: 'meta.file',
    weight: 1,
    children: [
      {
        kind: `meta.ext.${ext}`,
        weight: Math.max(2, ext.length + 1),
      },
      {
        kind: 'meta.path',
        weight: 1,
        children: segments.slice(-6).map((segment, index) => ({
          kind: `meta.segment.${index % 4}`,
          weight: Math.max(2, Math.min(32, segment.length + 1)),
        })),
      },
      {
        kind: 'meta.size',
        weight: 1,
        children: String(info.size || 0).split('').map((digit) => ({
          kind: `meta.digit.${digit}`,
          weight: 2,
        })),
      },
    ],
  };

  return resultFor(
    path,
    assignWeightedTree(weighted, 0),
    'metadata',
    info,
    0,
    'Unable to sample file bytes; using metadata structure.',
  );
}

function buildTextFingerprint(path: string, text: string, info: FsStat): FingerprintLoadResult {
  const sampled = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
  const note = text.length > sampled.length ? `Showing first ${sampled.length.toLocaleString()} characters.` : undefined;
  return resultFor(path, buildTextRoot(sampled, Math.max(1, text.length)), 'text', info, sampled.length, note);
}

function buildJsonFingerprint(path: string, value: unknown, info: FsStat): FingerprintLoadResult {
  const root = assignWeightedTree(buildJsonWeighted(value, 0), 0);
  return resultFor(path, root, 'json', info, Math.max(1, info.size || root.end), `Packed object tree from ${countNodes(packSpanTree(path, root))} nodes.`);
}

function buildBinaryFingerprint(path: string, bytes: Uint8Array, info: FsStat): FingerprintLoadResult {
  const total = Math.max(1, Number(info.size || bytes.length || 1));
  const children: SpanNode[] = [];
  const headerEnd = Math.min(bytes.length, 64);
  if (headerEnd > 0) {
    children.push({
      kind: detectMagic(bytes),
      start: 0,
      end: headerEnd,
    });
  }
  if (bytes.length > headerEnd) {
    children.push(buildBinarySegments(bytes.slice(headerEnd), headerEnd, 0));
  }
  if (total > bytes.length) {
    children.push({
      kind: 'binary.unsampled',
      start: bytes.length,
      end: total,
    });
  }

  return resultFor(
    path,
    {
      kind: 'binary.file',
      start: 0,
      end: total,
      children,
    },
    'binary',
    info,
    bytes.length,
    total > bytes.length ? `Showing first ${bytes.length.toLocaleString()} bytes.` : undefined,
  );
}

export function listFingerprintSamplePaths(): string[] {
  const out: string[] = [];
  for (let index = 0; index < SAMPLE_PATH_CANDIDATES.length; index++) {
    const candidate = SAMPLE_PATH_CANDIDATES[index];
    const info = stat(candidate);
    if (info && !info.isDir) out.push(candidate);
  }
  return out;
}

export async function loadRuntimeFingerprint(path: string): Promise<FingerprintLoadResult> {
  const clean = String(path || '').trim();
  if (!clean) throw new Error('Enter a file path.');

  const info = stat(clean);
  if (!info) throw new Error(`Path not found: ${clean}`);
  if (info.isDir) throw new Error(`Expected a file, got a directory: ${clean}`);

  const cacheKey = `${GENERATOR_VERSION}:${clean}:${info.size}:${info.mtimeMs}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  const ext = fileExtension(clean);
  const prefersBinary = BINARY_EXTENSIONS.has(ext);
  let result: FingerprintLoadResult | null = null;

  if (!prefersBinary) {
    const text = readFile(clean) ?? '';
    const treatAsText = !(text.length === 0 && info.size > 0 && !TEXT_EXTENSIONS.has(ext)) && looksTextContent(text, ext);
    if (treatAsText) {
      if (text.length <= MAX_JSON_CHARS && shouldTryJson(clean, text)) {
        const parsed = tryParseJson(text);
        if (parsed !== undefined) result = buildJsonFingerprint(clean, parsed, info);
      }
      if (!result) result = buildTextFingerprint(clean, text, info);
    }
  }

  if (!result) {
    const bytes = await readBinaryPreview(clean, MAX_BINARY_BYTES);
    result = bytes ? buildBinaryFingerprint(clean, bytes, info) : buildMetadataFallback(clean, info);
  }

  CACHE.set(cacheKey, result);
  return result;
}
