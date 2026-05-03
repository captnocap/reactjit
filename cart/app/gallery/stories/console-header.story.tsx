import { defineGallerySection, defineGalleryStory } from '../types';
import { ConsoleHeader } from '../components/generic-chat-card/ConsoleHeader';

export const consoleHeaderSection = defineGallerySection({
  id: 'console-header',
  title: 'Console Header',
  stories: [
    defineGalleryStory({
      id: 'console-header/default',
      title: 'Console Header',
      source: 'cart/component-gallery/components/generic-chat-card/ConsoleHeader.tsx',
      status: 'ready',
      summary: 'Identity header atom used at the top of the generic chat card.',
      tags: ['chat', 'console', 'header'],
      variants: [
        {
          id: 'idle',
          name: 'Idle',
          summary: 'Neutral state with the session shell and trust meter.',
          render: () => (
            <ConsoleHeader
              title="Session-01"
              pathology="COUNTERFEITER"
              achievement="The Pane 6 Special"
              trust="F"
              note="Trust: 0.3 | model-neutral"
              mode="idle"
            />
          ),
        },
        {
          id: 'streaming',
          name: 'Streaming',
          summary: 'Active pulse state while the console is generating output.',
          render: () => (
            <ConsoleHeader
              title="Session-07"
              pathology="PATCHWORK"
              achievement="Rail Stable"
              trust="B+"
              note="Trust: 0.7 | live synthesis"
              mode="streaming"
            />
          ),
        },
      ],
    }),
  ],
});
