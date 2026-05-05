import { getActiveGalleryTheme } from './gallery-theme';

const THEME_PREFIX = 'theme:';

export type GalleryRgb = readonly [number, number, number];

function expandShortHex(hex: string): string {
  return hex
    .split('')
    .map((part) => `${part}${part}`)
    .join('');
}

export function resolveGalleryColor(value: string | undefined): string | undefined {
  if (!value || !value.startsWith(THEME_PREFIX)) return value;
  const tokenName = value.slice(THEME_PREFIX.length);
  const theme = getActiveGalleryTheme();
  if (!theme) return undefined;

  for (const category of theme.mergedCategories) {
    for (const token of category.tokens) {
      if (token.name === tokenName && typeof token.value === 'string') {
        return token.value;
      }
    }
  }

  return undefined;
}

export function parseGalleryColor(value: string | undefined): GalleryRgb | null {
  const color = resolveGalleryColor(value);
  if (!color) return null;
  const match = color.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  const hex = match[1].length === 3 ? expandShortHex(match[1]) : match[1];
  return [
    parseInt(hex.slice(0, 2), 16) || 0,
    parseInt(hex.slice(2, 4), 16) || 0,
    parseInt(hex.slice(4, 6), 16) || 0,
  ];
}

export function galleryColorToRgb(value: string, fallback: string = 'theme:bg'): GalleryRgb {
  return parseGalleryColor(value) || parseGalleryColor(fallback) || [0, 0, 0];
}
