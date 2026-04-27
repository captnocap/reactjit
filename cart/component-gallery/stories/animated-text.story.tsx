import { defineGallerySection, defineGalleryStory } from '../types';
import { AnimatedText } from '../components/animated-text/AnimatedText';
import {
  TerminalScene,
  ChatScene,
  HeroScene,
  DecoderScene,
  BootScene,
} from '../components/animated-text/AnimatedTextScenes';

export const animatedTextSection = defineGallerySection({
  id: 'animated-text',
  title: 'Animated Text',
  stories: [
    defineGalleryStory({
      id: 'animated-text/default',
      title: 'Animated Text',
      source: 'cart/component-gallery/components/animated-text/useAnimatedText.ts',
      status: 'draft',
      tags: ['hooks', 'animation', 'text'],
      variants: [
        {
          id: 'overview',
          name: 'Overview',
          summary: 'All four hooks side by side',
          render: () => <AnimatedText />,
        },
        {
          id: 'terminal',
          name: 'Terminal (typewriter)',
          summary: 'Build log with sequenced typewriter lines and trailing cursor',
          render: () => <TerminalScene />,
        },
        {
          id: 'chat',
          name: 'Chat reply (streaming)',
          summary: 'LLM-style word-by-word stream with jitter',
          render: () => <ChatScene />,
        },
        {
          id: 'hero',
          name: 'Hero title (gradient wave)',
          summary: 'Per-character HSL wave for marketing-style headers',
          render: () => <HeroScene />,
        },
        {
          id: 'decoder',
          name: 'Decoder (scramble)',
          summary: 'Per-row scramble settling into authorized values',
          render: () => <DecoderScene />,
        },
        {
          id: 'boot',
          name: 'Boot sequence (all four)',
          summary: 'Scramble title → typewriter shell → streaming summary',
          render: () => <BootScene />,
        },
      ],
    }),
  ],
});
