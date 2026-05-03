import type {
  GalleryThemeClassifierFile,
  GalleryThemeTokenCategory,
  GalleryThemeTokenValue,
  GalleryThemeVariant,
} from './types';

export type ThemeSystemDefinition = {
  classifiers: GalleryThemeClassifierFile[];
  globalTokens: GalleryThemeTokenCategory[];
  themes: GalleryThemeVariant[];
};

export type ResolvedThemeToken = {
  name: string;
  value: GalleryThemeTokenValue;
  scope: 'global' | 'local';
};

export type ResolvedThemeTokenCategory = {
  id: string;
  title: string;
  tokens: ResolvedThemeToken[];
};

export function defineThemeTokenCategory(category: GalleryThemeTokenCategory): GalleryThemeTokenCategory {
  return category;
}

export function defineThemeClassifierFile(file: GalleryThemeClassifierFile): GalleryThemeClassifierFile {
  return file;
}

export function defineThemeVariant(theme: GalleryThemeVariant): GalleryThemeVariant {
  return theme;
}

export function defineThemeSystem(definition: ThemeSystemDefinition): ThemeSystemDefinition {
  return definition;
}

export function countThemeTokens(categories: GalleryThemeTokenCategory[]): number {
  let total = 0;
  for (const category of categories) {
    total += Object.keys(category.tokens || {}).length;
  }
  return total;
}

export function mergeThemeTokenCategories(
  globalTokens: GalleryThemeTokenCategory[],
  localTokens: GalleryThemeTokenCategory[]
): ResolvedThemeTokenCategory[] {
  const categories: ResolvedThemeTokenCategory[] = [];
  const categoryIndex = new Map<string, number>();

  const ensureCategory = (id: string, title: string): ResolvedThemeTokenCategory => {
    const existingIndex = categoryIndex.get(id);
    if (existingIndex != null) return categories[existingIndex];

    const nextCategory: ResolvedThemeTokenCategory = {
      id,
      title,
      tokens: [],
    };
    categoryIndex.set(id, categories.length);
    categories.push(nextCategory);
    return nextCategory;
  };

  for (const category of globalTokens) {
    const resolved = ensureCategory(category.id, category.title);
    for (const [name, value] of Object.entries(category.tokens || {})) {
      resolved.tokens.push({
        name,
        value,
        scope: 'global',
      });
    }
  }

  for (const category of localTokens) {
    const resolved = ensureCategory(category.id, category.title);
    const tokenIndex = new Map<string, number>();

    resolved.tokens.forEach((token, index) => {
      tokenIndex.set(token.name, index);
    });

    for (const [name, value] of Object.entries(category.tokens || {})) {
      const existingIndex = tokenIndex.get(name);
      if (existingIndex == null) {
        tokenIndex.set(name, resolved.tokens.length);
        resolved.tokens.push({
          name,
          value,
          scope: 'local',
        });
        continue;
      }

      resolved.tokens[existingIndex] = {
        name,
        value,
        scope: 'local',
      };
    }
  }

  return categories;
}
