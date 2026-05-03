import { useEffect, useState } from 'react';
import { setTokens, setStyleTokens } from '@reactjit/runtime/theme';
import { mergeThemeTokenCategories } from './theme-system';
import { galleryThemeSystems } from './themes';
import type { ResolvedThemeTokenCategory } from './theme-system';
import type { GalleryThemeTokenValue } from './types';

// ── Runtime bridge ──────────────────────────────────────────────
//
// The gallery's theme system (defineThemeTokenCategory etc.) is display
// metadata — it powers the theme inspector but does not feed the
// runtime/theme.tsx token resolver that classifier definitions use.
//
// To make 'theme:NAME' tokens resolve in the gallery's classifier sheet,
// we flatten the active variant's merged categories and push the values
// into the runtime store on every theme switch.
//
// Naming convention (flattened):
//   • Colors / strings: leaf token name (paper, ink, rule, accent, ok, sys, ...)
//   • Numbers with collision risk: category-prefixed
//       radius.sm           → radiusSm
//       spacing.x4          → spaceX4
//       type.body           → typeBody
//       chrome.topbar       → chromeTopbar
//       letterSpacing.tight → lsTight
//   • Typography passes through: fontMono, fontSans, lineHeight
//
// Classifier authors reference these flat names: 'theme:paper',
// 'theme:radiusMd', 'theme:spaceX4', 'theme:typeBody', 'theme:lsBrand'.

const TOKEN_PREFIX_BY_CATEGORY: Record<string, string> = {
  radius: 'radius',
  spacing: 'space',
  type: 'type',
  chrome: 'chrome',
  letterSpacing: 'ls',
};

function applyPrefix(categoryId: string, tokenName: string): string {
  const prefix = TOKEN_PREFIX_BY_CATEGORY[categoryId];
  if (!prefix) return tokenName;
  return prefix + tokenName.charAt(0).toUpperCase() + tokenName.slice(1);
}

function pushGalleryThemeToRuntime(option: GalleryThemeOption | null): void {
  if (!option) return;
  const colors: Record<string, string> = {};
  const styles: Record<string, number> = {};

  for (const category of option.mergedCategories) {
    for (const token of category.tokens) {
      const key = applyPrefix(category.id, token.name);
      if (typeof token.value === 'number') {
        styles[key] = token.value;
      } else {
        colors[key] = token.value;
      }
    }
  }

  setTokens(colors);
  setStyleTokens(styles);
}

export type GalleryThemeOption = {
  id: string;
  label: string;
  source: string;
  systemId: string;
  systemTitle: string;
  variantId: string;
  variantTitle: string;
  mergedCategories: ResolvedThemeTokenCategory[];
  tokensByPath: Record<string, GalleryThemeTokenValue>;
};

const STORE_KEY = 'component-gallery-active-theme';

type Listener = () => void;

const listeners = new Set<Listener>();

function readPersisted(key: string): string | null {
  try {
    const host = globalThis as { __store_get?: (storeKey: string) => unknown };
    if (typeof host.__store_get === 'function') {
      const value = host.__store_get(key);
      if (typeof value === 'string') return value;
    }
  } catch (_error) {}
  return null;
}

function writePersisted(key: string, value: string): void {
  try {
    const host = globalThis as { __store_set?: (storeKey: string, storeValue: string) => void };
    if (typeof host.__store_set === 'function') host.__store_set(key, value);
  } catch (_error) {}
}

function buildGalleryThemeOptions(): GalleryThemeOption[] {
  const options: GalleryThemeOption[] = [];

  for (const registered of galleryThemeSystems) {
    const variants = registered.system.themes || [];
    const singleVariant = variants.length <= 1;

    for (const variant of variants) {
      const mergedCategories = mergeThemeTokenCategories(registered.system.globalTokens, variant.tokens);
      const tokensByPath: Record<string, GalleryThemeTokenValue> = {};

      for (const category of mergedCategories) {
        for (const token of category.tokens) {
          tokensByPath[`${category.id}.${token.name}`] = token.value;
        }
      }

      options.push({
        id: `${registered.id}:${variant.id}`,
        label: singleVariant ? registered.title : `${registered.title} / ${variant.title}`,
        source: registered.source,
        systemId: registered.id,
        systemTitle: registered.title,
        variantId: variant.id,
        variantTitle: variant.title,
        mergedCategories,
        tokensByPath,
      });
    }
  }

  return options;
}

const GALLERY_THEME_OPTIONS = buildGalleryThemeOptions();
const GALLERY_THEME_OPTIONS_BY_ID = new Map(GALLERY_THEME_OPTIONS.map((option) => [option.id, option] as const));
const DEFAULT_THEME_ID = GALLERY_THEME_OPTIONS[0]?.id || '';

function restoreActiveThemeId(): string {
  const restored = readPersisted(STORE_KEY);
  if (restored && GALLERY_THEME_OPTIONS_BY_ID.has(restored)) return restored;
  return DEFAULT_THEME_ID;
}

let activeGalleryThemeId = restoreActiveThemeId();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

export function getGalleryThemeOptions(): GalleryThemeOption[] {
  return GALLERY_THEME_OPTIONS;
}

export function getActiveGalleryThemeId(): string {
  return activeGalleryThemeId;
}

export function getActiveGalleryTheme(): GalleryThemeOption | null {
  return GALLERY_THEME_OPTIONS_BY_ID.get(activeGalleryThemeId) || GALLERY_THEME_OPTIONS[0] || null;
}

export function getActiveGalleryThemeValue(path: string): GalleryThemeTokenValue | undefined {
  return getActiveGalleryTheme()?.tokensByPath[path];
}

export function findGalleryThemeOption(source: string, variantId: string): GalleryThemeOption | null {
  for (const option of GALLERY_THEME_OPTIONS) {
    if (option.source === source && option.variantId === variantId) return option;
  }
  return null;
}

export function applyGalleryTheme(id: string): void {
  if (!GALLERY_THEME_OPTIONS_BY_ID.has(id)) return;
  if (activeGalleryThemeId === id) return;
  activeGalleryThemeId = id;
  writePersisted(STORE_KEY, id);
  pushGalleryThemeToRuntime(GALLERY_THEME_OPTIONS_BY_ID.get(id) || null);
  notifyListeners();
}

// Seed the runtime with the active theme on module load so classifier
// 'theme:NAME' tokens resolve from first paint.
pushGalleryThemeToRuntime(getActiveGalleryTheme());

export function subscribeGalleryTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGalleryTheme(): {
  active: GalleryThemeOption | null;
  activeThemeId: string;
  options: GalleryThemeOption[];
  setTheme: (id: string) => void;
} {
  const [, tick] = useState(0);

  useEffect(() => subscribeGalleryTheme(() => tick((value) => value + 1)), []);

  return {
    active: getActiveGalleryTheme(),
    activeThemeId: getActiveGalleryThemeId(),
    options: GALLERY_THEME_OPTIONS,
    setTheme: applyGalleryTheme,
  };
}
