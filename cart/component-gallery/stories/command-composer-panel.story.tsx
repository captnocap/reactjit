import { defineGallerySection, defineGalleryStory } from '../types';
import { CommandComposerPanel } from '../components/command-composer-panel/CommandComposerPanel';
import { commandComposerMockData } from '../data/command-composer';

export const commandComposerPanelSection = defineGallerySection({
  id: "command-composer-panel",
  title: "Command Composer",
  group: {
    id: "compositions",
    title: "Compositions",
  },
  kind: "top-level",
  composedOf: [
    "cart/component-gallery/components/command-composer/CommandComposerHeader.tsx",
    "cart/component-gallery/components/command-composer/CommandComposerPromptLine.tsx",
    "cart/component-gallery/components/command-composer/CommandComposerFooter.tsx",
    "cart/component-gallery/components/command-composer/CommandComposerActionRail.tsx",
    "cart/component-gallery/components/command-composer/CommandComposerChip.tsx",
    "cart/component-gallery/components/command-composer/CommandComposerShortcut.tsx",
  ],
  stories: [
    defineGalleryStory({
      id: "command-composer-panel/default",
      title: "Command Composer",
      source: "cart/component-gallery/components/command-composer-panel/CommandComposerPanel.tsx",
      status: 'ready',
      tags: ["input", "panel"],
      variants: [
        {
          id: 'default',
          name: 'Mock-aligned',
          render: () => <CommandComposerPanel row={commandComposerMockData[0]} />,
        },
      ],
    }),
  ],
});
