import { defineGallerySection, defineGalleryStory } from '../types';
import { FlowMap } from '../components/flow-map/FlowMap';

export const flowMapSection = defineGallerySection({
  id: 'flow-map',
  title: 'Flow Map',
  stories: [
    defineGalleryStory({
      id: 'flow-map/default',
      title: 'Flow Map',
      source: 'cart/component-gallery/components/flow-map/FlowMap.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <FlowMap />,
        },
      ],
    }),
  ],
});
