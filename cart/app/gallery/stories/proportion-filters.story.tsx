import { defineGallerySection, defineGalleryStory } from '../types';
import { ProportionFilters } from '../components/proportion-filters/ProportionFilters';

export const proportionFiltersSection = defineGallerySection({
  id: 'proportion-filters',
  title: 'Proportion Filters',
  stories: [
    defineGalleryStory({
      id: 'proportion-filters/default',
      title: 'Proportion Filters',
      source: 'cart/component-gallery/components/proportion-filters/ProportionFilters.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <ProportionFilters />,
        },
      ],
    }),
  ],
});
