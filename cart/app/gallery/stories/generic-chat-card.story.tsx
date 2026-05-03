import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericChatCard } from '../components/generic-chat-card/GenericChatCard';

export const genericChatCardSection = defineGallerySection({
  id: 'generic-chat-card',
  title: 'Advanced Worker Card',
  stories: [
    defineGalleryStory({
      id: 'generic-chat-card/default',
      title: 'Advanced Worker Card',
      source: 'cart/component-gallery/components/generic-chat-card/GenericChatCard.tsx',
      status: 'ready',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <GenericChatCard />,
        },
      ],
    }),
  ],
});
