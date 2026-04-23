# Component Gallery

This cart is the shared presentation surface for components that live beside or inside `cart/sweatshop`.

No component stories are registered yet. Add stories only when a real component is ready to review.

## Scaffold

Run the scaffold before making a component. It creates the component file on the normalized gallery surface, creates its story, and registers it with the gallery:

```bash
scripts/gallery-component Button
```

This creates:

- `cart/component-gallery/components/button/Button.tsx`
- `cart/component-gallery/stories/button.story.tsx`

It also updates `cart/component-gallery/stories/index.ts`.

An explicit component file can be passed when the component should live somewhere else:

```bash
scripts/gallery-component Button cart/sweatshop/components/Button.tsx
```

## Story Shape

Stories register through `stories/index.ts` as `GallerySection[]`. Each story owns metadata and one or more variants. Every variant renders centered inside the same `PAGE_SURFACE` from `surface.ts`.

```tsx
import { defineGallerySection, defineGalleryStory } from '../types';
import { MyComponent } from '../components/my-component/MyComponent';

export const mySection = defineGallerySection({
  id: 'shared',
  title: 'Shared',
  stories: [
    defineGalleryStory({
      id: 'shared/my-component',
      title: 'MyComponent',
      source: 'cart/sweatshop/components/MyComponent.tsx',
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

Keep stories deterministic, self-contained, and built from ReactJIT primitives or existing cart components. Do not use browser DOM APIs in story setup.
