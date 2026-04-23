import { defineGallerySection, defineGalleryStory } from '../types';
import { Candlestick } from '../components/candlestick/Candlestick';

export const candlestickSection = defineGallerySection({
  id: 'candlestick',
  title: 'Candlestick',
  stories: [
    defineGalleryStory({
      id: 'candlestick/default',
      title: 'Candlestick',
      source: 'cart/component-gallery/components/candlestick/Candlestick.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <Candlestick />,
        },
      ],
    }),
  ],
});
