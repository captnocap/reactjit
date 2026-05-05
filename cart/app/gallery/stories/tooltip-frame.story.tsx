import { defineGallerySection, defineGalleryStory } from '../types';
import { TooltipFrame } from '../components/tooltip-frame/TooltipFrame';

export const tooltipFrameSection = defineGallerySection({
  id: "tooltip-frame",
  title: "Tooltip Frame",
  group: {
    id: "controls",
    title: "Controls & Cards",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "tooltip-frame/default",
      title: "Tooltip Frame",
      source: "cart/app/gallery/components/tooltip-frame/TooltipFrame.tsx",
      status: 'ready',
      summary: 'Tooltip frame adapter built from existing AtomFrame and VerticalSpine atoms.',
      tags: ["card", "panel"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <TooltipFrame />,
        },
        {
          id: 'accent',
          name: 'Accent',
          render: () => <TooltipFrame tone="accent" spine="DATA" />,
        },
      ],
    }),
  ],
});
