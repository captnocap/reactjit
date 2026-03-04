import type { ConverterFn } from './types';

type RegistryKey = string;

function key(from: string, to: string): RegistryKey {
  return `${from.toLowerCase()} -> ${to.toLowerCase()}`;
}

// ── Registry (module-level singleton) ──────────────────

const _registry = new Map<RegistryKey, ConverterFn>();
const _categories = new Map<string, Set<string>>();

/** Register a converter. Overwrites if already registered. */
export function register<TIn = any, TOut = any>(
  from: string,
  to: string,
  fn: ConverterFn<TIn, TOut>,
  category?: string,
): void {
  _registry.set(key(from, to), fn as ConverterFn);
  if (category) {
    if (!_categories.has(category)) _categories.set(category, new Set());
    _categories.get(category)!.add(from.toLowerCase());
    _categories.get(category)!.add(to.toLowerCase());
  }
}

/** Register a bidirectional converter (A->B and B->A). */
export function registerBidi<T = any>(
  a: string,
  b: string,
  aToB: ConverterFn<T>,
  bToA: ConverterFn<T>,
  category?: string,
): void {
  register(a, b, aToB, category);
  register(b, a, bToA, category);
}

/**
 * Register a group of units with conversion factors relative to a base unit.
 * Each value in `units` is how many base units equal 1 of that unit.
 * E.g. for length with base 'm': { km: 1000, cm: 0.01 } means 1km = 1000m, 1cm = 0.01m
 */
export function registerUnitGroup(
  category: string,
  baseUnit: string,
  units: Record<string, number>,
): void {
  const allUnits: Record<string, number> = { [baseUnit]: 1, ...units };
  const names = Object.keys(allUnits);
  for (const from of names) {
    for (const to of names) {
      if (from === to) continue;
      const factor = allUnits[from] / allUnits[to];
      register(from, to, (v: number) => v * factor, category);
    }
  }
}

/** Look up a converter. Returns undefined if not found. */
export function getConverter(from: string, to: string): ConverterFn | undefined {
  return _registry.get(key(from, to));
}

/** List all registered categories. */
export function listCategories(): string[] {
  return Array.from(_categories.keys());
}

/** List all units in a category. */
export function listUnits(category: string): string[] {
  return Array.from(_categories.get(category) ?? []);
}

/** Check if a conversion path exists. */
export function canConvert(from: string, to: string): boolean {
  return _registry.has(key(from, to));
}

/** Total number of registered converters. */
export function registrySize(): number {
  return _registry.size;
}
