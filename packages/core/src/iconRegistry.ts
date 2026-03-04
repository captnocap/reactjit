/**
 * Icon registry — a global Map populated by @reactjit/icons on import.
 *
 * This lets <Image src="heart" /> resolve to a vector icon automatically
 * when the icons package is loaded. If icons aren't imported, the registry
 * is empty and Image falls through to normal raster loading.
 */

const registry = new Map<string, number[][]>();
const lowerMap = new Map<string, string>(); // lowercase → canonical PascalCase

export function registerIcon(name: string, paths: number[][]) {
  registry.set(name, paths);
  lowerMap.set(name.toLowerCase(), name);
}

export function registerIcons(icons: Record<string, number[][]>) {
  for (const name in icons) {
    const val = icons[name];
    if (Array.isArray(val)) registerIcon(name, val);
  }
}

/** kebab-case or snake_case → PascalCase: "arrow-down" → "ArrowDown", "maximize-2" → "Maximize2" */
function toPascalCase(s: string): string {
  return s.replace(/(^|[-_])([a-z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/[-_]/g, '');
}

export function lookupIcon(name: string): number[][] | undefined {
  // Direct match (PascalCase)
  const direct = registry.get(name);
  if (direct) return direct;

  // Case-insensitive
  const canonical = lowerMap.get(name.toLowerCase());
  if (canonical) return registry.get(canonical);

  // kebab/snake → PascalCase: "arrow-down" / "arrow_down" → "ArrowDown"
  const pascal = toPascalCase(name);
  return registry.get(pascal);
}
