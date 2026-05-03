import { defineGallerySection, defineGalleryStory } from '../types';
import { Tracking } from '../components/tracking/Tracking';

export const trackingSection = defineGallerySection({
  id: 'tracking',
  title: 'Tracking',
  stories: [
    defineGalleryStory({
      id: 'tracking/default',
      title: 'Tracking',
      source: 'cart/component-gallery/components/tracking/Tracking.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Tracking />,
        },
      ],
    }),
  ],
});
