import type { ThemeSystemDefinition } from '../theme-system';
import { cockpitThemeSystem } from './cockpit/CockpitThemeSystem';

export type RegisteredGalleryThemeSystem = {
  id: string;
  title: string;
  source: string;
  system: ThemeSystemDefinition;
};

// component-gallery:theme-imports

export const galleryThemeSystems: RegisteredGalleryThemeSystem[] = [
  {
    id: 'cockpit',
    title: 'Cockpit',
    source: 'cart/component-gallery/themes/cockpit/CockpitThemeSystem.ts',
    system: cockpitThemeSystem,
  },
  // component-gallery:theme-systems
];
