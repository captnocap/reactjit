import { defineGallerySection, defineGalleryThemeStory } from '../types';
import { cockpitThemeSystem } from '../themes/cockpit/CockpitThemeSystem';

export const cockpitSection = defineGallerySection({
  id: "cockpit",
  title: "Cockpit",
  group: {
    id: "themes",
    title: "Theme Systems",
  },
  kind: 'atom',
  stories: [
    defineGalleryThemeStory({
      id: "cockpit/theme-system",
      title: "Cockpit",
      source: "cart/component-gallery/themes/cockpit/CockpitThemeSystem.ts",
      format: 'theme',
      status: 'ready',
      tags: ["theme-system", "theme", "classifier"],
      classifiers: cockpitThemeSystem.classifiers,
      globalTokens: cockpitThemeSystem.globalTokens,
      themes: cockpitThemeSystem.themes,
    }),
  ],
});
