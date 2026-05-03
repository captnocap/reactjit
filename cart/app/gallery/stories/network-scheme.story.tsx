import { defineGallerySection, defineGalleryStory } from '../types';
import { NetworkScheme } from '../components/network-scheme/NetworkScheme';

export const networkSchemeSection = defineGallerySection({
  id: 'network-scheme',
  title: 'Network Scheme',
  stories: [
    defineGalleryStory({
      id: 'network-scheme/default',
      title: 'Network Scheme',
      source: 'cart/component-gallery/components/network-scheme/NetworkScheme.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <NetworkScheme />,
        },
      ],
    }),
  ],
});
