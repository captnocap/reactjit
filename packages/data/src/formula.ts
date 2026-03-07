import { convert } from '@reactjit/convert';

// Inlined trivial math — the real math library lives in Lua now.
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const remap = (v: number, iMin: number, iMax: number, oMin: number, oMax: number) => oMin + (oMax - oMin) * ((v - iMin) / (iMax - iMin));
const smoothstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const vec2dist = (a: [number, number], b: [number, number]) => { const dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); };
const vec2len = (v: [number, number]) => Math.sqrt(v[0] * v[0] + v[1] * v[1]);
import type {
  SpreadsheetCellMap,
  SpreadsheetEvaluateOptions,
  SpreadsheetEvaluation,
  SpreadsheetFormulaFn,
  SpreadsheetFunctionMap,
  SpreadsheetScalar,
} from './types';

const CELL_RE = /^[A-Z]+[1-9][0-9]*$/;
const RANGE_RE = /^([A-Z]+[1-9][0-9]*):([A-Z]+[1-9][0-9]*)$/;

function flattenArgs(args: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) out.push(...flattenArgs(arg));
    else out.push(arg);
  }
  return out;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numericArgs(args: unknown[]): number[] {
  const out: number[] = [];
  for (const value of flattenArgs(args)) {
    const n = toNumber(value);
    if (n !== null) out.push(n);
  }
  return out;
}

function convertResult(value: unknown): SpreadsheetScalar {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (value.length === 1) return convertResult(value[0]);
    return value.map((v) => String(convertResult(v))).join(', ');
  }
  return String(value);
}

function parseLiteral(input: string): SpreadsheetScalar {
  const raw = input.trim();
  if (raw.length === 0) return '';
  if (raw.startsWith("'")) return raw.slice(1);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === 'true';
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  return raw;
}

export function normalizeCellAddress(address: string): string {
  return address.trim().toUpperCase();
}

export function columnIndexToLabel(index: number): string {
  if (!Number.isFinite(index) || index < 0) throw new Error(`Invalid column index: ${index}`);
  let n = Math.floor(index);
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function columnLabelToIndex(label: string): number {
  const normalized = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) throw new Error(`Invalid column label: ${label}`);
  let n = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    n = n * 26 + (normalized.charCodeAt(i) - 64);
  }
  return n - 1;
}

export function parseCellAddress(address: string): { col: number; row: number } | null {
  const normalized = normalizeCellAddress(address);
  if (!CELL_RE.test(normalized)) return null;
  const match = normalized.match(/^([A-Z]+)([1-9][0-9]*)$/);
  if (!match) return null;
  const col = columnLabelToIndex(match[1]);
  const row = Number(match[2]) - 1;
  if (!Number.isFinite(row) || row < 0) return null;
  return { col, row };
}

export function buildCellAddress(col: number, row: number): string {
  return `${columnIndexToLabel(col)}${row + 1}`;
}

export function expandCellRange(range: string, maxCells = 10000): string[] {
  const normalized = normalizeCellAddress(range);
  const match = normalized.match(RANGE_RE);
  if (!match) throw new Error(`Invalid range: ${range}`);

  const a = parseCellAddress(match[1]);
  const b = parseCellAddress(match[2]);
  if (!a || !b) throw new Error(`Invalid range: ${range}`);

  const minCol = Math.min(a.col, b.col);
  const maxCol = Math.max(a.col, b.col);
  const minRow = Math.min(a.row, b.row);
  const maxRow = Math.max(a.row, b.row);
  const count = (maxCol - minCol + 1) * (maxRow - minRow + 1);
  if (count > maxCells) throw new Error(`Range too large: ${range} (${count} cells)`);

  const out: string[] = [];
  for (let r = minRow; r <= maxRow; r += 1) {
    for (let c = minCol; c <= maxCol; c += 1) {
      out.push(buildCellAddress(c, r));
    }
  }
  return out;
}

const BASE_FUNCTIONS: SpreadsheetFunctionMap = {
  SUM: (...args: unknown[]) => numericArgs(args).reduce((acc, n) => acc + n, 0),
  AVG: (...args: unknown[]) => {
    const values = numericArgs(args);
    if (values.length === 0) return 0;
    return values.reduce((acc, n) => acc + n, 0) / values.length;
  },
  AVERAGE: (...args: unknown[]) => {
    const values = numericArgs(args);
    if (values.length === 0) return 0;
    return values.reduce((acc, n) => acc + n, 0) / values.length;
  },
  MIN: (...args: unknown[]) => {
    const values = numericArgs(args);
    if (values.length === 0) return 0;
    return Math.min(...values);
  },
  MAX: (...args: unknown[]) => {
    const values = numericArgs(args);
    if (values.length === 0) return 0;
    return Math.max(...values);
  },
  COUNT: (...args: unknown[]) => numericArgs(args).length,
  COUNTA: (...args: unknown[]) => flattenArgs(args).filter((v) => String(v ?? '').trim().length > 0).length,
  IF: (cond: unknown, whenTrue: unknown, whenFalse: unknown) => (cond ? whenTrue : whenFalse),
  AND: (...args: unknown[]) => flattenArgs(args).every(Boolean),
  OR: (...args: unknown[]) => flattenArgs(args).some(Boolean),
  NOT: (value: unknown) => !value,
  ROUND: (value: unknown, digits: unknown = 0) => {
    const n = toNumber(value);
    const d = toNumber(digits) ?? 0;
    if (n === null) return 0;
    const scale = 10 ** Math.max(0, Math.floor(d));
    return Math.round(n * scale) / scale;
  },
  ROUNDUP: (value: unknown, digits: unknown = 0) => {
    const n = toNumber(value);
    const d = toNumber(digits) ?? 0;
    if (n === null) return 0;
    const scale = 10 ** Math.max(0, Math.floor(d));
    return (n >= 0 ? Math.ceil(n * scale) : Math.floor(n * scale)) / scale;
  },
  ROUNDDOWN: (value: unknown, digits: unknown = 0) => {
    const n = toNumber(value);
    const d = toNumber(digits) ?? 0;
    if (n === null) return 0;
    const scale = 10 ** Math.max(0, Math.floor(d));
    return (n >= 0 ? Math.floor(n * scale) : Math.ceil(n * scale)) / scale;
  },
  ABS: (value: unknown) => Math.abs(toNumber(value) ?? 0),
  SQRT: (value: unknown) => Math.sqrt(Math.max(0, toNumber(value) ?? 0)),
  POW: (value: unknown, power: unknown) => Math.pow(toNumber(value) ?? 0, toNumber(power) ?? 0),
  LOG: (value: unknown, base: unknown = Math.E) => {
    const n = Math.max(Number.MIN_VALUE, toNumber(value) ?? 1);
    const b = Math.max(Number.MIN_VALUE, toNumber(base) ?? Math.E);
    return Math.log(n) / Math.log(b);
  },
  EXP: (value: unknown) => Math.exp(toNumber(value) ?? 0),
  CLAMP: (value: unknown, min: unknown, max: unknown) => clamp(toNumber(value) ?? 0, toNumber(min) ?? 0, toNumber(max) ?? 0),
  LERP: (a: unknown, b: unknown, t: unknown) => lerp(toNumber(a) ?? 0, toNumber(b) ?? 0, toNumber(t) ?? 0),
  REMAP: (value: unknown, inMin: unknown, inMax: unknown, outMin: unknown, outMax: unknown) =>
    remap(
      toNumber(value) ?? 0,
      toNumber(inMin) ?? 0,
      toNumber(inMax) ?? 1,
      toNumber(outMin) ?? 0,
      toNumber(outMax) ?? 1,
    ),
  SMOOTHSTEP: (edge0: unknown, edge1: unknown, x: unknown) =>
    smoothstep(toNumber(edge0) ?? 0, toNumber(edge1) ?? 1, toNumber(x) ?? 0),
  DIST2D: (x1: unknown, y1: unknown, x2: unknown, y2: unknown) =>
    vec2dist(
      [toNumber(x1) ?? 0, toNumber(y1) ?? 0],
      [toNumber(x2) ?? 0, toNumber(y2) ?? 0],
    ),
  NORM2D: (x: unknown, y: unknown) => vec2len([toNumber(x) ?? 0, toNumber(y) ?? 0]),
  CONVERT: (value: unknown, from: unknown, to: unknown) => {
    const fromUnit = String(from ?? '').trim();
    const toUnit = String(to ?? '').trim();
    if (fromUnit.length === 0 || toUnit.length === 0) {
      throw new Error('CONVERT requires source and target units');
    }
    const converted = convert(value, fromUnit).to(toUnit);
    if (converted && typeof (converted as Promise<unknown>).then === 'function') {
      throw new Error('Async converters are not supported in spreadsheet formulas');
    }
    return converted;
  },
};

export function createSpreadsheetFunctions(custom?: SpreadsheetFunctionMap): SpreadsheetFunctionMap {
  return { ...BASE_FUNCTIONS, ...(custom ?? {}) };
}

function transformOutsideStrings(expression: string, transform: (segment: string) => string): string {
  let out = '';
  let segment = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < expression.length; i += 1) {
    const ch = expression[i];
    if (quote) {
      segment += ch;
      if (!escaped && ch === quote) {
        out += segment;
        segment = '';
        quote = null;
      }
      escaped = !escaped && ch === '\\';
      continue;
    }

    if (ch === '"' || ch === "'") {
      out += transform(segment);
      segment = ch;
      quote = ch;
      escaped = false;
      continue;
    }

    segment += ch;
  }

  if (segment.length > 0) {
    out += quote ? segment : transform(segment);
  }

  return out;
}

function normalizeOperators(segment: string): string {
  let out = segment;
  out = out.replace(/\^/g, '**');
  out = out.replace(/<>/g, '!=');
  out = out.replace(/&/g, '+');
  out = out.replace(/(^|[^<>!=])=([^=])/g, '$1==$2');
  return out;
}

function compileFormulaExpression(formula: string): string {
  return transformOutsideStrings(formula, (segment) => {
    const placeholders: string[] = [];
    let out = normalizeOperators(segment);

    out = out.replace(/\b([A-Za-z]+[1-9][0-9]*:[A-Za-z]+[1-9][0-9]*)\b/g, (_m, range) => {
      const key = `__RANGE_${placeholders.length}__`;
      placeholders.push(normalizeCellAddress(range));
      return key;
    });

    out = out.replace(/\b([A-Za-z]+[1-9][0-9]*)\b/g, (_m, cell) => `__cell("${normalizeCellAddress(cell)}")`);
    out = out.replace(/__RANGE_(\d+)__/g, (_m, idx) => {
      const i = Number(idx);
      return `__range("${placeholders[i]}")`;
    });

    return out;
  });
}

function normalizeCellMap(input: SpreadsheetCellMap): SpreadsheetCellMap {
  const out: SpreadsheetCellMap = {};
  for (const [address, raw] of Object.entries(input)) {
    out[normalizeCellAddress(address)] = String(raw ?? '');
  }
  return out;
}

export function evaluateSpreadsheet(inputCells: SpreadsheetCellMap, options: SpreadsheetEvaluateOptions = {}): SpreadsheetEvaluation {
  const cells = normalizeCellMap(inputCells);
  const maxRangeCells = options.maxRangeCells ?? 10000;
  const values: Record<string, SpreadsheetScalar> = {};
  const errors: Record<string, string> = {};
  const evaluating = new Set<string>();
  const functions = createSpreadsheetFunctions(options.functions);

  const evalCell = (addressInput: string): SpreadsheetScalar => {
    const address = normalizeCellAddress(addressInput);
    if (Object.prototype.hasOwnProperty.call(values, address)) return values[address];
    if (Object.prototype.hasOwnProperty.call(errors, address)) return '';

    const raw = cells[address] ?? '';
    if (!raw.trim().startsWith('=')) {
      const literal = parseLiteral(raw);
      values[address] = literal;
      return literal;
    }

    if (evaluating.has(address)) {
      errors[address] = `Circular reference at ${address}`;
      values[address] = '';
      return '';
    }

    evaluating.add(address);
    try {
      const formula = raw.trim().slice(1);
      const compiled = compileFormulaExpression(formula);

      const runtimeScope: Record<string, SpreadsheetFormulaFn> = {
        __cell: (ref: unknown) => evalCell(String(ref ?? '')),
        __range: (ref: unknown) => expandCellRange(String(ref ?? ''), maxRangeCells).map((cell) => evalCell(cell)),
      };

      for (const [name, fn] of Object.entries(functions)) {
        runtimeScope[name] = fn;
      }

      const keys = Object.keys(runtimeScope);
      const vals = keys.map((k) => runtimeScope[k]);
      const evaluator = new Function(...keys, `"use strict"; return (${compiled});`);
      const result = evaluator(...vals);

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        throw new Error('Async formula results are not supported');
      }

      const normalized = convertResult(result);
      values[address] = normalized;
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors[address] = message;
      values[address] = '';
      return '';
    } finally {
      evaluating.delete(address);
    }
  };

  const targets = options.targetAddresses && options.targetAddresses.length > 0
    ? options.targetAddresses
    : Object.keys(cells);

  for (const address of targets) {
    evalCell(address);
  }

  return { values, errors };
}

export function buildAddressMatrix(rows: number, cols: number): string[] {
  const out: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out.push(buildCellAddress(c, r));
    }
  }
  return out;
}
