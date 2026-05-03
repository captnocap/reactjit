# Component Gallery

This cart is the shared presentation surface for components that live beside or inside `cart/sweatshop`.

## Scaffold

Run the scaffold before making a component. It creates the component file on the normalized gallery surface, creates its story, and registers it with the gallery.

Atoms default to the `Components` group:

```bash
scripts/gallery-component Button
```

Top-level components must declare atom files up front. They default to the `Compositions` group and are rejected if they do not list at least two atom paths:

```bash
scripts/gallery-component MessageComposer \
  cart/sweatshop/components/MessageComposer.tsx \
  --kind top-level \
  --composed-of "cart/sweatshop/components/InputField.tsx,cart/sweatshop/components/SendButton.tsx"
```

This creates:

- `cart/component-gallery/components/button/Button.tsx`
- `cart/component-gallery/stories/button.story.tsx`

It also updates `cart/component-gallery/stories/index.ts`.

An explicit component file can be passed when the component should live somewhere else:

```bash
scripts/gallery-component Button cart/sweatshop/components/Button.tsx
```

The scaffold also accepts an explicit gallery bucket:

```bash
scripts/gallery-component Button --group "Cards & Tiles"
```

Tags can be attached at scaffold time so utility stories like motion helpers are searchable without pretending they are full components:

```bash
scripts/gallery-component UseSpringDemo --tags "hooks,animation"
```

The same scaffold also covers data-contract stories. Data mode creates a schema file, a mock payload, a references export, and a gallery entry in `Data Shapes`. Storage is explicit because the gallery surfaces it as part of the contract:

```bash
scripts/gallery-component ChartDemoData \
  --format data \
  --storage "sqlite-document"
```

Theme systems are scaffolded as a first-class story shape too. The first theme scaffold seeds a shared global token file, then each new theme system gets its own classifier files plus local token overrides in `Theme Systems`. Theme scaffolds also register into the gallery-wide file-theme toggle automatically:

```bash
scripts/gallery-component ConsoleTheme \
  --format theme
```

That creates:

- `cart/component-gallery/themes/shared/global-theme-tokens.ts` on first run only
- `cart/component-gallery/themes/index.ts` updated with the global theme registry
- `cart/component-gallery/themes/console-theme/ConsoleThemeThemeSystem.ts`
- `cart/component-gallery/themes/console-theme/theme-classifier.ts`
- `cart/component-gallery/themes/console-theme/style-classifier.ts`
- `cart/component-gallery/themes/console-theme/variant-classifier.ts`
- `cart/component-gallery/themes/console-theme/breakpoint-classifier.ts`
- `cart/component-gallery/stories/console-theme.story.tsx`

The intent is to keep the shared token vocabulary in one place, then let each theme system override or extend that vocabulary locally without rewriting the gallery story by hand. Any theme registered there shows up in the gallery header as a global file-theme toggle, and file/card atoms that read the gallery theme runtime update against the active token set.

## Story Shape

Stories register through `stories/index.ts` as `GallerySection[]`. Each section can declare a gallery `group`, a `kind` (`atom` or `top-level`), and for top-level entries a `composedOf` list of repo-relative atom files. Individual stories can also carry `tags` like `hooks` or `animation`.

Component stories still render variants inside the shared `PAGE_SURFACE` from `surface.ts`:

```tsx
import { defineGallerySection, defineGalleryStory } from '../types';
import { MyComponent } from '../components/my-component/MyComponent';

export const mySection = defineGallerySection({
  id: 'shared',
  title: 'Shared',
  group: {
    id: 'compositions',
    title: 'Compositions',
  },
  kind: 'top-level',
  composedOf: [
    'cart/sweatshop/components/InputField.tsx',
    'cart/sweatshop/components/SendButton.tsx',
  ],
  stories: [
    defineGalleryStory({
      id: 'shared/my-component',
      title: 'MyComponent',
      source: 'cart/sweatshop/components/MyComponent.tsx',
      tags: ['hooks', 'animation'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <MyComponent />,
        },
      ],
    }),
  ],
});
```

Data-shape stories are for real product contracts and fixture payloads. They do not render a component. They declare a JSON schema, mock data, linked-shape references, and the intended storage target so the gallery shows whether the shape is headed for `localstore`, a SQLite document, normalized SQLite tables, a JSON file, or an atomic file-to-DB sync.

```tsx
import { defineGalleryDataStory, defineGallerySection } from '../types';
import {
  chartDemoData,
  chartDemoDataReferences,
  chartDemoDataSchema,
} from '../data/chart-demo-data';

export const chartDemoDataSection = defineGallerySection({
  id: 'chart-demo-data',
  title: 'Chart Demo Data',
  group: {
    id: 'data-shapes',
    title: 'Data Shapes',
  },
  stories: [
    defineGalleryDataStory({
      id: 'chart-demo-data/catalog',
      title: 'Chart Demo Data',
      source: 'cart/component-gallery/data/chart-demo-data.ts',
      format: 'data',
      storage: ['sqlite-document'],
      tags: ['data-shape', 'demo-data'],
      references: chartDemoDataReferences,
      schema: chartDemoDataSchema,
      mockData: chartDemoData,
    }),
  ],
});
```

Use `references` to describe how documents and tables should converge. The gallery renders those as clickable linked-shape cards so you can move between the participating contracts while deciding whether something belongs in a document, a lookup table, or a normalized relation.

Theme-system stories render token swatches and classifier-file references instead of component variants. They are for shared token vocabularies, palette systems, and classifier stacks that feed real product surfaces.

```tsx
import { defineGallerySection, defineGalleryThemeStory } from '../types';
import { consoleThemeThemeSystem } from '../themes/console-theme/ConsoleThemeThemeSystem';

export const consoleThemeSection = defineGallerySection({
  id: 'console-theme',
  title: 'Console Theme',
  group: {
    id: 'themes',
    title: 'Theme Systems',
  },
  stories: [
    defineGalleryThemeStory({
      id: 'console-theme/theme-system',
      title: 'Console Theme',
      source: 'cart/component-gallery/themes/console-theme/ConsoleThemeThemeSystem.ts',
      format: 'theme',
      tags: ['theme-system', 'theme', 'classifier'],
      classifiers: consoleThemeThemeSystem.classifiers,
      globalTokens: consoleThemeThemeSystem.globalTokens,
      themes: consoleThemeThemeSystem.themes,
    }),
  ],
});
```

Top-level entries are expected to prove composition instead of being a single pasted demo surface. Keep stories deterministic, self-contained, and built from ReactJIT primitives or existing cart components. Do not use browser DOM APIs in story setup.
